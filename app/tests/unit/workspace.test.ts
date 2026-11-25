import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../../server/auth/passwords.js';
import { findUserByFhirRef, updateUser } from '../../server/auth/users.js';
import { INTERVIEW_TREES, treeNode } from '../../server/content/interviews.js';
import { getDb } from '../../server/db.js';
import { TRUST } from '../../server/fhir/constants.js';
import { setConsent } from '../../server/services/consents.js';
import { nextNode, summarize } from '../../server/services/interview.js';
import { avatarFor, buildTimeline, eternalIdFor, whatChanged, type PatientData } from '../../server/services/snapshot.js';
import { Client, waitFor } from './client.js';
import { orgFixture } from './fixture.js';
import { multipart, simplePdf, system } from './helpers.js';

/**
 * Runda 5: przestrzeń pracy lekarza (kolejka, sprawy), Medical Snapshot z pochodzeniem, „Co się zmieniło”, avatar,
 * rejestr poprawek OCR, Scribe (pełna struktura, sekcje, transkrypcja, formaty), wywiad czatowy, Eternal ID.
 * Wszędzie: brak oceny stanu zdrowia przez aplikację.
 */

const PW = 'Runda-Piata-2026';
const PDF = simplePdf(['ALAB laboratoria', 'Data pobrania: 2026-10-01', 'Glukoza 101 H mg/dl 70 - 99', 'Hemoglobina 13,9 g/dl 12 - 16']);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]);

function point(date: string, value: number, extra: Partial<PatientData['labs'][0]['points'][0]> = {}) {
  return { date, value: String(value).replace('.', ','), valueNum: value, unit: 'mg/dl', source: { kind: 'clinic' as const, ref: `DiagnosticReport/${date}`, label: 'Wynik' }, trust: TRUST.clinic.code, ...extra };
}

function synthetic(): PatientData {
  const day = (d: string) => `${d}T08:00:00.000Z`;
  return {
    patientRef: 'Patient/syn',
    name: 'Test',
    labs: [{ key: 'ldl', name: 'Cholesterol LDL', group: 'Lipidogram', points: [point('2026-08-01', 121), point('2026-10-20', 164, { labFlag: 'H' })], chart: true }],
    measurements: [
      { id: 'w1', kind: 'weight', effective: day('2026-08-20'), value: 80, unit: 'kg', source: 'manual' },
      { id: 'w2', kind: 'weight', effective: day('2026-10-25'), value: 84.2, unit: 'kg', source: 'manual' },
      ...[150, 152, 145, 128].map((s, i) => ({ id: `bp${i}`, kind: 'bp' as const, effective: day(`2026-10-1${i}`), systolic: s, diastolic: 92 - i * 4, unit: 'mmHg', source: 'bluetooth' })),
    ],
    activity: [
      ...['2026-08-25', '2026-08-26', '2026-08-27'].map((date) => ({ date, source: 'healthkit' as const, sleep: { minutes: 450 } })),
      ...['2026-10-20', '2026-10-21', '2026-10-22'].map((date) => ({ date, source: 'healthkit' as const, sleep: { minutes: 380 }, steps: 4000 })),
    ],
    meds: [{ id: 'm1', name: 'Atorwastatyna', dosage: '20 mg wieczorem', status: 'active', since: '2026-10-21', reportedAt: '2026-10-21T10:00:00Z' }],
    conditions: [],
    appointments: [{ id: 'a1', status: 'fulfilled', start: '2026-09-01T09:00:00.000Z', end: '2026-09-01T09:15:00.000Z', minutesDuration: 15, mode: 'in-person', canCancelOnline: false, cancelDeadline: '' }],
    documents: [],
    journal: null,
    allergies: { reported: 'unknown' },
    sharing: { vault: true, measurements: true },
  };
}

