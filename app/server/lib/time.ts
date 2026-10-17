/**
 * Czas lokalny placówki. Sloty definiuje się w czasie lokalnym (np. 08:00 w Warszawie),
 * a przechowuje w UTC (FHIR instant). Konwersja uwzględnia zmianę czasu letni/zimowy.
 */

function tzOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** "2026-10-05" + "08:30" w strefie placówki → Date (UTC). */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const offset = tzOffsetMinutes(guess, timeZone);
  const result = new Date(guess.getTime() - offset * 60_000);
  // korekta na granicy zmiany czasu
  const offset2 = tzOffsetMinutes(result, timeZone);
  return offset2 === offset ? result : new Date(guess.getTime() - offset2 * 60_000);
}

/** Data kalendarzowa (YYYY-MM-DD) chwili w strefie placówki. */
export function localDate(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** Dzień tygodnia 1 (pon) … 7 (niedz) dla daty kalendarzowej. */
export function isoWeekday(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export function formatLocal(iso: string, timeZone: string, locale = 'pl-PL'): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** Wielkanoc (algorytm Meeusa/Jonesa/Butchera), zwraca YYYY-MM-DD. */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Dni ustawowo wolne od pracy w Polsce (ustawa z 18.01.1951 r. o dniach wolnych od pracy).
 * Wigilia (24.12) jest dniem wolnym od 2025 r.
 */
export function polishHolidays(year: number): Map<string, string> {
  const easter = easterSunday(year);
  const y = String(year);
  const list: [string, string][] = [
    [`${y}-01-01`, 'Nowy Rok'],
    [`${y}-01-06`, 'Święto Trzech Króli'],
    [easter, 'Wielkanoc'],
    [addDays(easter, 1), 'Poniedziałek Wielkanocny'],
    [`${y}-05-01`, 'Święto Pracy'],
    [`${y}-05-03`, 'Święto Konstytucji 3 Maja'],
    [addDays(easter, 49), 'Zielone Świątki'],
    [addDays(easter, 60), 'Boże Ciało'],
    [`${y}-08-15`, 'Wniebowzięcie NMP'],
    [`${y}-11-01`, 'Wszystkich Świętych'],
    [`${y}-11-11`, 'Narodowe Święto Niepodległości'],
    [`${y}-12-25`, 'Boże Narodzenie (pierwszy dzień)'],
    [`${y}-12-26`, 'Boże Narodzenie (drugi dzień)'],
  ];
  if (year >= 2025) list.push([`${y}-12-24`, 'Wigilia Bożego Narodzenia']);
  return new Map(list);
}

export function holidayName(date: string): string | undefined {
  return polishHolidays(Number(date.slice(0, 4))).get(date);
}
