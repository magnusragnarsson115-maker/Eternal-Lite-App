import type { Appointment, Questionnaire, QuestionnaireItem, QuestionnaireResponse, QuestionnaireResponseItem } from '@medplum/fhirtypes';
import { audit, type AuditActor } from '../audit.js';
import { bus } from '../events.js';
import { ETERNAL } from '../fhir/constants.js';
import { fhir } from '../fhir/index.js';
import { badRequest, conflict, forbidden, notFound, nowIso } from '../lib/util.js';

/** Wywiad przed wizytą (FHIR Questionnaire / QuestionnaireResponse), wypełniany przez pacjenta. */

export type AnswerValue = string | number | boolean | string[] | null;

const SUPPORTED: QuestionnaireItem['type'][] = ['group', 'display', 'string', 'text', 'boolean', 'choice', 'integer', 'decimal', 'date'];

function flatten(items: QuestionnaireItem[] = []): QuestionnaireItem[] {
  return items.flatMap((i) => [i, ...flatten(i.item)]);
}

function isEnabled(item: QuestionnaireItem, answers: Record<string, AnswerValue>): boolean {
  if (!item.enableWhen?.length) return true;
  const results = item.enableWhen.map((cond) => {
    const a = answers[cond.question];
    if (cond.operator === 'exists') return (a !== undefined && a !== null && a !== '') === cond.answerBoolean;
    const expected = cond.answerBoolean ?? cond.answerString ?? cond.answerCoding?.code ?? cond.answerInteger;
    if (cond.operator === '=') return Array.isArray(a) ? a.includes(String(expected)) : a === expected;
    if (cond.operator === '!=') return Array.isArray(a) ? !a.includes(String(expected)) : a !== expected;
    return true;
  });
  return item.enableBehavior === 'any' ? results.some(Boolean) : results.every(Boolean);
}

function toAnswer(item: QuestionnaireItem, value: AnswerValue): QuestionnaireResponseItem['answer'] {
  if (value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) return undefined;
  switch (item.type) {
    case 'string':
    case 'text':
      if (typeof value !== 'string') throw badRequest('invalid_answer', item.linkId);
      return [{ valueString: value.trim().slice(0, item.type === 'text' ? 2000 : 300) }];
    case 'boolean':
      if (typeof value !== 'boolean') throw badRequest('invalid_answer', item.linkId);
      return [{ valueBoolean: value }];
    case 'integer':
      if (typeof value !== 'number' || !Number.isInteger(value)) throw badRequest('invalid_answer', item.linkId);
      return [{ valueInteger: value }];
    case 'decimal':
      if (typeof value !== 'number' || !Number.isFinite(value)) throw badRequest('invalid_answer', item.linkId);
      return [{ valueDecimal: value }];
    case 'date':
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw badRequest('invalid_answer', item.linkId);
      return [{ valueDate: value }];
    case 'choice': {
      const codes = Array.isArray(value) ? value : [String(value)];
      if (!item.repeats && codes.length > 1) throw badRequest('invalid_answer', item.linkId);
      return codes.map((code) => {
        const opt = item.answerOption?.find((o) => o.valueCoding?.code === code || o.valueString === code);
        if (!opt) throw badRequest('invalid_answer', item.linkId);
        return opt.valueCoding ? { valueCoding: opt.valueCoding } : { valueString: opt.valueString };
      });
    }
    default:
      return undefined;
  }
}

function buildItems(items: QuestionnaireItem[] = [], answers: Record<string, AnswerValue>): QuestionnaireResponseItem[] {
  const out: QuestionnaireResponseItem[] = [];
  for (const item of items) {
    if (!SUPPORTED.includes(item.type)) continue;
    if (!isEnabled(item, answers)) continue;
    if (item.type === 'display') continue;
    if (item.type === 'group') {
      const children = buildItems(item.item, answers);
      if (children.length) out.push({ linkId: item.linkId, text: item.text, item: children });
      continue;
    }
    const answer = toAnswer(item, answers[item.linkId]);
    if (item.required && !answer) throw badRequest('required_answer_missing', item.linkId, { linkId: item.linkId });
    if (answer) out.push({ linkId: item.linkId, text: item.text, answer });
  }
  return out;
}

