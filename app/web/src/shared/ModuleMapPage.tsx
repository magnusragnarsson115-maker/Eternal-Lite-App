import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useI18n } from '../i18n';
import { useSession } from '../session';
import { Badge, BrandMark, DemoBanner, Segmented, TextField } from '../ui';
import { TextSizeButton } from './AccountCards';
import map from './feature-map.json';

/**
 * Moduły i funkcje (instancja pokazowa): wszystkie moduły produktowe z rejestru 9.0 i ich funkcje — co działa
 * w tej aplikacji i gdzie, co jest w kolejce do zbudowania, czego sam kod nie zrobi i dlaczego.
 * Dane: docs/FUNKCJE_648.md → `npm run feature-map` → feature-map.json.
 */

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

interface Product {
  name: string;
  items: Item[];
}

interface Group {
  title: string;
  products: Product[];
}

const DATA = map as { total: number; groups: Group[] };

type Filter = 'all' | 'works' | 'queue' | 'blocked';

const WORKS: Status[] = ['done', 'new', 'partial'];
const DEFAULT_NOTE = 'działa (web, mobile, testy) — dalej pilotaż w placówce';
// ogólne uwagi z klasyfikacji — przy nich pokazujemy wyjaśnienie powodu zamiast powtórzenia
const GENERIC_NOTES = new Set([
  DEFAULT_NOTE,
  'technologia w fazie badań',
  'wizja / wstrzymane w rejestrze',
  'interpretacja danych zdrowotnych — wyrób medyczny (certyfikacja)',
  'fizyczne urządzenie — projekt sprzętowy i CE',
  'konto / umowa z zewnętrznym dostawcą',
  'usługa świadczona przez ludzi',
  'inny produkt / platforma niż ta aplikacja',
  'niedozwolone obecnie prawem',
  'wstrzymane w rejestrze',
]);
const ORDER: Status[] = ['done', 'new', 'partial', 'queue', 'blocked', 'unclear'];

function matches(i: Item, filter: Filter, q: string): boolean {
  if (filter === 'works' && !WORKS.includes(i.status)) return false;
  if (filter === 'queue' && i.status !== 'queue') return false;
  if (filter === 'blocked' && i.status !== 'blocked' && i.status !== 'unclear') return false;
  if (!q) return true;
  const s = q.toLowerCase();
  return i.id.toLowerCase().includes(s) || i.name.toLowerCase().includes(s) || i.note.toLowerCase().includes(s);
}

function count(items: Item[]): Record<Status, number> {
  const c = { done: 0, new: 0, partial: 0, queue: 0, blocked: 0, unclear: 0 } as Record<Status, number>;
  for (const i of items) c[i.status] += 1;
  return c;
}

