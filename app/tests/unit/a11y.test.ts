import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashPassword } from '../../server/auth/passwords.js';
import { findUserByFhirRef, updateUser } from '../../server/auth/users.js';
import { Client } from './client.js';
import { orgFixture } from './fixture.js';

/** A23.2/A23.3 — ustawienia czytelności zapisane na koncie (wspólne dla przeglądarki i aplikacji mobilnej). */

describe('Czytelność — ustawienia konta', () => {
  let fx: Awaited<ReturnType<typeof orgFixture>>;
  let pt: Client;
  const PW = 'Spokojny-Poranek-42';

  beforeAll(async () => {
    fx = await orgFixture({ patientAccount: true });
    const user = findUserByFhirRef(fx.patient.ref)!;
    updateUser(user.id, { password_hash: await hashPassword(PW) });
    pt = new Client(fx.app);
    expect((await pt.req('POST', '/api/auth/login', { email: user.email, password: PW })).status).toBe(200);
  });
  afterAll(async () => {
    await fx?.app.close();
  });

  it('domyślnie 100%, kontrast według systemu, bez prostego języka; zapis i odczyt w /api/auth/me', async () => {
    expect((await pt.req('GET', '/api/auth/me')).json.user.a11y).toEqual({ textScale: 100, contrast: 'system', simpleLanguage: false });
    const saved = await pt.req('PUT', '/api/auth/a11y', { textScale: 200, contrast: 'high', simpleLanguage: true });
    expect(saved.status).toBe(200);
    expect((await pt.req('GET', '/api/auth/me')).json.user.a11y).toEqual({ textScale: 200, contrast: 'high', simpleLanguage: true });
  });

  it('odrzuca wartości spoza listy', async () => {
    expect((await pt.req('PUT', '/api/auth/a11y', { textScale: 300, contrast: 'high', simpleLanguage: true })).status).toBe(400);
    expect((await pt.req('PUT', '/api/auth/a11y', { textScale: 125, contrast: 'neon', simpleLanguage: false })).status).toBe(400);
    expect((await new Client(fx.app).req('PUT', '/api/auth/a11y', { textScale: 125, contrast: 'high', simpleLanguage: false })).status).toBe(401);
  });
});
