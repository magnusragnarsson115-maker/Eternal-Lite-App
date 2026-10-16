/**
 * Mapa modułów i funkcji do aplikacji (ekran „Moduły i funkcje” w instancji pokazowej).
 *
 *   npm run feature-map      → web/src/shared/feature-map.json
 *
 * Źródło klasyfikacji: docs/FUNKCJE_648.md (wszystkie funkcje rejestru 24_REJESTR_648_FUNKCJI z etapem, statusem
 * i fazą). Tutaj dochodzi tylko „gdzie to jest w aplikacji” dla funkcji działających i pakiet z kolejki dla funkcji,
 * które da się zbudować kodem.
 */
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Miejsce funkcji w aplikacji: `p:` aplikacja pacjenta, `d:` panel lekarza, `r:` rejestracja, `a:` administrator,
 * `pub:` bez logowania, `m` tylko aplikacja mobilna, `b` w tle (bez osobnego ekranu).
 */
const WHERE: Record<string, string> = {
  'F1.1': 'pub:/rejestracja', 'F1.2': 'm', 'F1.3': 'p:/prywatnosc', 'F1.4': 'p:/profil', 'F1.5': 'm', 'F1.6': 'p:/profil',
  'F1.7': 'p:/profil', 'F1.8': 'p:/profil', 'F1.9': 'pub:/logowanie', 'F1.10': 'p:/profil', 'F1.12': 'p:/profil', 'F1.13': 'p:/profil',
  'F1.18': 'm', 'F2.4': 'p:/pomiary', 'F2.5': 'p:/pomiary', 'F2.6': 'p:/pomiary', 'F2.7': 'p:/pomiary', 'F2.14': 'b',
  'F3.1': 'p:/dokumenty', 'F3.2': 'p:/dokumenty', 'F3.3': 'p:/dokumenty', 'F3.4': 'p:/dokumenty', 'F3.5': 'p:/wyniki', 'F3.6': 'p:/wyniki',
  'F3.7': 'p:/dokumenty', 'F3.9': 'p:/dokumenty', 'F3.17': 'b', 'F3.19': 'd:/panel/skrzynka', 'F4.5': 'p:/pomoc', 'F4.6': 'd:/panel/skrzynka',
  'F4.12': 'p:/profil', 'F4.14': 'p:/dzienniki', 'F5.6': 'p:/kalendarz', 'F5.7': 'p:/kalendarz', 'F5.15': 'p:/kalendarz',
  'F6.1': 'p:/wiadomosci', 'F6.2': 'p:/dla-lekarza', 'F6.3': 'p:/wyniki', 'F6.5': 'p:/wizyty', 'F6.8': 'p:/rezerwacja', 'F6.9': 'p:/powiadomienia',
  'F6.10': 'd:/panel/skrzynka', 'F7.3': 'p:/leki', 'F8.1': 'p:/pomoc', 'F8.2': 'p:/dzienniki', 'F8.4': 'p:/pomoc', 'F8.5': 'p:/bezpieczenstwo',
  'F8.14': 'p:/dzienniki?tab=sleep', 'F9.13': 'p:/dzienniki?tab=sleep', 'F9.16': 'p:/rodzina', 'F10.4': 'p:/dokumenty', 'F13.2': 'p:/raport',
  'A1.3': 'p:/pomiary', 'A1.4': 'p:/pomiary', 'A1.5': 'b', 'A1.6': 'p:/pomiary', 'A1.7': 'p:/pomiary', 'A1.10': 'b', 'A1.20': 'p:/pomiary',
  'A2.1': 'p:/dokumenty', 'A2.2': 'p:/dokumenty', 'A2.3': 'p:/dokumenty', 'A2.4': 'p:/wyniki', 'A2.5': 'p:/os-czasu', 'A2.6': 'p:/prywatnosc',
  'A2.7': 'p:/dokumenty', 'A3.1': 'p:/', 'A3.2': 'p:/pomiary', 'A3.3': 'p:/', 'A3.4': 'p:/powiadomienia', 'A4.1': 'p:/raport', 'A4.2': 'p:/raport',
  'A4.3': 'p:/dla-lekarza', 'A4.4': 'p:/dla-lekarza', 'A5.1': 'p:/wizyty', 'A5.2': 'p:/bezpieczenstwo', 'A5.3': 'p:/bezpieczenstwo',
  'A5.4': 'd:/panel/skrzynka', 'A5.5': 'p:/ankiety', 'A5.8': 'p:/powiadomienia', 'A5.10': 'p:/bezpieczenstwo', 'A5.13': 'p:/rodzina',
  'A6.4': 'p:/wyniki', 'A7.6': 'p:/plan', 'A8.1': 'p:/dzienniki', 'A8.6': 'p:/dzienniki?tab=breathing', 'A8.10': 'p:/pomoc', 'A11.3': 'p:/profil',
  'A11.4': 'p:/pomiary', 'A12.1': 'd:/panel/skrzynka', 'A12.2': 'd:/panel/skrzynka', 'A12.3': 'p:/ankiety', 'A12.4': 'p:/wizyty',
  'A12.5': 'd:/panel/skrzynka', 'A14.1': 'p:/bezpieczenstwo', 'A14.2': 'p:/leki', 'A17.4': 'p:/leki', 'A17.6': 'p:/rodzina', 'A17.7': 'b',
  'A17.13': 'p:/kalendarz', 'A17.17': 'p:/dla-lekarza', 'A17.18': 'p:/kalendarz', 'A18.1': 'p:/pomoc', 'A18.2': 'p:/jak-dziala-ai',
  'A18.3': 'p:/jak-dziala-ai', 'A18.4': 'p:/pomoc', 'A18.5': 'd:/panel/mierniki', 'A18.6': 'a:/panel/organizacja?tab=ai',
  'A18.7': 'a:/panel/organizacja?tab=moduly', 'A18.8': 'p:/', 'A18.9': 'a:/panel/organizacja?tab=gotowosc', 'A18.10': 'p:/udostepnianie',
  'A18.11': 'p:/prywatnosc', 'A18.12': 'p:/prywatnosc', 'A19.1': 'd:/panel/skrzynka', 'A19.2': 'd:/panel/skrzynka', 'A19.3': 'p:/bezpieczenstwo',
  'A19.6': 'p:/jak-dziala-ai', 'A19.7': 'a:/panel/organizacja?tab=ai', 'A20.1': 'p:/leki', 'A20.3': 'p:/bezpieczenstwo', 'A20.7': 'p:/historia-zdrowia',
  'A20.9': 'p:/historia-zdrowia', 'A21.1': 'p:/rodzina', 'A21.3': 'p:/dzienniki?tab=pain', 'A21.6': 'p:/rodzina', 'A21.7': 'p:/historia-zdrowia',
  'A21.9': 'p:/historia-zdrowia', 'A21.10': 'p:/rodzina', 'A21.11': 'p:/rodzina', 'A22.1': 'p:/rodzina', 'A22.3': 'p:/dzienniki?tab=pain',
  'A22.4': 'p:/plan', 'A22.5': 'p:/historia-zdrowia', 'A22.6': 'p:/rodzina', 'A22.7': 'p:/profil', 'A23.1': 'p:/profil', 'A23.2': 'p:/profil',
  'A23.3': 'p:/profil', 'A23.4': 'p:/profil', 'A23.5': 'p:/bezpieczenstwo', 'A24.1': 'p:/rodzina', 'A24.2': 'p:/rodzina', 'A24.3': 'p:/rodzina',
  'A24.4': 'p:/udostepnianie', 'A24.5': 'a:/panel/organizacja?tab=ratunkowy', 'A24.7': 'p:/dla-lekarza', 'D1.1': 'p:/profil',
  'D1.2': 'p:/os-czasu', 'D1.3': 'p:/pomiary', 'D1.4': 'p:/prywatnosc', 'D1.5': 'a:/panel/organizacja?tab=gotowosc', 'D1.6': 'b',
  'D2.3': 'd:/panel/skrzynka', 'D4.7': 'p:/os-czasu', 'D5.3': 'b', 'D5.4': 'p:/prywatnosc', 'S4.1': 'p:/wizyty', 'S4.2': 'p:/bezpieczenstwo',
  'S4.5': 'p:/rodzina',
};