function slug(name: string): string {
  return `mod-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

function StackBar({ c, total, label }: { c: Record<Status, number>; total: number; label: string }) {
  return (
    <div className="fmap-bar" role="img" aria-label={label}>
      {ORDER.map((s) => (c[s] ? <span key={s} className={`fmap-seg ${s}`} style={{ width: `${(c[s] / total) * 100}%` }} /> : null))}
    </div>
  );
}

export function ModuleMapPage() {
  const { t } = useI18n();
  const { me, config } = useSession();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  // wejście z innego ekranu (np. z dołu formularza logowania) — strona zaczyna się od góry
  useEffect(() => window.scrollTo(0, 0), []);

  const STATUS_LABEL: Record<Status, string> = {
    done: t('Działa'),
    new: t('Działa (nowe)'),
    partial: t('Częściowo'),
    queue: t('Do zbudowania'),
    blocked: t('Poza zasięgiem kodu'),
    unclear: t('Do doprecyzowania'),
  };
  const STATUS_KIND: Record<Status, 'ok' | 'warn' | 'info' | 'primary' | undefined> = { done: 'ok', new: 'primary', partial: 'warn', queue: 'info', blocked: undefined, unclear: undefined };
  const REASON: Record<string, string> = {
    MDR: t('wymaga certyfikacji wyrobu medycznego (ocena, prognoza albo porada na podstawie danych pacjenta)'),
    Umowa: t('wymaga umowy, konta albo klucza u dostawcy'),
    Sprzęt: t('wymaga fizycznego urządzenia'),
    Ludzie: t('usługę świadczą ludzie (lekarze, terapeuci, trenerzy)'),
    'R&D': t('technologia w fazie badań'),
    SF: t('wizja albo pozycja wstrzymana w rejestrze'),
    Prawo: t('obecnie niezgodne z prawem'),
    'Osobny produkt': t('osobna aplikacja lub platforma'),
  };
  const AREA: Record<string, string> = {
    p: t('aplikacja pacjenta'),
    d: t('panel lekarza'),
    r: t('panel rejestracji'),
    a: t('panel administratora'),
    pub: t('bez logowania'),
  };
  const SCREEN: Record<string, string> = {
    '/': t('Start'),
    '/profil': t('Profil i bezpieczeństwo'),
    '/prywatnosc': t('Prywatność i zgody'),
    '/pomiary': t('Pomiary'),
    '/dokumenty': t('Moje dokumenty'),
    '/wyniki': t('Wyniki od placówki'),
    '/pomoc': t('Pomoc · 112 · 116 123'),
    '/dzienniki': t('Dzienniki'),
    '/kalendarz': t('Kalendarz zdrowia'),
    '/wiadomosci': t('Wiadomości'),
    '/dla-lekarza': t('Dla lekarza i na wyjazd'),
    '/wizyty': t('Wizyty'),
    '/rezerwacja': t('Umów wizytę'),
    '/powiadomienia': t('Powiadomienia'),
    '/leki': t('Leki'),
    '/bezpieczenstwo': t('SOS i karta ratunkowa'),
    '/rodzina': t('Rodzina i opiekunowie'),
    '/raport': t('Raport okresowy'),
    '/os-czasu': t('Oś czasu'),
    '/ankiety': t('Ankiety'),
    '/plan': t('Plan i cele'),
    '/jak-dziala-ai': t('Jak działa AI w aplikacji'),
    '/udostepnianie': t('Komu udostępniam'),
    '/historia-zdrowia': t('Historia zdrowia'),
    '/rejestracja': t('Załóż konto'),
    '/logowanie': t('Zaloguj się'),
    '/panel/skrzynka': t('Skrzynka materiałów'),
    '/panel/mierniki': t('Mierniki pilotażu'),
    '/panel/organizacja': t('Organizacja kliniki'),
  };

  const all = useMemo(() => DATA.groups.flatMap((g) => g.products.flatMap((p) => p.items)), []);
  const totals = useMemo(() => count(all), [all]);
  const query = q.trim();

  if (config && !config.demoMode) return <Navigate to="/" replace />;

  const back = me?.authenticated ? (me.user?.staff ? '/panel' : '/') : '/logowanie';
  const works = totals.done + totals.new + totals.partial;

  const where = (i: Item) => {
    if (!i.where) return null;
    if (i.where === 'm') return <span className="small muted">{t('W aplikacji mobilnej (iOS i Android).')}</span>;
    if (i.where === 'b') return <span className="small muted">{t('Działa w tle, bez osobnego ekranu.')}</span>;
    const [area, route] = [i.where.slice(0, i.where.indexOf(':')), i.where.slice(i.where.indexOf(':') + 1)];
    const screen = SCREEN[route.split('?')[0]] ?? route;
    return (
      <span className="small">
        <Link to={route}>{t('Otwórz')}: {screen}</Link> <span className="muted">· {AREA[area]}</span>
      </span>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <DemoBanner />
      <header className="p-header">
        <div className="p-header-inner">
          <Link to={back} className="brand" aria-label={t('Wróć do aplikacji')}>
            <BrandMark />
            <span className="brand-name">eternal</span>
          </Link>
          <span className="grow" />
          <TextSizeButton />
        </div>
      </header>
      <main id="main" className="fmap stack-lg">
        <div className="page-head">
          <Link to={back} className="back-link">
            ← {t('Wróć do aplikacji')}
          </Link>
          <h1>{t('Moduły i funkcje Eternal')}</h1>
          <p className="muted">
            {t('Wszystkie moduły produktowe z rejestru 9.0 i każda ich funkcja: co działa w tej aplikacji i gdzie ją otworzyć, co jest w kolejce do zbudowania, a czego sam kod nie zrobi i dlaczego.')}
          </p>
        </div>

        <section className="card stack">
          <div className="row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
            <strong>
              {works} {t('z')} {DATA.total} {t('funkcji działa w aplikacji')}
            </strong>
            <span className="small muted">
              {DATA.groups.reduce((n, g) => n + g.products.length, 0)} {t('modułów produktowych')}
            </span>
          </div>
          <StackBar c={totals} total={DATA.total} label={`${works} / ${DATA.total}`} />
          <ul className="fmap-legend">
            {ORDER.map((s) => (
              <li key={s}>
                <span className={`fmap-dot ${s}`} aria-hidden /> {STATUS_LABEL[s]} <strong>{totals[s]}</strong>
              </li>
            ))}
          </ul>
        </section>

        <div className="fmap-tools">
          <Segmented<Filter>
            label={t('Pokaż')}
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t('Wszystkie') },
              { value: 'works', label: t('Działa') },
              { value: 'queue', label: t('Do zbudowania') },
              { value: 'blocked', label: t('Poza zasięgiem') },
            ]}
          />
          <div className="grow" style={{ minWidth: 200 }}>
            <TextField label={t('Szukaj funkcji (nazwa albo numer, np. A24.1)')} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {(query || filter !== 'all') && (
          <p className="small" role="status">
            {t('Znalezione funkcje')}: <strong>{all.filter((i) => matches(i, filter, query)).length}</strong>
          </p>
        )}

        <section aria-labelledby="fmap-modules" hidden={!!query || filter !== 'all'}>
          <h2 id="fmap-modules">{t('Moduły produktowe')}</h2>
          <div className="fmap-grid">
            {DATA.groups.flatMap((g) =>
              g.products.map((p) => {
                const c = count(p.items);
                const ok = c.done + c.new + c.partial;
                return (
                  <button key={p.name} type="button" className="fmap-tile" onClick={() => document.getElementById(slug(p.name))?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                    <span className="fmap-tile-name">{p.name}</span>
                    <StackBar c={c} total={p.items.length} label={`${ok} / ${p.items.length}`} />
                    <span className="small muted">
                      {ok} {t('z')} {p.items.length} {t('działa')}
                      {c.queue ? ` · ${c.queue} ${t('do zbudowania')}` : ''}
                    </span>
                  </button>
                );
              }),
            )}
          </div>
        </section>

        {DATA.groups.map((g) => {
          const visible = g.products.map((p) => ({ p, items: p.items.filter((i) => matches(i, filter, query)) })).filter((x) => x.items.length);
          if (!visible.length) return null;
          return (
            <section key={g.title} className="stack">
              <h2>{t(g.title)}</h2>
              {visible.map(({ p, items }) => {
                const c = count(p.items);
                const ok = c.done + c.new + c.partial;
                return (
                  <details key={p.name} id={slug(p.name)} className="card fmap-module" open={!!query || filter !== 'all' || ok > 0}>
                    <summary>
                      <span className="fmap-module-name">{p.name}</span>
                      <span className="small muted">
                        {ok} {t('z')} {p.items.length} {t('działa')}
                      </span>
                    </summary>
                    <ul className="fmap-list">
                      {items.map((i) => (
                        <li key={i.id} className="fmap-row">
                          <div className="fmap-main">
                            <span className="mono small fmap-id">{i.id}</span>
                            <span className="fmap-name">{i.name}</span>
                            <span className="small muted">
                              {i.stage} · {i.project}
                            </span>
                          </div>
                          <div className="fmap-side">
                            <Badge kind={STATUS_KIND[i.status]}>
                              {STATUS_LABEL[i.status]}
                              {i.reason ? `: ${i.reason}` : ''}
                            </Badge>
                            {where(i)}
                            {i.status === 'queue' && i.pkg && (
                              <span className="small muted">
                                {t('Kolejka, pakiet')} {i.pkg}
                              </span>
                            )}
                            {i.status === 'blocked' && i.reason && REASON[i.reason] && GENERIC_NOTES.has(i.note) && <span className="small muted">{REASON[i.reason]}</span>}
                            {i.note && !GENERIC_NOTES.has(i.note) && <span className="small">{i.note}</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              })}
            </section>
          );
        })}
        <p className="small muted">{t('Źródło: docs/FUNKCJE_648.md w repozytorium (klasyfikacja wszystkich funkcji rejestru z etapem i fazą).')}</p>
      </main>
    </div>
  );
}
