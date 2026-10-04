import { describe, expect, it } from 'vitest';
import { passwordProblems, hashPassword, verifyPassword } from '../../server/auth/passwords.js';
import { base32Decode, base32Encode, totpCode, verifyTotp } from '../../server/auth/totp.js';
import { appointmentIcs } from '../../server/lib/ics.js';
import { addDays, easterSunday, holidayName, isoWeekday, polishHolidays, zonedToUtc } from '../../server/lib/time.js';
import { isValidPesel, peselBirthDate, peselGender } from '../../server/lib/util.js';

function withCheckDigit(first10: string): string {
  const w = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  const sum = w.reduce((a, x, i) => a + x * Number(first10[i]), 0);
  return first10 + String((10 - (sum % 10)) % 10);
}

describe('PESEL', () => {
  it('weryfikuje sumę kontrolną i datę', () => {
    const p = withCheckDigit('9005050123');
    expect(isValidPesel(p)).toBe(true);
    expect(peselBirthDate(p)).toBe('1990-05-05');
    expect(peselGender(p)).toBe('male');
    expect(isValidPesel(p.slice(0, 10) + String((Number(p[10]) + 1) % 10))).toBe(false);
  });
  it('obsługuje urodzonych po 2000 r. (miesiąc + 20)', () => {
    const p = withCheckDigit('0322150124');
    expect(peselBirthDate(p)).toBe('2003-02-15');
    expect(peselGender(p)).toBe('female');
  });
  it('odrzuca nieistniejącą datę', () => {
    expect(isValidPesel(withCheckDigit('9002300123'))).toBe(false);
  });
});

describe('Kalendarz i strefa czasowa', () => {
  it('wyznacza Wielkanoc', () => {
    expect(easterSunday(2024)).toBe('2024-03-31');
    expect(easterSunday(2025)).toBe('2025-04-20');
    expect(easterSunday(2026)).toBe('2026-04-05');
  });
  it('zna dni wolne, w tym Wigilię od 2025 r. i Boże Ciało', () => {
    expect(holidayName('2025-12-24')).toBeDefined();
    expect(holidayName('2024-12-24')).toBeUndefined();
    expect(holidayName('2026-06-04')).toBe('Boże Ciało');
    expect(holidayName('2026-11-11')).toBeDefined();
    expect(polishHolidays(2026).size).toBe(14);
  });
  it('przelicza czas lokalny Warszawy na UTC z uwzględnieniem zmiany czasu', () => {
    expect(zonedToUtc('2026-01-15', '08:00', 'Europe/Warsaw').toISOString()).toBe('2026-01-15T07:00:00.000Z');
    expect(zonedToUtc('2026-07-15', '08:00', 'Europe/Warsaw').toISOString()).toBe('2026-07-15T06:00:00.000Z');
    expect(zonedToUtc('2026-03-29', '08:00', 'Europe/Warsaw').toISOString()).toBe('2026-03-29T06:00:00.000Z');
    expect(zonedToUtc('2026-10-25', '08:00', 'Europe/Warsaw').toISOString()).toBe('2026-10-25T07:00:00.000Z');
  });
  it('liczy dni tygodnia i przesunięcia', () => {
    expect(isoWeekday('2026-10-04')).toBe(7);
    expect(isoWeekday('2026-10-05')).toBe(1);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('TOTP (RFC 6238)', () => {
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  it('koduje base32 zgodnie z RFC 4648', () => {
    expect(secret).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
    expect(base32Decode(secret).toString()).toBe('12345678901234567890');
  });
  it('zgadza się z wektorami testowymi RFC', () => {
    expect(totpCode(secret, 59_000)).toBe('287082');
    expect(totpCode(secret, 1_111_111_109_000)).toBe('081804');
    expect(totpCode(secret, 1_234_567_890_000)).toBe('005924');
  });
  it('akceptuje dryf ±30 s i odrzuca starsze kody', () => {
    const now = 1_234_567_890_000;
    expect(verifyTotp(secret, totpCode(secret, now - 30_000), now)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, now - 90_000), now)).toBe(false);
    expect(verifyTotp(secret, 'abc123', now)).toBe(false);
  });
});

describe('Hasła', () => {
  it('hashuje scrypt i weryfikuje', async () => {
    const h = await hashPassword('Bardzo-Dlugie-Haslo-123');
    expect(h.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('Bardzo-Dlugie-Haslo-123', h)).toBe(true);
    expect(await verifyPassword('inne', h)).toBe(false);
  });
  it('wykrywa słabe hasła i dane osobowe', () => {
    expect(passwordProblems('krotkie', 10)).toContain('too_short');
    expect(passwordProblems('qwertyuiop', 10)).toContain('too_common');
    expect(passwordProblems('kowalska2026!!', 10, ['Kowalska'])).toContain('contains_personal_data');
    expect(passwordProblems('Spokojny-Poranek-42', 10)).toEqual([]);
  });
});

describe('iCalendar', () => {
  it('generuje poprawny plik z zawijaniem linii', () => {
    const ics = appointmentIcs({ uid: 'x@eternal', start: '2026-10-05T07:00:00Z', end: '2026-10-05T07:20:00Z', summary: 'Wizyta — ' + 'ą'.repeat(60), location: 'ul. Przykładowa 1, Warszawa' });
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('DTSTART:20261005T070000Z');
    expect(ics).toContain('LOCATION:ul. Przykładowa 1\\, Warszawa');
    for (const line of ics.split('\r\n')) expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
  });
});
