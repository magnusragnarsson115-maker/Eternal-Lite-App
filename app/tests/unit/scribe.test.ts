import type { Composition } from '@medplum/fhirtypes';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getDb } from '../../server/db.js';
import { fhirSystem } from '../../server/fhir/index.js';
import { pdfAvailable } from '../../server/pdf/render.js';
import { correctedRatio, validateNote, type NoteDoc } from '../../server/services/scribe.js';
import { Client, waitFor } from './client.js';
import { orgFixture } from './fixture.js';
import { multipart } from './helpers.js';

describe('Eternal Scribe i karta „Po wizycie”', () => {
  let fx: Awaited<ReturnType<typeof orgFixture>>;
  let sessionId = '';

  beforeAll(async () => {
    fx = await orgFixture();
  });
  afterAll(async () => {
    await fx?.app.close();
  });

  it('walidator: liczby i kody muszą wystąpić w cytowanych fragmentach', () => {
    const note: NoteDoc = {
      templateId: 'general',
      templateVersion: 'x',
      sections: [{ key: 'badanie', title: 'Badanie', paragraphs: [{ id: 'a', text: 'RR 148/92, tętno 80. Rozpoznanie I10.', sources: ['S1'] }, { id: 'b', text: 'Bez źródła.', sources: [] }] }],
    };
    const v = validateNote(note, { provider: 'demo', segments: [{ id: 'S1', text: 'Ciśnienie 148 na 92, tętno 78.' }] });
    const [a, b] = v.sections[0].paragraphs;
    expect(a.problems?.join(' ')).toContain('80');
    expect(a.problems?.join(' ')).toContain('I10');
    expect(b.problems?.[0]).toContain('Brak odnośnika');
    expect(correctedRatio(note, { ...note, sections: [{ ...note.sections[0], paragraphs: [{ ...note.sections[0].paragraphs[0] }] }] })).toBe(0.333);
  });

  it('bez zgody pacjenta nie da się rozpocząć nagrania; rejestracja nie ma dostępu', async () => {
    const base = { patientId: fx.patient.patient.id, appointmentId: fx.appt.id, templateId: 'general' };
    expect((await fx.clients.doctor.req('POST', '/api/staff/scribe', { ...base, consent: false })).status).toBe(400);
    expect((await fx.clients.reception.req('POST', '/api/staff/scribe', { ...base, consent: true })).status).toBe(403);
    const res = await fx.clients.doctor.req('POST', '/api/staff/scribe', { ...base, consent: true, consentNote: 'zgoda ustna' });
    expect(res.status).toBe(200);
    expect(res.json.status).toBe('consented');
    sessionId = res.json.id;
  });

  it('nagranie → transkrypcja → szkic ze źródłami (tryb demonstracyjny)', async () => {
    const up = multipart({ seconds: '95' }, { name: 'file', filename: 'wizyta.webm', contentType: 'audio/webm', data: Buffer.alloc(4096, 1) });
    const res = await fx.clients.doctor.upload(`/api/staff/scribe/${sessionId}/audio`, up.payload, up.contentType);
    expect(res.status).toBe(200);
    const draft = await waitFor(async () => {
      const r = await fx.clients.doctor.req('GET', `/api/staff/scribe/${sessionId}`);
      return ['draft', 'failed'].includes(r.json.status) ? r.json : undefined;
    });
    expect(draft.status).toBe('draft');
    expect(draft.ai.demo).toBe(true);
    const paras = draft.note.sections.flatMap((s: { paragraphs: { sources: string[] }[] }) => s.paragraphs);
    expect(paras.length).toBeGreaterThan(3);
    expect(paras.every((p: { sources: string[] }) => p.sources.length > 0)).toBe(true);
    // inny lekarz tej kliniki nie widzi cudzej sesji; inna klinika — wcale
    expect((await fx.clients.other.req('GET', `/api/staff/scribe/${sessionId}`)).status).toBe(404);
  });

  it('edycja, zatwierdzenie: Composition z oznaczeniem AI, pola do systemu gabinetowego, odsetek poprawek', async () => {
    const s = (await fx.clients.doctor.req('GET', `/api/staff/scribe/${sessionId}`)).json;
    const sections = s.note.sections.map((sec: { key: string; paragraphs: { id: string; text: string }[] }, i: number) => ({
      key: sec.key,
      paragraphs: [...sec.paragraphs.map((p, j) => ({ id: p.id, text: i === 0 && j === 0 ? p.text.replace(/\.$/, ', według relacji pacjentki.') : p.text })), ...(sec.key === 'rozpoznanie' ? [{ text: 'Podejrzenie nadciśnienia tętniczego — do potwierdzenia pomiarami.' }] : [])],
    }));
    const saved = await fx.clients.doctor.req('PUT', `/api/staff/scribe/${sessionId}/note`, { sections });
    expect(saved.status).toBe(200);
    const added = saved.json.note.sections.find((x: { key: string }) => x.key === 'rozpoznanie').paragraphs.at(-1);
    expect(added.addedByDoctor).toBe(true);
    const ok = await fx.clients.doctor.req('POST', `/api/staff/scribe/${sessionId}/approve`);
    expect(ok.json.status).toBe('approved');
    expect(ok.json.correctedRatio).toBeGreaterThan(0);
    const comp = await fhirSystem().read<Composition>('Composition', ok.json.compositionRef.split('/')[1]);
    expect(comp.meta?.tag?.some((t) => t.code === 'ai-assisted-approved')).toBe(true);
    expect(comp.attester?.[0].mode).toBe('legal');
    const exp = await fx.clients.doctor.req('GET', `/api/staff/scribe/${sessionId}/export`);
    expect(exp.json.fields.map((f: { field: string }) => f.field)).toEqual(['Wywiad', 'Badanie przedmiotowe', 'Rozpoznanie', 'Zalecenia']);
    const amend = await fx.clients.doctor.req('POST', `/api/staff/scribe/${sessionId}/amend`, { sections, reason: 'Uzupełnienie po wizycie' });
    expect(amend.status).toBe(200);
    expect((await fx.clients.doctor.req('GET', `/api/staff/scribe/${sessionId}/versions`)).json.items.length).toBe(2);
  });

  it('karta „Po wizycie”: szkic → akceptacja → SMS z linkiem → strona i przekazanie osobie upoważnionej', async () => {
    const draft = await fx.clients.doctor.req('POST', `/api/staff/scribe/${sessionId}/card`);
    expect(draft.json.summaryStatus).toBe('draft');
    const card = { ...draft.json.summary, erecipeCode: '1234' };
    delete card.problems;
    expect((await fx.clients.doctor.req('PUT', `/api/staff/scribe/${sessionId}/card`, card)).status).toBe(200);
    const sent = await fx.clients.doctor.req('POST', `/api/staff/scribe/${sessionId}/card/send`, {});
    expect(sent.json.channel).toBe('sms');
    const sms = getDb().prepare("SELECT body FROM outbox WHERE channel = 'sms' AND related_ref LIKE 'card:%'").get() as { body: string };
    expect(sms.body).toContain('/k/');
    expect(sms.body).not.toMatch(/ciśnieni|cholesterol|1234/i);
    const token = sent.json.url.split('/k/')[1];
    const pub = new Client(fx.app);
    const view = await pub.req('GET', `/api/card/${token}`);
    expect(view.status).toBe(200);
    expect(view.json.card.erecipeCode).toBe('1234');
    expect(view.json.aiLabel).toContain('zatwierdzone przez lekarza');
    const share = await fx.clients.doctor.req('POST', `/api/staff/scribe/${sessionId}/card/authorized`, { phone: '600200300', name: 'Jan Bliski', relation: 'syn', basis: 'art31-6' });
    expect(share.status).toBe(200);
    if (pdfAvailable()) {
      const pdf = await pub.req('GET', `/api/card/${token}/pdf`);
      expect(pdf.raw.subarray(0, 5).toString()).toBe('%PDF-');
      const notePdf = await fx.clients.doctor.req('GET', `/api/staff/scribe/${sessionId}/pdf`);
      expect(notePdf.raw.subarray(0, 5).toString()).toBe('%PDF-');
    }
  });

  it('nagranie usuwane po okresie przechowywania', async () => {
    const { purgeRecordings } = await import('../../server/services/scribe.js');
    getDb().prepare("UPDATE scribe_session SET approved_at = '2020-01-01T00:00:00Z' WHERE id = ?").run(sessionId);
    expect(await purgeRecordings()).toBe(1);
    const s = (await fx.clients.doctor.req('GET', `/api/staff/scribe/${sessionId}`)).json;
    expect(s.audio.present).toBe(false);
    expect(s.transcript).toBeUndefined();
  });
});
