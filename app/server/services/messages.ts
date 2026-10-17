import type { Communication, Patient } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { findUserByFhirRef, listUsers } from '../auth/users.js';
import { getDb } from '../db.js';
import { bus } from '../events.js';
import { fhir } from '../fhir/index.js';
import { idFromRef } from '../fhir/repository.js';
import { badRequest, notFound, nowIso } from '../lib/util.js';
import { getOrganization } from './directory.js';
import { notifyPatient, notifyUser } from './notifications.js';
import { toPatientView } from './patients.js';

/**
 * Bezpieczne wiadomości pacjent ↔ placówka (FHIR Communication).
 * Wątek = wiadomość główna; odpowiedzi wskazują ją w Communication.partOf.
 * Kanał nie służy do zgłaszania stanów nagłych — komunikat 112 w interfejsie.
 */

export const MESSAGE_CATEGORIES = ['administrative', 'prescription', 'results', 'question'] as const;
export type MessageCategory = (typeof MESSAGE_CATEGORIES)[number];

export interface MessageView {
  id: string;
  threadId: string;
  from: 'patient' | 'clinic';
  senderName: string;
  body: string;
  sent: string;
}

export interface ThreadView {
  id: string;
  subject: string;
  category: MessageCategory;
  patientId: string;
  patientName: string;
  lastMessageAt: string;
  lastFrom: 'patient' | 'clinic';
  unread: boolean;
  messages?: MessageView[];
}

function fromOf(c: Communication): 'patient' | 'clinic' {
  return c.sender?.reference?.startsWith('Patient/') ? 'patient' : 'clinic';
}

function toMessageView(c: Communication, threadId: string): MessageView {
  return {
    id: c.id ?? '',
    threadId,
    from: fromOf(c),
    senderName: c.sender?.display ?? '',
    body: c.payload?.[0]?.contentString ?? '',
    sent: c.sent ?? c.meta?.lastUpdated ?? '',
  };
}

function staffUserIds(): string[] {
  return listUsers({ staffOnly: true }).map((u) => u.id);
}

function readByAnyStaff(ref: string, staffIds: string[]): boolean {
  if (staffIds.length === 0) return false;
  const row = getDb()
    .prepare(`SELECT 1 FROM record_read WHERE resource_ref = ? AND user_id IN (${staffIds.map(() => '?').join(',')}) LIMIT 1`)
    .get(ref, ...staffIds);
  return !!row;
}

function readByUser(ref: string, userId: string | undefined): boolean {
  if (!userId) return false;
  return !!getDb().prepare('SELECT 1 FROM record_read WHERE resource_ref = ? AND user_id = ?').get(ref, userId);
}

async function buildThreads(all: Communication[], viewer: { kind: 'patient'; userId: string } | { kind: 'staff' }): Promise<ThreadView[]> {
  const roots = all.filter((c) => !c.partOf?.length);
  const staffIds = viewer.kind === 'staff' ? staffUserIds() : [];
  return roots
    .map((root) => {
      const replies = all.filter((c) => c.partOf?.some((p) => p.reference === `Communication/${root.id}`));
      const msgs = [root, ...replies].sort((a, b) => (a.sent ?? '').localeCompare(b.sent ?? ''));
      const last = msgs[msgs.length - 1];
      const incoming = msgs.filter((m) => fromOf(m) === (viewer.kind === 'staff' ? 'patient' : 'clinic'));
      const unread = incoming.some((m) =>
        viewer.kind === 'staff' ? !readByAnyStaff(`Communication/${m.id}`, staffIds) : !readByUser(`Communication/${m.id}`, viewer.userId),
      );
      return {
        id: root.id ?? '',
        subject: root.topic?.text ?? 'Wiadomość',
        category: (root.category?.[0]?.coding?.[0]?.code as MessageCategory) ?? 'question',
        patientId: idFromRef(root.subject?.reference),
        patientName: root.subject?.display ?? '',
        lastMessageAt: last.sent ?? '',
        lastFrom: fromOf(last),
        unread,
      } satisfies ThreadView;
    })
    .sort((a, b) => Number(b.unread) - Number(a.unread) || b.lastMessageAt.localeCompare(a.lastMessageAt));
}

