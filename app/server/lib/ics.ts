/** Plik iCalendar (RFC 5545) dla wizyty — import do Google/Apple/Outlook bez zewnętrznego API. */

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function stamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, 'utf8') > 74) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut), 'utf8') > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join('\r\n');
}

export function appointmentIcs(input: {
  uid: string;
  start: string;
  end: string;
  summary: string;
  location?: string;
  description?: string;
  url?: string;
  cancelled?: boolean;
}): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Eternal//Pacjent//PL',
    'CALSCALE:GREGORIAN',
    `METHOD:${input.cancelled ? 'CANCEL' : 'PUBLISH'}`,
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(input.start)}`,
    `DTEND:${stamp(input.end)}`,
    `SUMMARY:${esc(input.summary)}`,
    ...(input.location ? [`LOCATION:${esc(input.location)}`] : []),
    ...(input.description ? [`DESCRIPTION:${esc(input.description)}`] : []),
    ...(input.url ? [`URL:${input.url}`] : []),
    `STATUS:${input.cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Przypomnienie o wizycie',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