describe('Runda 5 — „Co się zmieniło”, avatar, oś czasu (funkcje czyste)', () => {
  it('różnice od ostatniej wizyty: lek, LDL 121 → 164, masa +4,2 kg, krótszy sen; bez filtra lekarza nie ma wyróżnień pomiarów', () => {
    const wc = whatChanged(synthetic(), { now: '2026-11-03T10:00:00.000Z' });
    expect(wc.sinceSource).toBe('last-visit');
    const texts = wc.items.map((i) => i.text);
    expect(texts).toContain('Nowy lek: Atorwastatyna (20 mg wieczorem)');
    expect(wc.items.find((i) => i.kind === 'lab-change')).toMatchObject({ from: '121', to: '164', delta: '+43', labFlag: 'H' });
    expect(wc.items.find((i) => i.kind === 'weight')?.delta).toBe('+4,2 kg');
    expect(wc.items.find((i) => i.kind === 'sleep')?.text).toMatch(/7 h 30 min → 6 h 20 min \(krócej o 70 min\)/);
    expect(wc.items.some((i) => i.kind === 'measurement-filter')).toBe(false);
    // wyróżnienie tylko według filtra ustawionego przez lekarza
    const withFilter = whatChanged(synthetic(), { now: '2026-11-03T10:00:00.000Z', filter: { bpSystolic: 140, bpDiastolic: 90 } });
    expect(withFilter.items.find((i) => i.kind === 'measurement-filter')?.text).toMatch(/^3 pomiary ciśnienia ≥ 140\/90 \(Twój filtr wyświetlania\)/);
    // brak słów oceniających
    expect(JSON.stringify(withFilter)).not.toMatch(/gorsz|lepsz|niepokoj|nieprawidł|ryzyk/i);
  });

  it('avatar: obszary z danymi i świeżość, poziom z kompletności; oś czasu z filtrem kategorii', () => {
    const a = avatarFor(synthetic(), '2026-11-03');
    expect(a.regions.find((r) => r.key === 'heart')?.count).toBe(6); // LDL ×2 + 4 pomiary ciśnienia
    expect(a.regions.find((r) => r.key === 'heart')?.recent).toBe(true);
    expect(a.regions.find((r) => r.key === 'kidneys')?.count).toBe(0);
    expect(a.level).toBeGreaterThanOrEqual(2);
    expect(a.rule).toMatch(/nie stan zdrowia/);
    const tl = buildTimeline(synthetic(), { categories: ['meds', 'tests'] });
    expect(new Set(tl.map((e) => e.category))).toEqual(new Set(['meds', 'tests']));
    expect(tl.find((e) => e.category === 'tests')?.detail).toMatch(/z oznaczeniem laboratorium/);
  });

  it('wywiad: rozgałęzienia z drzewa i podsumowanie z objawami zaprzeczonymi, bez punktacji', () => {
    const t = INTERVIEW_TREES.find((x) => x.id === 'cardiology')!;
    expect(nextNode(treeNode(t, 'chest-pain')!, 'yes')).toBe('chest-when');
    expect(nextNode(treeNode(t, 'chest-pain')!, 'no')).toBe('dyspnea');
    const s = summarize(t, { reason: 'control', 'chest-pain': 'no', dyspnea: 'yes', palpitations: 'unknown', smoking: 'yes' }, ['reason', 'chest-pain', 'dyspnea', 'palpitations', 'smoking']);
    expect(s.reason).toEqual(['Wizyta kontrolna']);
    expect(s.negatives).toEqual(['ból lub ucisk w klatce piersiowej']);
    expect(s.symptoms).toEqual(['duszność przy wysiłku']);
    expect(s.unsure).toEqual(['kołatanie serca']);
    expect(s.risk).toEqual(['palenie (podane przez pacjenta)']);
    expect(JSON.stringify(s)).not.toMatch(/punkt|wynik|ryzyko wysokie|pilne/i);
    // każde odgałęzienie prowadzi do istniejącego pytania, bez pętli
    for (const tree of INTERVIEW_TREES)
      for (const n of tree.nodes) for (const next of [n.next, ...(n.options ?? []).map((o) => o.next)].filter(Boolean)) expect(treeNode(tree, next!), `${tree.id}:${n.id} → ${next}`).toBeTruthy();
  });

  it('Eternal ID: stały format, bez danych osobowych', () => {
    expect(eternalIdFor('Patient/abc-123')).toMatch(/^ETR-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    expect(eternalIdFor('Patient/abc-123')).toBe(eternalIdFor('Patient/abc-123'));
  });
});

describe('Runda 5 — API', () => {
  let fx: Awaited<ReturnType<typeof orgFixture>>;
  let pt: Client;
  const pid = () => fx.patient.patient.id!;

  beforeAll(async () => {
    fx = await orgFixture({ patientAccount: true });
    const user = findUserByFhirRef(fx.patient.ref)!;
    updateUser(user.id, { password_hash: await hashPassword(PW) });
    for (const t of ['terms', 'privacy', 'results-online', 'share-measurements'] as const) await setConsent(system, fx.patient.ref, t, true);
    pt = new Client(fx.app);
    await pt.req('POST', '/api/auth/login', { email: user.email, password: PW });
  });
  afterAll(async () => {
    await fx?.app.close();
  });

  let caseId = '';

  it('kolejka: wizyta z brakami danych (5 pól kompletności), pierwsza wizyta = „nowi”; rejestracja widzi kolejkę', async () => {
    const r = await fx.clients.doctor.req('GET', '/api/staff/workspace?scope=all');
    expect(r.status).toBe(200);
    const appt = r.json.items.find((i: { key: string }) => i.key === `appointment:${fx.appt.id}`);
    expect(appt.buckets).toEqual(expect.arrayContaining(['missing', 'new']));
    expect(appt.completeness.items.map((i: { key: string }) => i.key)).toEqual(['interview', 'results', 'consent', 'medications', 'measurements']);
    expect(appt.completeness.missing).toContain('brak wywiadu');
    expect(r.json.rule).toMatch(/nie ocenia/);
    expect((await fx.clients.reception.req('GET', '/api/staff/workspace')).status).toBe(200);
  });

  it('sprawa: cykl życia z dozwolonymi przejściami, właściciel, „pilne” od personelu, historia; inna klinika nie widzi', async () => {
    const c = await fx.clients.doctor.req('POST', '/api/staff/cases', { patientId: pid(), title: 'Brak wyników lipidogramu', source: 'appointment', sourceRef: `Appointment/${fx.appt.id}` });
    expect(c.status).toBe(200);
    expect(c.json).toMatchObject({ status: 'new', statusLabel: 'nowa', owner: { name: 'lek. Jan Testowy' } });
    caseId = c.json.id;
    // ta sama pozycja kolejki → ta sama otwarta sprawa
    expect((await fx.clients.doctor.req('POST', '/api/staff/cases', { patientId: pid(), title: 'x', source: 'appointment', sourceRef: `Appointment/${fx.appt.id}` })).json.id).toBe(caseId);
    expect((await fx.clients.doctor.req('PUT', `/api/staff/cases/${caseId}`, { status: 'incomplete', comment: 'czekamy na wyniki' })).json.status).toBe('incomplete');
    expect((await fx.clients.doctor.req('PUT', `/api/staff/cases/${caseId}`, { status: 'follow-up' })).status).toBe(409);
    const u = await fx.clients.reception.req('PUT', `/api/staff/cases/${caseId}`, { priority: 'urgent', ownerUserId: fx.users.reception.id });
    expect(u.json).toMatchObject({ priority: 'urgent', owner: { name: 'Recepcja' } });
    const full = await fx.clients.doctor.req('GET', `/api/staff/cases/${caseId}`);
    expect(full.json.history.map((e: { kind: string }) => e.kind)).toEqual(['created', 'status', 'owner', 'priority']);
    expect(full.json.history[1]).toMatchObject({ from: 'new', to: 'incomplete', actor: 'lek. Jan Testowy', note: 'czekamy na wyniki' });
    const q = await fx.clients.doctor.req('GET', '/api/staff/workspace?scope=all');
    const item = q.json.items.find((i: { key: string }) => i.key === `appointment:${fx.appt.id}`);
    expect(item.case.id).toBe(caseId);
    expect(item.buckets).toContain('urgent');
    expect((await fx.clients.other.req('GET', `/api/staff/cases/${caseId}`)).status).toBe(404);
  });

  it('OCR: poprawka zapisana jako wartość automatyczna → poprawka → kto → kiedy; widzi pacjent i lekarz; eksport bez danych pacjenta', async () => {
    const up = multipart({ kind: 'lab' }, { name: 'file', filename: 'alab.pdf', contentType: 'application/pdf', data: PDF });
    const res = await pt.upload('/api/me/intake', up.payload, up.contentType);
    const item = await waitFor(async () => {
      const r = await pt.req('GET', `/api/me/intake/${res.json.id}`);
      return r.json.status === 'processing' ? undefined : r.json;
    });
    const hb = item.extract.items.find((i: { name: string }) => /Hemoglobina/i.test(i.name));
    const glu = item.extract.items.find((i: { name: string }) => /Glukoza/i.test(i.name));
    await pt.req('POST', `/api/me/intake/${item.id}/review`, { items: [{ id: hb.id, action: 'correct', value: '13,8' }, { id: glu.id, action: 'confirm' }] });
    expect((await pt.req('POST', `/api/me/intake/${item.id}/submit`)).status).toBe(200);
    const mine = await pt.req('GET', '/api/me/corrections');
    expect(mine.json.items[0]).toMatchObject({ field: 'value', autoValue: '13,9', correctedValue: '13,8', actorKind: 'patient' });
    // lekarz widzi poprawki dopiero przy udostępnieniu
    expect((await fx.clients.doctor.req('GET', `/api/staff/patients/${pid()}/corrections`)).json.items).toHaveLength(0);
    const g = await pt.req('POST', '/api/me/grants', { orgId: fx.orgId, scope: { kind: 'all' }, purpose: 'visit', days: 7 });
    expect(g.status).toBe(200);
    expect((await fx.clients.doctor.req('GET', `/api/staff/patients/${pid()}/corrections`)).json.items[0].correctedValue).toBe('13,8');
    const csv = await fx.clients.admin.req('GET', '/api/admin/mapping-corrections.csv');
    expect(csv.status).toBe(200);
    expect(csv.body).toContain('"13,9";"13,8";"pacjent"');
    expect(csv.body).not.toContain(fx.patient.ref);
    expect(csv.body).not.toContain('Linkowa');
    expect((await fx.clients.doctor.req('GET', '/api/admin/mapping-corrections.csv')).status).toBe(403);
  });

  it('Medical Snapshot: strzałka tylko z oznaczenia laboratorium, drążenie do źródła z poprawką i potwierdzeniem; dziennik dostępu', async () => {
    const r = await fx.clients.doctor.req('GET', `/api/staff/patients/${pid()}/snapshot`);
    expect(r.status).toBe(200);
    const { snapshot, avatar, whatChanged: wc } = r.json;
    const glu = snapshot.results.latest.find((x: { name: string }) => /Glukoza/.test(x.name));
    expect(glu).toMatchObject({ labFlag: 'H', arrow: '↑' });
    const hb = snapshot.results.latest.find((x: { name: string }) => /Hemoglobina/.test(x.name));
    expect(hb.arrow).toBeUndefined();
    expect(snapshot.patient.eternalId).toMatch(/^ETR-/);
    expect(snapshot.sharing.vault).toBe(true);
    expect(avatar.regions.find((x: { key: string }) => x.key === 'blood').count).toBeGreaterThan(0);
    expect(wc.note).toMatch(/nie ocenia/);
    const d = await fx.clients.doctor.req('GET', `/api/staff/patients/${pid()}/snapshot/result?key=${encodeURIComponent(hb.key)}`);
    expect(d.status).toBe(200);
    expect(d.json.points[0].corrections[0]).toMatchObject({ field: 'value', from: '13,9', to: '13,8' });
    expect(d.json.points[0].trustLabel).toBe('potwierdzone przez pacjenta');
    expect(d.json.points[0].confirmations.length).toBeGreaterThan(0);
    const n = getDb().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE subtype IN ('snapshot-read','result-provenance') AND patient_ref = ?").get(fx.patient.ref) as { n: number };
    expect(n.n).toBe(2);
    // rejestracja nie widzi danych klinicznych
    expect((await fx.clients.reception.req('GET', `/api/staff/patients/${pid()}/snapshot`)).status).toBe(403);
    // pacjent: ten sam obraz o sobie
    const mine = await pt.req('GET', '/api/me/health-snapshot');
    expect(mine.json.snapshot.results.total).toBeGreaterThan(0);
    const tl = await pt.req('GET', '/api/me/health-timeline?categories=tests');
    expect(tl.json.items.every((e: { category: string }) => e.category === 'tests')).toBe(true);
  });

  it('filtr wyświetlania lekarza: zapis i walidacja zakresu', async () => {
    expect((await fx.clients.doctor.req('PUT', '/api/staff/display-filter', { bpSystolic: 140, bpDiastolic: 90 })).json).toMatchObject({ bpSystolic: 140, bpDiastolic: 90 });
    expect((await fx.clients.doctor.req('PUT', '/api/staff/display-filter', { bpSystolic: 1000 })).status).toBe(400);
  });

  it('wywiad czatowy: rozgałęzienie, krok wstecz, zakończenie → podsumowanie i odpowiedź przy wizycie; lekarz widzi', async () => {
    const av = await pt.req('GET', '/api/me/interviews');
    expect(av.json.available.map((x: { id: string }) => x.id)).toEqual(expect.arrayContaining(['first-visit', 'cardiology', 'diabetology', 'psychiatry']));
    let s = (await pt.req('POST', '/api/me/interviews', { treeId: 'cardiology', appointmentId: fx.appt.id })).json;
    expect(s.current.id).toBe('reason');
    const answer = async (value: unknown) => {
      const r = await pt.req('POST', `/api/me/interviews/${s.id}/answer`, { nodeId: s.current.id, value });
      expect(r.status).toBe(200);
      s = r.json;
    };
    expect((await pt.req('POST', `/api/me/interviews/${s.id}/answer`, { nodeId: 'reason', value: 'zła' })).status).toBe(400);
    expect((await pt.req('POST', `/api/me/interviews/${s.id}/answer`, { nodeId: 'dyspnea', value: 'yes' })).status).toBe(409);
    await answer('control');
    expect(s.current.id).toBe('chest-pain');
    await answer('yes');
    expect(s.current.id).toBe('chest-when');
    s = (await pt.req('POST', `/api/me/interviews/${s.id}/back`)).json;
    expect(s.current.id).toBe('chest-pain');
    await answer('no');
    expect(s.current.id).toBe('dyspnea');
    for (const v of ['yes', 'no', 'no', 'no', '135/85', 'no', 'no', ['hypertension'], 'no', 'never', 'no', 'Czy mogę ćwiczyć?']) await answer(v);
    expect(s.status).toBe('completed');
    expect(s.summary.negatives).toEqual(expect.arrayContaining(['ból lub ucisk w klatce piersiowej', 'kołatanie serca', 'obrzęki nóg']));
    expect(s.summary.symptoms).toContain('duszność przy wysiłku');
    expect(s.summary.allergies).toContain('pacjent zaprzecza uczuleniom na leki');
    expect(s.summary.issues).toEqual(['Czy mogę ćwiczyć?']);
    const st = await fx.clients.doctor.req('GET', `/api/staff/patients/${pid()}/interviews`);
    expect(st.json.items[0].summary.conditions).toEqual(['Nadciśnienie']);
    const comp = await fx.clients.doctor.req('GET', `/api/staff/appointments/${fx.appt.id}/completeness`);
    expect(comp.json.items.find((i: { key: string }) => i.key === 'interview').status).toBe('ok');
    expect((await fx.clients.other.req('GET', `/api/staff/patients/${pid()}/interviews`)).json.items ?? []).toHaveLength(0);
  });

  it('Scribe: pełna struktura 11 sekcji, uczestnicy, poprawka transkrypcji z historią, odrzucona sekcja poza dokumentacją, formaty', async () => {
    const cfg = await fx.clients.doctor.req('GET', '/api/staff/scribe/config');
    expect(cfg.json.templates.find((t: { id: string }) => t.id === 'full').sections).toHaveLength(11);
    const start = await fx.clients.doctor.req('POST', '/api/staff/scribe', {
      patientId: pid(),
      appointmentId: fx.appt.id,
      templateId: 'full',
      consent: true,
      participants: [{ role: 'lekarz', name: 'lek. Jan Testowy', speaker: 'lekarz' }, { role: 'pacjent', speaker: 'pacjent' }],
    });
    expect(start.status).toBe(200);
    expect(start.json.mediaKind).toBe('audio');
    const id = start.json.id;
    const up = multipart({ seconds: '60' }, { name: 'file', filename: 'w.webm', contentType: 'audio/webm', data: Buffer.alloc(4096, 1) });
    await fx.clients.doctor.upload(`/api/staff/scribe/${id}/audio`, up.payload, up.contentType);
    const draft = await waitFor(async () => {
      const r = await fx.clients.doctor.req('GET', `/api/staff/scribe/${id}`);
      return ['draft', 'failed'].includes(r.json.status) ? r.json : undefined;
    });
    expect(draft.status).toBe('draft');
    expect(draft.participants).toHaveLength(2);
    expect(draft.transcript.segments[1].start).toBeTypeOf('number');
    const powod = draft.note.sections.find((s: { key: string }) => s.key === 'powod');
    expect(powod.paragraphs.length).toBe(1);
    const seg = draft.transcript.segments[1];
    const ed = await fx.clients.doctor.req('PUT', `/api/staff/scribe/${id}/transcript/${seg.id}`, { text: `${seg.text} Poprawione.` });
    expect(ed.json.transcriptEdits).toBe(1);
    const edits = await fx.clients.doctor.req('GET', `/api/staff/scribe/${id}/transcript-edits`);
    expect(edits.json.items[0]).toMatchObject({ segmentId: seg.id, before: seg.text, by: 'lek. Jan Testowy' });
    expect((await fx.clients.doctor.req('POST', `/api/staff/scribe/${id}/sections/objawy`, { action: 'reject' })).json.sectionState.objawy.state).toBe('rejected');
    expect((await fx.clients.doctor.req('POST', `/api/staff/scribe/${id}/sections/powod`, { action: 'accept' })).json.sectionState.powod.state).toBe('accepted');
    const regen = await fx.clients.doctor.req('POST', `/api/staff/scribe/${id}/sections/plan/regenerate`);
    expect(regen.status).toBe(200);
    const soap = await fx.clients.doctor.req('GET', `/api/staff/scribe/${id}/format/soap`);
    expect(soap.json.sections.map((s: { title: string }) => s.title[0])).toEqual(['S', 'O', 'A', 'P']);
    expect(soap.json.approved).toBe(false);
    const fhirFmt = await fx.clients.doctor.req('GET', `/api/staff/scribe/${id}/format/fhir`);
    expect(fhirFmt.json.fhir).toMatchObject({ resourceType: 'Composition', status: 'preliminary' });
    const ap = await fx.clients.doctor.req('POST', `/api/staff/scribe/${id}/approve`);
    expect(ap.status).toBe(200);
    expect(ap.json.note.sections.find((s: { key: string }) => s.key === 'objawy').paragraphs).toHaveLength(0);
    const discharge = await fx.clients.doctor.req('GET', `/api/staff/scribe/${id}/format/discharge`);
    expect(discharge.json.approved).toBe(true);
  });

  it('dokumentacja fotograficzna: tylko za zgodą, zapis jako dokument „zdjęcie”, bez analizy', async () => {
    const no = multipart({ region: 'arms' }, { name: 'file', filename: 'skora.png', contentType: 'image/png', data: PNG });
    expect((await fx.clients.doctor.upload(`/api/staff/patients/${pid()}/photos`, no.payload, no.contentType)).status).toBe(400);
    const yes = multipart({ region: 'arms', consent: 'true', note: 'zmiana na przedramieniu' }, { name: 'file', filename: 'skora.png', contentType: 'image/png', data: PNG });
    const r = await fx.clients.doctor.upload(`/api/staff/patients/${pid()}/photos`, yes.payload, yes.contentType);
    expect(r.status).toBe(200);
    expect(r.json.category).toBe('Dokumentacja fotograficzna');
  });

  it('Eternal ID: tekst na chip ≤ 380 B, link odwoływalny z wpisem w dzienniku dostępu', async () => {
    const me = await pt.req('GET', '/api/me/eternal-id');
    expect(me.status).toBe(200);
    expect(me.json.nfc.bytes).toBeLessThanOrEqual(380);
    expect(me.json.nfc.text).toContain(me.json.eternalId);
    const nfc = await pt.req('PUT', '/api/me/eternal-id/nfc', { medications: true });
    expect(nfc.json.choice.medications).toBe(true);
    await pt.req('PUT', '/api/me/eternal-id/insurance', { provider: 'Ubezpieczyciel Test', policyNumber: 'POL-1' });
    const link = await pt.req('POST', '/api/me/eternal-id/links', { days: 30, label: 'brelok' });
    const token = link.json.url.split('/id/')[1];
    const pub = new Client(fx.app);
    const card = await pub.req('GET', `/api/eternal-id/${token}`);
    expect(card.status).toBe(200);
    expect(card.json.eternalId).toBe(me.json.eternalId);
    expect(card.json.insurance).toBeUndefined(); // pacjent nie zaznaczył ubezpieczenia do pokazania
    const log = getDb().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE subtype = 'emergency-access' AND patient_ref = ?").get(fx.patient.ref) as { n: number };
    expect(log.n).toBe(1);
    await pt.req('DELETE', `/api/me/eternal-id/links/${link.json.link.id}`);
    expect((await pub.req('GET', `/api/eternal-id/${token}`)).status).toBe(410);
  });
});
