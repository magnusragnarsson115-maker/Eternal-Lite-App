import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readDocument, textractLines } from '../../server/ai/ocr.js';
import { transcribe } from '../../server/ai/stt.js';
import { hashPassword } from '../../server/auth/passwords.js';
import { findUserByFhirRef, updateUser } from '../../server/auth/users.js';
import { config } from '../../server/config.js';
import { getDb } from '../../server/db.js';
import { birthDateFromPesel, resetDocplannerToken, slotsFor } from '../../server/integrations/docplanner.js';
import { answerToEvidence, questionToNode } from '../../server/integrations/infermedica.js';
import { mapDays, mapMeasurements, validicUid } from '../../server/integrations/validic.js';
import { signRequest } from '../../server/lib/sigv4.js';
import { findFreeSlots } from '../../server/services/scheduling.js';
import { runInScope } from '../../server/tenancy.js';
import { Client } from './client.js';
import { orgFixture } from './fixture.js';

/**
 * Integracje partnerów przez API (bez widżetów): Amazon Textract (podpis SigV4), ElevenLabs Scribe v2 Medical,
 * Validic Inform, Docplanner/ZnanyLekarz, Infermedica (tylko po ocenie zgodności MDR), przeglądarka 3D.
 * Wszystkie wywołania sieciowe podstawione — test sprawdza zapytania i mapowanie odpowiedzi.
 */