export async function listThreadsForPatient(patientRef: string, userId: string): Promise<ThreadView[]> {
  const all = await fhir().search<Communication>('Communication', { subject: patientRef, _count: '1000' });
  return buildThreads(all, { kind: 'patient', userId });
}

export async function listThreadsForStaff(opts: { patientId?: string } = {}): Promise<ThreadView[]> {
  const params: Record<string, string> = { _count: '1000', _sort: '-sent' };
  if (opts.patientId) params.subject = `Patient/${opts.patientId}`;
  const all = await fhir().search<Communication>('Communication', params);
  return buildThreads(all, { kind: 'staff' });
}

export async function getThread(threadId: string, access: { patientRef?: string; userId: string; staff?: boolean }): Promise<ThreadView> {
  const root = await fhir().readOptional<Communication>('Communication', threadId);
  if (!root || root.partOf?.length) throw notFound('thread_not_found');
  if (access.patientRef && root.subject?.reference !== access.patientRef) throw notFound('thread_not_found');
  const replies = await fhir().search<Communication>('Communication', { 'part-of': `Communication/${threadId}`, _sort: 'sent' });
  const msgs = [root, ...replies].sort((a, b) => (a.sent ?? '').localeCompare(b.sent ?? ''));
  // otwarcie wątku = odczyt wiadomości przychodzących
  const incoming = access.userId ? msgs.filter((m) => fromOf(m) === (access.staff ? 'patient' : 'clinic')) : [];
  const stmt = getDb().prepare('INSERT OR IGNORE INTO record_read (user_id, resource_ref, read_at) VALUES (?, ?, ?)');
  for (const m of incoming) stmt.run(access.userId, `Communication/${m.id}`, nowIso());
  if (incoming.length) bus.publish({ type: 'message.changed', patientRef: root.subject?.reference, resourceRef: `Communication/${threadId}` });
  const [thread] = await buildThreads(msgs, access.staff ? { kind: 'staff' } : { kind: 'patient', userId: access.userId });
  return { ...thread, messages: msgs.map((m) => toMessageView(m, threadId)) };
}

function validateBody(body: string): string {
  const text = body.trim();
  if (!text) throw badRequest('empty_message');
  if (text.length > 2000) throw badRequest('message_too_long');
  return text;
}

export async function startThreadAsPatient(
  actor: AuditActor,
  input: { patientRef: string; subject: string; category: MessageCategory; body: string },
): Promise<ThreadView> {
  if (!MESSAGE_CATEGORIES.includes(input.category)) throw badRequest('invalid_category');
  const subject = input.subject.trim().slice(0, 120);
  if (!subject) throw badRequest('subject_required');
  const patient = await fhir().read<Patient>('Patient', idFromRef(input.patientRef));
  const pv = toPatientView(patient);
  const org = await getOrganization();
  const created = await fhir().create<Communication>({
    resourceType: 'Communication',
    status: 'completed',
    category: [{ coding: [{ system: 'urn:eternal:message-category', code: input.category }] }],
    subject: { reference: input.patientRef, display: pv.name },
    topic: { text: subject },
    sender: { reference: input.patientRef, display: pv.name },
    recipient: org ? [{ reference: `Organization/${org.id}`, display: org.name }] : undefined,
    sent: nowIso(),
    payload: [{ contentString: validateBody(input.body) }],
  });
  audit(actor, { action: 'C', subtype: 'message-send', entityRef: `Communication/${created.id}`, patientRef: input.patientRef });
  bus.publish({ type: 'message.changed', patientRef: input.patientRef, resourceRef: `Communication/${created.id}` });
  for (const u of listUsers({ staffOnly: true }).filter((u) => u.roles.includes('reception') || u.roles.includes('practitioner'))) {
    await notifyUser(u.id, { kind: 'message', title: 'Nowa wiadomość od pacjenta', body: `${pv.name}: ${subject}`, link: `/panel/wiadomosci/${created.id}`, push: false });
  }
  return getThread(created.id ?? '', { patientRef: input.patientRef, userId: actor.userId ?? '' });
}