type Status = 'done' | 'new' | 'partial' | 'queue' | 'blocked' | 'unclear';

interface Item {
  id: string;
  name: string;
  stage: string;
  project: string;
  status: Status;
  reason?: string;
  note: string;
  where?: string;
  pkg?: string;
}

const STATUS: [RegExp, Status][] = [
  [/^✅/, 'done'],
  [/^🆕/, 'new'],
  [/^🟡/, 'partial'],
  [/^🔧/, 'queue'],
  [/^⛔/, 'blocked'],
  [/^❔/, 'unclear'],
];

function cells(line: string): string[] {
  return line
    .slice(1, -1)
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|'));
}

/** „F15.1–F15.7, A9.2” → pojedyncze identyfikatory. */
function expandIds(list: string): string[] {
  const out: string[] = [];
  for (const part of list.split(',').map((s) => s.trim())) {
    const m = /^([A-Z]+\d+\.)(\d+)[–-](?:[A-Z]+\d+\.)?(\d+)$/.exec(part);
    if (m) for (let i = Number(m[2]); i <= Number(m[3]); i++) out.push(`${m[1]}${i}`);
    else out.push(part);
  }
  return out;
}

function main() {
  const md = readFileSync('docs/FUNKCJE_648.md', 'utf8').split('\n');
  const groups: { title: string; products: { name: string; items: Item[] }[] }[] = [];
  const pkgOf = new Map<string, string>();
  let section: 'pre' | 'list' | 'queue' | 'post' = 'pre';
  for (const line of md) {
    if (line.startsWith('## ')) {
      const title = line.slice(3).trim();
      if (title.startsWith('Co mogę zbudować')) section = 'queue';
      else if (title.startsWith('Czego nie mogę') || title.startsWith('Co jest potrzebne')) section = 'post';
      else if (section === 'list' || title === 'Aplikacja pacjenta — rdzeń') {
        section = 'list';
        groups.push({ title, products: [] });
      }
      continue;
    }
    if (section === 'list' && line.startsWith('### ')) {
      const name = line.slice(4).replace(/\s*\(\d+\)\s*$/, '').trim();
      groups.at(-1)!.products.push({ name, items: [] });
      continue;
    }
    if (!line.startsWith('| ') || line.startsWith('|---')) continue;
    const c = cells(line);
    if (section === 'list' && c.length === 6 && c[0] !== 'ID') {
      const [id, name, stage, project, label, note] = c;
      const status = STATUS.find(([re]) => re.test(label))?.[1];
      if (!status) throw new Error(`Nieznany status: ${label} (${id})`);
      const item: Item = { id, name, stage, project, status, note };
      if (status === 'blocked') item.reason = label.replace(/^⛔\s*/, '');
      if ((status === 'done' || status === 'new' || status === 'partial') && WHERE[id]) item.where = WHERE[id];
      groups.at(-1)!.products.at(-1)!.items.push(item);
    } else if (section === 'queue' && c.length === 5 && /^\d+$/.test(c[0])) {
      for (const id of expandIds(c[2])) pkgOf.set(id, `${c[0]}. ${c[1]}`);
    }
  }
  const all = groups.flatMap((g) => g.products.flatMap((p) => p.items));
  for (const i of all) if (i.status === 'queue') i.pkg = pkgOf.get(i.id);
  const missingWhere = all.filter((i) => ['done', 'new', 'partial'].includes(i.status) && !i.where).map((i) => i.id);
  const missingPkg = all.filter((i) => i.status === 'queue' && !i.pkg).map((i) => i.id);
  if (missingWhere.length) throw new Error(`Brak miejsca w aplikacji dla: ${missingWhere.join(', ')}`);
  if (missingPkg.length) throw new Error(`Brak pakietu w kolejce dla: ${missingPkg.join(', ')}`);
  writeFileSync('web/src/shared/feature-map.json', `${JSON.stringify({ source: 'docs/FUNKCJE_648.md', total: all.length, groups })}\n`);
  console.log(`Zapisano web/src/shared/feature-map.json: ${all.length} funkcji, ${groups.length} grup, ${groups.reduce((n, g) => n + g.products.length, 0)} modułów`);
}

main();