type Cfg = Record<string, unknown>;
const set = (path: string[], value: unknown) => {
  let o = config as unknown as Cfg;
  for (const k of path.slice(0, -1)) o = o[k] as Cfg;
  o[path.at(-1)!] = value;
};

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(300, 2)]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('Partnerzy — funkcje czyste', () => {
  it('SigV4: wektor testowy AWS (get-vanilla)', () => {
    const h = signRequest({ method: 'GET', host: 'example.amazonaws.com', region: 'us-east-1', service: 'service', credentials: { accessKeyId: 'AKIDEXAMPLE', secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY' }, now: new Date('2015-08-30T12:36:00Z') });
    expect(h.Authorization).toBe('AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, SignedHeaders=host;x-amz-date, Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31');
  });

  it('Textract: linie z położeniem na stronie', () => {
    const r = textractLines([
      { BlockType: 'PAGE', Page: 1 },
      { BlockType: 'LINE', Text: 'Glukoza  101 H mg/dl', Page: 1, Geometry: { BoundingBox: { Left: 0.1, Top: 0.2, Width: 0.5, Height: 0.02 } } },
      { BlockType: 'WORD', Text: 'Glukoza' },
    ]);
    expect(r.pages).toBe(1);
    expect(r.lines).toEqual([{ page: 1, text: 'Glukoza 101 H mg/dl', box: [0.1, 0.2, 0.6, 0.22] }]);
  });

  it('Validic: pomiary, kroki i sen z rekordów API; przeliczenie jednostek; identyfikator bez danych osobowych', () => {
    const m = mapMeasurements([
      { id: 'm1', start_time: '2026-10-30T07:10:00Z', source: { type: 'omron', device: { manufacturer: 'Omron', model: 'M7' } }, metrics: [{ type: 'systolic', unit: 'mmHg', value: 138 }, { type: 'diastolic', unit: 'mmHg', value: 86 }, { type: 'pulse', unit: 'bpm', value: 71 }] },
      { id: 'm2', start_time: '2026-10-30T07:12:00Z', metrics: [{ type: 'body_weight', unit: 'lb', value: 180 }, { type: 'blood_glucose', unit: 'mmol/L', value: 5.5 }] },
    ]);
    expect(m.find((x) => x.kind === 'bp')).toMatchObject({ systolic: 138, diastolic: 86, pulse: 71, source: 'rpm:validic', device: 'Omron M7', externalId: 'validic:m1:bp' });
    expect(m.find((x) => x.kind === 'weight')?.value).toBe(81.6);
    expect(m.find((x) => x.kind === 'glucose')?.value).toBe(99);
    const d = mapDays([{ start_time: '2026-10-30T00:00:00Z', metrics: [{ type: 'steps', value: 8012 }] }], [{ start_time: '2026-10-29T23:10:00Z', end_time: '2026-10-30T06:40:00Z', metrics: [{ type: 'sleep_duration', unit: 's', value: 27000 }, { type: 'deep_sleep', unit: 's', value: 5400 }] }], '2026-11-03');
    expect(d.days).toEqual([{ date: '2026-10-30', steps: 8012, sleep: { minutes: 450, deep: 90, light: undefined, rem: undefined, awake: undefined, start: '2026-10-29T23:10:00Z', end: '2026-10-30T06:40:00Z' } }]);
    expect(validicUid('Patient/abc')).toMatch(/^etr-[0-9a-f]{32}$/);
    expect(birthDateFromPesel('85041212345')).toBe('1985-04-12');
    expect(birthDateFromPesel('02270812345')).toBe('2002-07-08');
  });

  it('Infermedica: pytania silnika → czat i odpowiedzi → dowody (bez zmiany treści)', () => {
    const single = { type: 'single' as const, text: 'Czy masz gorączkę?', items: [{ id: 's_98', name: 'Gorączka', choices: [{ id: 'present', label: 'Tak' }, { id: 'absent', label: 'Nie' }, { id: 'unknown', label: 'Nie wiem' }] }] };
    expect(questionToNode(single, 1)).toMatchObject({ id: 'q1', type: 'single', text: 'Czy masz gorączkę?', options: [{ value: 'present', label: 'Tak' }, { value: 'absent', label: 'Nie' }, { value: 'unknown', label: 'Nie wiem' }] });
    expect(answerToEvidence(single, 'absent')).toEqual([{ id: 's_98', choice_id: 'absent' }]);
    const multi = { type: 'group_multiple' as const, text: 'Zaznacz objawy', items: [{ id: 's_1', name: 'Kaszel', choices: [] }, { id: 's_2', name: 'Katar', choices: [] }] };
    expect(answerToEvidence(multi, ['s_2'])).toEqual([{ id: 's_1', choice_id: 'absent' }, { id: 's_2', choice_id: 'present' }]);
    expect(() => answerToEvidence(multi, ['s_9'])).toThrow();
  });
});

describe('Partnerzy — API', () => {
  let fx: Awaited<ReturnType<typeof orgFixture>>;
  let pt: Client;
  let userId: string;
  const PW = 'Partnerzy-API-2026';

  beforeAll(async () => {
    fx = await orgFixture({ patientAccount: true });
    const u = findUserByFhirRef(fx.patient.ref)!;
    userId = u.id;
    updateUser(u.id, { password_hash: await hashPassword(PW) });
    pt = new Client(fx.app);
    await pt.req('POST', '/api/auth/login', { email: u.email, password: PW });
  });
  afterAll(async () => {
    await fx?.app.close();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Amazon Textract: podpisane zapytanie do regionu Frankfurt, linie do parsera wyników', async () => {
    set(['ocr', 'provider'], 'textract');
    set(['ocr', 'textract', 'accessKeyId'], 'AKIDTEST');
    set(['ocr', 'textract', 'secretAccessKey'], 'secret-test');
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return json({ Blocks: [{ BlockType: 'PAGE' }, { BlockType: 'LINE', Text: 'Hemoglobina 13,9 g/dl 12 - 16', Page: 1, Geometry: { BoundingBox: { Left: 0.1, Top: 0.3, Width: 0.6, Height: 0.03 } } }] });
      }),
    );
    const r = await readDocument(PNG, 'image/png');
    expect(r.provider).toBe('textract');
    expect(r.lines[0].text).toBe('Hemoglobina 13,9 g/dl 12 - 16');
    expect(calls[0].url).toBe('https://textract.eu-central-1.amazonaws.com/');
    const h = calls[0].init.headers as Record<string, string>;
    expect(h['x-amz-target']).toBe('Textract.DetectDocumentText');
    expect(h.Authorization).toMatch(/^AWS4-HMAC-SHA256 Credential=AKIDTEST\/\d{8}\/eu-central-1\/textract\/aws4_request, SignedHeaders=content-type;host;x-amz-date;x-amz-target, Signature=[0-9a-f]{64}$/);
    set(['ocr', 'provider'], '');
  });

  it('ElevenLabs Scribe v2 Medical: model medyczny, liczba mówców, słownik terminów, tryb zerowej retencji', async () => {
    set(['stt', 'provider'], 'elevenlabs');
    set(['stt', 'elevenlabs', 'apiKey'], 'xi-test');
    set(['stt', 'elevenlabs', 'keyterms'], true);
    set(['stt', 'elevenlabs', 'zeroRetention'], true);
    let form: FormData | undefined;
    let calledUrl = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calledUrl = url;
        form = init.body as FormData;
        return json({ text: 'Dzień dobry.', words: [{ text: 'Dzień', start: 0, end: 0.4, type: 'word', speaker_id: 'speaker_0' }, { text: ' dobry.', start: 0.4, end: 0.8, type: 'word', speaker_id: 'speaker_0' }] });
      }),
    );
    const t = await transcribe(Buffer.alloc(2000, 1), 'audio/webm', { speakers: 3, keyterms: ['Atorwastatyna', 'Kreatynina'] });
    expect(t.provider).toBe('elevenlabs');
    expect(t.model).toBe('scribe_v2_medical');
    expect(t.segments[0]).toMatchObject({ speaker: 'speaker_0', start: 0, end: 0.8 });
    expect(calledUrl).toBe('https://api.eu.residency.elevenlabs.io/v1/speech-to-text?enable_logging=false');
    expect(form!.get('model_id')).toBe('scribe_v2_medical');
    expect(form!.get('num_speakers')).toBe('3');
    expect(form!.getAll('keyterms')).toEqual(['Atorwastatyna', 'Kreatynina']);
    set(['stt', 'provider'], '');
    set(['stt', 'elevenlabs', 'apiKey'], '');
  });

  it('Validic: połączenie (link do Marketplace) i pobranie danych przez API; identyfikator bez danych osobowych', async () => {
    expect((await pt.req('POST', '/api/me/validic/connect')).status).toBe(409);
    set(['validic', 'orgId'], 'org-test');
    set(['validic', 'token'], 'tok-test');
    const urls: string[] = [];
    const bodies: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        urls.push(url);
        if (init.body) bodies.push(String(init.body));
        if (url.includes('/users?') && init.method === 'POST') return json({ id: 'v-1', uid: 'x', marketplace: { url: 'https://marketplace.validic.com/x' } }, 201);
        if (url.includes('/measurements')) return json({ data: [{ id: 'm1', start_time: '2026-11-01T07:00:00Z', source: { type: 'omron' }, metrics: [{ type: 'systolic', unit: 'mmHg', value: 131 }, { type: 'diastolic', unit: 'mmHg', value: 84 }] }] });
        if (url.includes('/summaries')) return json({ data: [{ start_time: '2026-11-01T00:00:00Z', metrics: [{ type: 'steps', value: 6400 }] }] });
        if (url.includes('/sleep')) return json({ data: [] });
        return json({}, 404);
      }),
    );
    const c = await pt.req('POST', '/api/me/validic/connect');
    expect(c.json.marketplaceUrl).toBe('https://marketplace.validic.com/x');
    expect(bodies[0]).not.toContain('Linkowa');
    expect(bodies[0]).toContain(validicUid(fx.patient.ref));
    const s = await pt.req('POST', '/api/me/validic/sync');
    expect(s.json).toEqual({ measurements: 1, days: 1 });
    expect(urls.some((u) => u.includes('token=tok-test') && u.includes('start_date='))).toBe(true);
    const m = await pt.req('GET', '/api/me/measurements');
    expect(m.json.items.some((x: { source: string; systolic?: number }) => x.source === 'rpm:validic' && x.systolic === 131)).toBe(true);
    // pomiar z platformy RPM trafia do kolejki lekarza („Nowe pomiary z telemonitoringu”)
    const q = await fx.clients.doctor.req('GET', '/api/staff/workspace?scope=all');
    expect(q.json.items.some((i: { kind: string }) => i.kind === 'rpm')).toBe(true);
    expect((await pt.req('GET', '/api/me/validic')).json.connected).toBe(true);
  });

  it('ZnanyLekarz/Docplanner: OAuth2, terminy do ZnanyLekarz, rezerwacja wraca jako wizyta, odwołanie', async () => {
    set(['docplanner', 'clientId'], 'cid');
    set(['docplanner', 'clientSecret'], 'csec');
    resetDocplannerToken();
    const slot = (await runInScope({ orgId: fx.orgId }, () => findFreeSlots({ serviceId: fx.ctx.service.id, practitionerId: fx.ctx.doctor.id, from: `${fx.day}T00:00:00Z`, to: `${fx.day}T23:59:59Z` })))[1];
    let bookingStatus = 'booked';
    const puts: unknown[] = [];
    let auth = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        const h = (init.headers ?? {}) as Record<string, string>;
        if (url.endsWith('/oauth/v2/token')) {
          auth = h.Authorization;
          expect(String(init.body)).toContain('grant_type=client_credentials');
          expect(String(init.body)).toContain('scope=integration');
          return json({ access_token: 'tok', expires_in: 3600 });
        }
        expect(h.Authorization).toBe('Bearer tok');
        if (url.endsWith('/facilities')) return json({ _items: [{ id: 11, name: 'Klinika testowa' }] });
        if (init.method === 'PUT' && url.endsWith('/slots')) {
          puts.push(JSON.parse(String(init.body)));
          return new Response(null, { status: 204 });
        }
        if (url.includes('/bookings?'))
          return json({ _items: [{ id: 501, status: bookingStatus, start_at: slot.start, end_at: slot.end, patient: { name: 'Ewa', surname: 'Zielona', phone: '+48600999888', email: 'ewa@example.com', nin: '85041212344' }, address_service: { id: 77 } }] });
        return json({}, 404);
      }),
    );
    expect(auth).toBe('');
    const f = await fx.clients.admin.req('GET', '/api/admin/docplanner/facilities');
    expect(f.json.items).toEqual([{ id: '11', name: 'Klinika testowa' }]);
    expect(auth).toBe(`Basic ${Buffer.from('cid:csec').toString('base64')}`);
    expect((await fx.clients.doctor.req('PUT', '/api/admin/docplanner/mapping', { facilityId: '11', doctors: [] })).status).toBe(403);
    const m = await fx.clients.admin.req('PUT', '/api/admin/docplanner/mapping', { facilityId: '11', doctors: [{ practitionerId: fx.ctx.doctor.id, doctorId: '21', addressId: '31', services: [{ serviceId: fx.ctx.service.id, addressServiceId: '77' }] }] });
    expect(m.status).toBe(200);
    const s1 = await fx.clients.admin.req('POST', '/api/admin/docplanner/sync');
    expect(s1.json.bookings).toEqual({ created: 1, cancelled: 0, skipped: 0 });
    const sent = puts.at(-1) as { slots: { start: string; address_services: { address_service_id: number; duration: number }[] }[] };
    expect(sent.slots.length).toBeGreaterThan(3);
    expect(sent.slots[0].address_services[0]).toMatchObject({ address_service_id: 77 });
    expect(sent.slots.some((x) => x.start === slot.start)).toBe(false); // zarezerwowany termin zniknął z wolnych
    const booked = getDb().prepare("SELECT value FROM setting WHERE key = ?").get(`docplanner-booking:${fx.orgId}:501`) as { value: string };
    const apptId = JSON.parse(booked.value) as string;
    const appt = await fx.clients.doctor.req('GET', `/api/staff/appointments/${apptId}`);
    expect(appt.json.comment ?? appt.json.appointment?.comment).toContain('ZnanyLekarz #501');
    // druga synchronizacja nie dubluje; odwołanie w ZnanyLekarz odwołuje wizytę
    expect((await fx.clients.admin.req('POST', '/api/admin/docplanner/sync')).json.bookings.created).toBe(0);
    bookingStatus = 'canceled';
    expect((await fx.clients.admin.req('POST', '/api/admin/docplanner/sync')).json.bookings.cancelled).toBe(1);
    // terminy liczone z kalendarza Eternal
    const free = await runInScope({ orgId: fx.orgId }, () => slotsFor({ practitionerId: fx.ctx.doctor.id, doctorId: '21', addressId: '31', services: [{ serviceId: fx.ctx.service.id, addressServiceId: '77' }] }, `${fx.day}T00:00:00Z`, `${fx.day}T23:59:59Z`));
    expect(free.some((x) => x.start === slot.start)).toBe(true);
  });

  it('Infermedica: zablokowany bez oceny zgodności MDR; po odblokowaniu — pytania silnika i zalecenie z oznaczeniem źródła', async () => {
    set(['infermedica', 'appId'], 'app');
    set(['infermedica', 'appKey'], 'key');
    expect((await pt.req('POST', '/api/me/interviews/engine', { text: 'boli mnie głowa', sex: 'female', age: 40 })).status).toBe(409);
    expect((await pt.req('GET', '/api/me/interviews')).json.engine.available).toBe(false);
    expect((await fx.clients.admin.req('PUT', '/api/admin/infermedica/regulatory', { reference: 'x', confirmedBy: 'y' })).status).toBe(400);
    expect((await fx.clients.admin.req('PUT', '/api/admin/infermedica/regulatory', { reference: 'Deklaracja zgodności DoC-2026-11 (klasa IIb)', confirmedBy: 'Jan Kowalski, PRRC' })).status).toBe(200);
    const sent: { url: string; headers: Record<string, string>; body: string }[] = [];
    let diag = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        sent.push({ url, headers: init.headers as Record<string, string>, body: String(init.body) });
        if (url.endsWith('/parse')) return json({ mentions: [{ id: 's_21', name: 'Headache', common_name: 'Ból głowy', choice_id: 'present' }] });
        if (url.endsWith('/diagnosis')) {
          diag++;
          return diag === 1
            ? json({ question: { type: 'single', text: 'Czy masz gorączkę?', items: [{ id: 's_98', name: 'Gorączka', choices: [{ id: 'present', label: 'Tak' }, { id: 'absent', label: 'Nie' }, { id: 'unknown', label: 'Nie wiem' }] }] }, should_stop: false })
            : json({ question: null, should_stop: true });
        }
        if (url.endsWith('/triage')) return json({ triage_level: 'consultation', serious: [] });
        return json({}, 404);
      }),
    );
    const s = await pt.req('POST', '/api/me/interviews/engine', { text: 'od rana boli mnie głowa', appointmentId: fx.appt.id, sex: 'female', age: 40 });
    expect(s.status).toBe(200);
    expect(s.json.engine).toBe('infermedica');
    expect(s.json.current).toMatchObject({ id: 'q1', text: 'Czy masz gorączkę?' });
    const a = await pt.req('POST', `/api/me/interviews/${s.json.id}/answer`, { nodeId: 'q1', value: 'absent' });
    expect(a.json.status).toBe('completed');
    expect(a.json.engineResult).toMatchObject({ triageLevel: 'consultation', label: 'Umów konsultację lekarską.' });
    expect(a.json.engineResult.source).toMatch(/Infermedica/);
    expect(a.json.summary.reason).toEqual(['Ból głowy']);
    expect(a.json.summary.negatives).toEqual(['Gorączka']);
    expect(sent[0].headers['App-Id']).toBe('app');
    expect(sent[0].headers['Interview-Id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(sent.every((x) => !x.body.includes('Linkowa') && !x.body.includes('Maria'))).toBe(true);
    // lekarz widzi podsumowanie z wywiadu przy wizycie
    const st = await fx.clients.doctor.req('GET', `/api/staff/patients/${fx.patient.patient.id}/interviews`);
    expect(st.json.items[0].engineResult.triageLevel).toBe('consultation');
    await fx.clients.admin.req('DELETE', '/api/admin/infermedica/regulatory');
    set(['infermedica', 'appId'], '');
  });

  it('Przeglądarka 3D badań obrazowych: link z identyfikatorem rekordu (bez PESEL), tylko dla lekarza, wpis w dzienniku', async () => {
    const id = fx.patient.patient.id!;
    expect((await fx.clients.doctor.req('GET', `/api/staff/patients/${id}/imaging-viewer`)).json.configured).toBe(false);
    set(['imagingViewer', 'url'], 'https://viewer.example/launch?patient={patientId}&eid={eternalId}');
    const r = await fx.clients.doctor.req('GET', `/api/staff/patients/${id}/imaging-viewer`);
    expect(r.json.url).toMatch(new RegExp(`patient=${id}&eid=ETR-`));
    expect((await fx.clients.reception.req('GET', `/api/staff/patients/${id}/imaging-viewer`)).status).toBe(403);
    const n = getDb().prepare("SELECT COUNT(*) AS n FROM audit_log WHERE subtype = 'imaging-viewer-launch' AND patient_ref = ?").get(fx.patient.ref) as { n: number };
    expect(n.n).toBe(1);
    set(['imagingViewer', 'url'], '');
  });

  void userId;
});