export async function getQuestionnaire(id: string): Promise<Questionnaire> {
  const q = await fhir().readOptional<Questionnaire>('Questionnaire', id);
  if (!q || q.status === 'retired') throw notFound('questionnaire_not_found');
  return q;
}

export function canonicalOf(q: Questionnaire): string {
  return q.url ?? `urn:eternal:questionnaire:${q.id}`;
}

export async function responseForAppointment(appointmentId: string, patientRef: string): Promise<QuestionnaireResponse | undefined> {
  const all = await fhir().search<QuestionnaireResponse>('QuestionnaireResponse', { subject: patientRef, status: 'completed,amended' });
  return all.find((r) => r.extension?.some((e) => e.url === ETERNAL.ext.appointment && e.valueReference?.reference === `Appointment/${appointmentId}`));
}

export async function submitResponse(
  actor: AuditActor,
  input: { patientRef: string; appointmentId: string; answers: Record<string, AnswerValue> },
): Promise<QuestionnaireResponse> {
  const appt = await fhir().read<Appointment>('Appointment', input.appointmentId);
  if (!appt.participant.some((p) => p.actor?.reference === input.patientRef)) throw forbidden('not_your_appointment');
  if (!['booked', 'arrived'].includes(appt.status)) throw conflict('appointment_not_active');
  const qId = appt.extension?.find((e) => e.url === ETERNAL.ext.questionnaire)?.valueReference?.reference?.split('/')[1];
  if (!qId) throw badRequest('no_questionnaire');
  const q = await getQuestionnaire(qId);
  const items = buildItems(q.item, input.answers);
  const existing = await fhir().search<QuestionnaireResponse>('QuestionnaireResponse', { subject: input.patientRef, questionnaire: canonicalOf(q) });
  const prior = existing.find((r) => r.extension?.some((e) => e.url === ETERNAL.ext.appointment && e.valueReference?.reference === `Appointment/${appt.id}`));
  const resource: QuestionnaireResponse = {
    ...(prior ?? {}),
    resourceType: 'QuestionnaireResponse',
    status: prior ? 'amended' : 'completed',
    questionnaire: canonicalOf(q),
    subject: { reference: input.patientRef },
    author: { reference: input.patientRef },
    source: { reference: input.patientRef },
    authored: nowIso(),
    item: items,
    extension: [{ url: ETERNAL.ext.appointment, valueReference: { reference: `Appointment/${appt.id}` } }],
  };
  const saved = prior ? await fhir().update(resource) : await fhir().create(resource);
  audit(actor, { action: prior ? 'U' : 'C', subtype: 'questionnaire-submit', entityRef: `QuestionnaireResponse/${saved.id}`, patientRef: input.patientRef });
  bus.publish({ type: 'questionnaire.changed', patientRef: input.patientRef, resourceRef: `Appointment/${appt.id}` });
  return saved;
}

export async function responsesForPatient(patientRef: string): Promise<QuestionnaireResponse[]> {
  return fhir().search<QuestionnaireResponse>('QuestionnaireResponse', { subject: patientRef, _sort: '-authored' });
}

/** Odpowiedzi w postaci czytelnej: pytanie → odpowiedź (tekst). */
export function readableAnswers(r: QuestionnaireResponse): { question: string; answer: string }[] {
  const walk = (items: QuestionnaireResponseItem[] = []): { question: string; answer: string }[] =>
    items.flatMap((i) => [
      ...(i.answer?.length
        ? [
            {
              question: i.text ?? i.linkId,
              answer: i.answer
                .map((a) =>
                  a.valueBoolean !== undefined
                    ? a.valueBoolean
                      ? 'Tak'
                      : 'Nie'
                    : (a.valueString ?? a.valueCoding?.display ?? a.valueCoding?.code ?? String(a.valueInteger ?? a.valueDecimal ?? a.valueDate ?? '')),
                )
                .join(', '),
            },
          ]
        : []),
      ...walk(i.item),
    ]);
  return walk(r.item);
}