export async function reply(
  actor: AuditActor,
  input: { threadId: string; body: string; as: 'patient' | 'staff'; patientRef?: string },
): Promise<ThreadView> {
  const root = await fhir().readOptional<Communication>('Communication', input.threadId);
  if (!root || root.partOf?.length) throw notFound('thread_not_found');
  const patientRef = root.subject?.reference ?? '';
  if (input.as === 'patient' && patientRef !== input.patientRef) throw notFound('thread_not_found');
  const org = await getOrganization();
  const sender =
    input.as === 'patient'
      ? { reference: patientRef, display: root.subject?.display }
      : actor.actorRef?.startsWith('Practitioner/')
        ? { reference: actor.actorRef, display: actor.display }
        : { reference: org ? `Organization/${org.id}` : undefined, display: `${org?.name ?? 'Placówka'} — ${actor.display ?? 'rejestracja'}` };
  const created = await fhir().create<Communication>({
    resourceType: 'Communication',
    status: 'completed',
    partOf: [{ reference: `Communication/${input.threadId}` }],
    inResponseTo: [{ reference: `Communication/${input.threadId}` }],
    category: root.category,
    subject: root.subject,
    topic: root.topic,
    sender,
    recipient: input.as === 'patient' ? root.recipient : [{ reference: patientRef, display: root.subject?.display }],
    sent: nowIso(),
    payload: [{ contentString: validateBody(input.body) }],
  });
  audit(actor, { action: 'C', subtype: 'message-send', entityRef: `Communication/${created.id}`, patientRef });
  bus.publish({ type: 'message.changed', patientRef, resourceRef: `Communication/${created.id}` });
  if (input.as === 'staff') {
    await notifyPatient(patientRef, {
      kind: 'message',
      title: 'Nowa wiadomość z placówki',
      body: 'Masz nową odpowiedź w wiadomościach. Zaloguj się, aby ją przeczytać.',
      link: `/wiadomosci/${input.threadId}`,
    });
  } else {
    for (const u of listUsers({ staffOnly: true }).filter((u) => u.roles.includes('reception') || u.roles.includes('practitioner'))) {
      await notifyUser(u.id, { kind: 'message', title: 'Odpowiedź pacjenta', body: `${root.subject?.display}: ${root.topic?.text ?? ''}`, link: `/panel/wiadomosci/${input.threadId}`, push: false });
    }
  }
  const viewerUser = input.as === 'patient' ? findUserByFhirRef(patientRef) : undefined;
  return getThread(input.threadId, {
    patientRef: input.as === 'patient' ? patientRef : undefined,
    userId: viewerUser?.id ?? actor.userId ?? '',
    staff: input.as === 'staff',
  });
}

export async function startThreadAsStaff(
  actor: AuditActor,
  input: { patientId: string; subject: string; body: string; category?: MessageCategory },
): Promise<ThreadView> {
  const patient = await fhir().read<Patient>('Patient', input.patientId);
  const pv = toPatientView(patient);
  const org = await getOrganization();
  const subject = input.subject.trim().slice(0, 120);
  if (!subject) throw badRequest('subject_required');
  const sender = actor.actorRef?.startsWith('Practitioner/')
    ? { reference: actor.actorRef, display: actor.display }
    : { reference: org ? `Organization/${org.id}` : undefined, display: `${org?.name ?? 'Placówka'} — ${actor.display ?? 'rejestracja'}` };
  const created = await fhir().create<Communication>({
    resourceType: 'Communication',
    status: 'completed',
    category: [{ coding: [{ system: 'urn:eternal:message-category', code: input.category ?? 'administrative' }] }],
    subject: { reference: pv.ref, display: pv.name },
    topic: { text: subject },
    sender,
    recipient: [{ reference: pv.ref, display: pv.name }],
    sent: nowIso(),
    payload: [{ contentString: validateBody(input.body) }],
  });
  audit(actor, { action: 'C', subtype: 'message-send', entityRef: `Communication/${created.id}`, patientRef: pv.ref });
  bus.publish({ type: 'message.changed', patientRef: pv.ref, resourceRef: `Communication/${created.id}` });
  await notifyPatient(pv.ref, {
    kind: 'message',
    title: 'Nowa wiadomość z placówki',
    body: 'Masz nową wiadomość. Zaloguj się, aby ją przeczytać.',
    link: `/wiadomosci/${created.id}`,
  });
  return getThread(created.id ?? '', { userId: actor.userId ?? '', staff: true });
}
