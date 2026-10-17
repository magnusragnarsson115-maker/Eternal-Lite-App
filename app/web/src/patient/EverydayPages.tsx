import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Crosshair, MapPin, Navigation, Phone, Plus, Trash2, Wind } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { del, get, put, post, qs } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { placeUrl, routeUrl } from '../lib/maps';
import { useSession } from '../session';
import { Badge, Button, Card, Empty, Notice, PageHead, QueryError, SelectField, Skeleton, Switch, Tabs, TextField, useToast } from '../ui';

/**
 * Funkcje „na co dzień” (runda 4): przypomnienia własne z miejscem i poranny plan dnia (F9.11, A7.8, F5.5),
 * profilaktyka NFZ (A7.7), lokalizacja (A11.1), powietrze i pogoda (F5.1, F5.2, A3.6), apteki i refundacja
 * (F7.1, F7.2, F7.4, F7.7). Wszystko to informacja i przypomnienia ustawione przez pacjenta — bez porad.
 */

const WEEKDAYS = ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'nd'];

function DayChips({ days, onChange }: { days: number[]; onChange: (d: number[]) => void }) {
  const { t } = useI18n();
  return (
    <div className="chips" role="group" aria-label={t('Dni tygodnia')}>
      {WEEKDAYS.map((d, i) => {
        const on = days.includes(i + 1);
        return (
          <button key={d} type="button" aria-pressed={on} className={on ? 'chip on' : 'chip'} onClick={() => onChange(on ? days.filter((x) => x !== i + 1) : [...days, i + 1].sort())}>
            {t(d)}
          </button>
        );
      })}
    </div>
  );
}

// --- przypomnienia własne i plan dnia --------------------------------------------------------------------------

interface CustomReminder {
  id: string;
  kind: 'light-therapy' | 'exercise' | 'custom';
  title: string;
  times: string[];
  days: number[];
  active: boolean;
  place?: string;
}

interface DayPlan {
  date: string;
  appointments: { start: string; service?: string; tele: boolean }[];
  medTimes: number;
  reminders: { title: string; time: string }[];
}

const KIND_LABEL: Record<CustomReminder['kind'], string> = { 'light-therapy': 'Terapia światłem', exercise: 'Ćwiczenia', custom: 'Inne' };

function MorningCard() {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['day-plan'], queryFn: () => get<{ plan: DayPlan; morning: { enabled: boolean; time: string } }>('/api/me/day-plan') });
  const [time, setTime] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: (v: { enabled: boolean; time: string }) => put('/api/me/morning-summary', v),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['day-plan'] });
      toast(t('Zapisano.'));
    },
  });
  if (q.isLoading) return <Skeleton count={1} />;
  if (q.isError) return <QueryError error={q.error} />;
  const { plan, morning } = q.data!;
  const tm = time ?? morning.time;
  const empty = !plan.appointments.length && !plan.medTimes && !plan.reminders.length;
  return (
    <Card title={t('Plan na dziś')}>
      <div className="stack">
        {empty ? (
          <p className="muted" style={{ margin: 0 }}>{t('Na dziś nic nie zaplanowano.')}</p>
        ) : (
          <ul className="list">
            {plan.appointments.map((a) => (
              <li key={a.start} className="list-item">
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>
                    {fmt.time(a.start)} · {a.service ?? t('Wizyta')}
                  </span>
                  {a.tele && <span className="list-sub">{t('wizyta wideo')}</span>}
                </span>
              </li>
            ))}
            {plan.medTimes > 0 && (
              <li className="list-item">
                <span className="grow">{t('Przypomnienia o lekach: {n}', { n: plan.medTimes })}</span>
              </li>
            )}
            {plan.reminders.map((r) => (
              <li key={`${r.time}-${r.title}`} className="list-item">
                <span className="grow">
                  {r.time} · {r.title}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="row-between" style={{ gap: 12, flexWrap: 'wrap' }}>
          <Switch label={t('Poranne podsumowanie dnia')} checked={morning.enabled} onChange={(v) => save.mutate({ enabled: v, time: tm })} />
          <span className="grow">{t('Poranne podsumowanie dnia')}</span>
          <TextField label={t('Godzina')} type="time" value={tm} onChange={(e) => setTime(e.target.value)} onBlur={() => morning.enabled && tm !== morning.time && save.mutate({ enabled: true, time: tm })} />
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          {t('Powiadomienie przychodzi tylko w dni, w które coś jest zaplanowane. Na ekranie blokady widać tylko „Twój plan na dziś czeka w aplikacji”.')}
        </p>
      </div>
    </Card>
  );
}

export function RemindersPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['custom-reminders'], queryFn: () => get<{ items: CustomReminder[] }>('/api/me/custom-reminders') });
  const [f, setF] = useState({ kind: 'light-therapy' as CustomReminder['kind'], title: '', times: '07:30', days: [1, 2, 3, 4, 5, 6, 7], place: '' });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['custom-reminders'] });
    void qc.invalidateQueries({ queryKey: ['day-plan'] });
  };
  const add = useMutation({
    mutationFn: () => post('/api/me/custom-reminders', { kind: f.kind, title: f.title.trim() || undefined, times: f.times.split(',').map((x) => x.trim()).filter(Boolean), days: f.days, place: f.place.trim() || undefined }),
    onSuccess: () => {
      refresh();
      setF({ ...f, title: '', place: '' });
      toast(t('Przypomnienie dodane.'));
    },
  });
  const toggle = useMutation({ mutationFn: (v: { id: string; active: boolean }) => put(`/api/me/custom-reminders/${v.id}`, { active: v.active }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => del(`/api/me/custom-reminders/${id}`), onSuccess: refresh });
  return (
    <div className="stack-lg">
      <PageHead title={t('Przypomnienia')} sub={t('Przypomnienia, które ustawiasz sam(a) — np. terapia światłem albo ćwiczenia tak, jak ustaliłeś(-aś) z lekarzem. Aplikacja nie dobiera godzin ani czasu trwania.')} />
      <MorningCard />
      <Card title={t('Moje przypomnienia')}>
        {q.isLoading && <Skeleton count={2} />}
        {q.isError && <QueryError error={q.error} />}
        {q.data && !q.data.items.length && <p className="muted" style={{ margin: 0 }}>{t('Nie masz jeszcze własnych przypomnień.')}</p>}
        <ul className="list">
          {q.data?.items.map((r) => (
            <li key={r.id} className="list-item">
              <span className="list-icon">
                <Bell size={18} />
              </span>
              <span className="grow">
                <span className="list-title" style={{ display: 'block' }}>
                  {r.title} {r.title !== KIND_LABEL[r.kind] && <span className="small muted">· {t(KIND_LABEL[r.kind])}</span>}
                </span>
                <span className="list-sub">
                  {r.times.join(', ')} · {r.days.length === 7 ? t('codziennie') : r.days.map((d) => t(WEEKDAYS[d - 1])).join(', ')}
                </span>
                {r.place && (
                  <a className="list-sub" style={{ display: 'block' }} href={placeUrl(r.place)} target="_blank" rel="noopener noreferrer">
                    <MapPin size={14} aria-hidden /> {r.place}
                  </a>
                )}
              </span>
              <Switch label={r.title} checked={r.active} onChange={(v) => toggle.mutate({ id: r.id, active: v })} />
              <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} aria-label={t('Usuń')} onClick={() => remove.mutate(r.id)} />
            </li>
          ))}
        </ul>
      </Card>
      <Card title={t('Nowe przypomnienie')}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <div className="grid-2">
            <SelectField label={t('Rodzaj')} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as CustomReminder['kind'] })}>
              {(Object.keys(KIND_LABEL) as CustomReminder['kind'][]).map((k) => (
                <option key={k} value={k}>
                  {t(KIND_LABEL[k])}
                </option>
              ))}
            </SelectField>
            <TextField label={t('Nazwa (opcjonalnie)')} maxLength={80} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder={t(KIND_LABEL[f.kind])} />
            <TextField label={t('Godziny (np. 08:00, 20:00)')} value={f.times} onChange={(e) => setF({ ...f, times: e.target.value })} />
            <TextField label={t('Miejsce (opcjonalnie)')} maxLength={160} value={f.place} onChange={(e) => setF({ ...f, place: e.target.value })} hint={t('Adres albo nazwa — w przypomnieniu pojawi się odnośnik do mapy.')} />
          </div>
          <DayChips days={f.days} onChange={(days) => setF({ ...f, days })} />
          {add.isError && <Notice kind="danger">{errorMessage(add.error, t)}</Notice>}
          <Button type="submit" icon={<Plus size={16} />} loading={add.isPending} disabled={!f.days.length || !f.times.trim()} style={{ alignSelf: 'flex-start' }}>
            {t('Dodaj przypomnienie')}
          </Button>
        </form>
      </Card>
    </div>
  );
}

// --- profilaktyka NFZ ------------------------------------------------------------------------------------------

interface PreventiveItem {
  key: string;
  name: string;
  text: string;
  howTo: string;
  note?: string;
  source: string;
  ageRange: string;
  variants?: { key: string; label: string; years: number }[];
  status: 'available' | 'later' | 'upcoming';
  fromYear?: number;
  lastDone?: string;
  variant?: string;
  nextFrom?: string;
  remind: boolean;
}

interface PreventiveOverview {
  version: string;
  visible: boolean;
  draft: boolean;
  approval?: { by: string; at: string };
  birthYear?: number;
  items: PreventiveItem[];
}

function ProgramCard({ p }: { p: PreventiveItem }) {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ lastDone: p.lastDone ?? '', variant: p.variant ?? p.variants?.[0]?.key ?? '' });
  const save = useMutation({
    mutationFn: (v: { lastDone?: string | null; variant?: string | null; remind?: boolean }) => put<PreventiveOverview>(`/api/me/preventive/${p.key}`, v),
    onSuccess: (o) => {
      qc.setQueryData(['preventive'], o);
      toast(t('Zapisano.'));
    },
  });
  return (
    <Card title={t(p.name)} action={p.status === 'available' ? <Badge kind="primary">{t('możesz skorzystać')}</Badge> : p.status === 'later' ? <Badge>{t('kolejne badanie później')}</Badge> : <Badge>{t('od {y} roku', { y: p.fromYear ?? '' })}</Badge>}>
      <div className="stack">
        <p style={{ margin: 0 }}>{t(p.text)}</p>
        <p className="small" style={{ margin: 0 }}>
          <strong>{t('Jak się zapisać:')}</strong> {t(p.howTo)}
        </p>
        {p.note && <p className="small muted" style={{ margin: 0 }}>{t(p.note)}</p>}
        {p.status !== 'upcoming' && (
          <>
            {p.nextFrom && <Notice kind={p.status === 'later' ? 'info' : 'ok'}>{t('Według zasad programu kolejne badanie w programie: od {d}.', { d: fmt.date(p.nextFrom) })}</Notice>}
            <div className="grid-2">
              <TextField label={t('Ostatnie badanie (data)')} type="date" value={f.lastDone} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setF({ ...f, lastDone: e.target.value })} />
              {p.variants && (
                <SelectField label={t('Rodzaj badania')} value={f.variant} onChange={(e) => setF({ ...f, variant: e.target.value })}>
                  {p.variants.map((v) => (
                    <option key={v.key} value={v.key}>
                      {t(v.label)} · {t('co {n} lat', { n: v.years })}
                    </option>
                  ))}
                </SelectField>
              )}
            </div>
            <div className="btn-row">
              <Button size="sm" variant="secondary" loading={save.isPending} onClick={() => save.mutate({ lastDone: f.lastDone || null, variant: p.variants ? f.variant || null : undefined })}>
                {t('Zapisz datę')}
              </Button>
              <Switch label={t('Przypomnij, gdy będzie można')} checked={p.remind} onChange={(v) => save.mutate({ remind: v })} />
              <span className="small">{t('Przypomnij, gdy będzie można')}</span>
            </div>
          </>
        )}
        {save.isError && <Notice kind="danger">{errorMessage(save.error, t)}</Notice>}
        <a className="small" href={p.source} target="_blank" rel="noopener noreferrer">
          {t('Zasady programu: {s}', { s: p.source.replace(/^https?:\/\//, '') })}
        </a>
      </div>
    </Card>
  );
}

export function PreventivePage() {
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['preventive'], queryFn: () => get<PreventiveOverview>('/api/me/preventive') });
  return (
    <div className="stack-lg">
      <PageHead title={t('Profilaktyka NFZ')} sub={t('Bezpłatne badania profilaktyczne, z których według zasad programów NFZ może skorzystać osoba w Twoim wieku. To informacja o programach — o innych badaniach zdecyduje lekarz.')} />
      {q.isLoading && <Skeleton count={3} />}
      {q.isError && <QueryError error={q.error} />}
      {q.data && !q.data.visible && <Notice kind="info">{t('Treść o programach profilaktycznych czeka na zatwierdzenie przez lekarza placówki.')}</Notice>}
      {q.data?.visible && q.data.draft && <Notice kind="warn">{t('Projekt treści (instancja pokazowa) — przed wdrożeniem zatwierdza ją lekarz placówki.')}</Notice>}
      {q.data?.approval && <p className="small muted">{t('Treść zatwierdził(a): {by}, {d}.', { by: q.data.approval.by, d: fmt.date(q.data.approval.at) })}</p>}
      {q.data?.visible && !q.data.birthYear && <Notice kind="info">{t('Uzupełnij datę urodzenia w profilu, aby zobaczyć programy dla Twojego wieku.')}</Notice>}
      {q.data?.visible && q.data.birthYear && !q.data.items.length && <Empty title={t('Brak programów dla Twojego wieku')} />}
      {q.data?.items.map((p) => <ProgramCard key={p.key} p={p} />)}
      {q.data?.visible && <p className="small muted">{t('Wiek liczymy rocznikiem, tak jak w zaproszeniach NFZ. Datę ostatniego badania wpisujesz sam(a); aplikacja tylko dodaje do niej odstęp z zasad programu.')}</p>}
    </div>
  );
}

// --- lokalizacja ---------------------------------------------------------------------------------------------------

interface UserLocation {
  source: 'city' | 'device';
  label: string;
  lat: number;
  lon: number;
  updatedAt: string;
}

export function LocationCard({ onChanged }: { onChanged?: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['location'], queryFn: () => get<{ location: UserLocation | null; cities: string[] }>('/api/me/location') });
  const [geoErr, setGeoErr] = useState('');
  const done = () => {
    void qc.invalidateQueries({ queryKey: ['location'] });
    onChanged?.();
  };
  const set = useMutation({ mutationFn: (v: { city: string } | { lat: number; lon: number }) => put('/api/me/location', v), onSuccess: done });
  const clear = useMutation({
    mutationFn: () => del('/api/me/location'),
    onSuccess: () => {
      done();
      toast(t('Usunięto lokalizację.'));
    },
  });
  const useDevice = () => {
    setGeoErr('');
    if (!('geolocation' in navigator)) return setGeoErr(t('Ta przeglądarka nie udostępnia położenia.'));
    navigator.geolocation.getCurrentPosition(
      (pos) => set.mutate({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => setGeoErr(t('Nie udało się odczytać położenia. Wybierz miasto z listy.')),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 600_000 },
    );
  };
  const loc = q.data?.location;
  return (
    <Card title={t('Moja okolica')}>
      <div className="stack">
        <p className="small muted" style={{ margin: 0 }}>
          {t('Do jakości powietrza, pogody i aptek w pobliżu. Zapisujemy miasto albo położenie zaokrąglone do ok. 1 km — bez historii miejsc.')}
        </p>
        {loc && (
          <p style={{ margin: 0 }}>
            <MapPin size={16} aria-hidden /> <strong>{loc.label}</strong> <span className="small muted">· {loc.source === 'device' ? t('z położenia urządzenia') : t('wybrane miasto')}</span>
          </p>
        )}
        <div className="grid-2">
          <SelectField label={t('Miasto')} value={loc?.source === 'city' ? loc.label : ''} onChange={(e) => e.target.value && set.mutate({ city: e.target.value })}>
            <option value="">—</option>
            {q.data?.cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </SelectField>
          <div className="btn-row" style={{ alignItems: 'flex-end' }}>
            <Button variant="secondary" icon={<Crosshair size={16} />} loading={set.isPending} onClick={useDevice}>
              {t('Użyj położenia urządzenia')}
            </Button>
            {loc && (
              <Button variant="ghost" icon={<Trash2 size={16} />} onClick={() => clear.mutate()}>
                {t('Usuń')}
              </Button>
            )}
          </div>
        </div>
        {geoErr && <Notice kind="warn">{geoErr}</Notice>}
        {set.isError && <Notice kind="danger">{errorMessage(set.error, t)}</Notice>}
      </div>
    </Card>
  );
}

// --- powietrze i pogoda ---------------------------------------------------------------------------------------------

interface AirIndex {
  stationId: number;
  stationName?: string;
  distanceKm?: number;
  level?: number;
  category?: string;
  calculatedAt?: string;
  pollutants: { code: string; level?: number; category?: string }[];
  source: string;
  demo?: boolean;
}

interface Weather {
  stationId: string;
  station: string;
  measuredAt?: string;
  temperature?: number;
  windSpeed?: number;
  windDirection?: number;
  humidity?: number;
  precipitation?: number;
  pressure?: number;
  source: string;
  demo?: boolean;
}

interface EnvironmentView {
  location?: UserLocation;
  air?: AirIndex;
  airError?: string;
  weather?: Weather;
  weatherStations: { id: string; name: string }[];
  weatherError?: string;
  prefs: { enabled: boolean; threshold: number; weatherStationId?: string };
  levels: string[];
}

export function AirWeatherPage() {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['environment'], queryFn: () => get<EnvironmentView>('/api/me/environment') });
  const prefs = useMutation({
    mutationFn: (v: { enabled?: boolean; threshold?: number; weatherStationId?: string | null }) => put('/api/me/environment/prefs', v),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['environment'] }),
  });
  const d = q.data;
  return (
    <div className="stack-lg">
      <PageHead title={t('Powietrze i pogoda')} sub={t('Dane urzędowe: Polski Indeks Jakości Powietrza z najbliższej stacji GIOŚ i pomiary ze stacji synoptycznej IMGW-PIB. Tylko informacja — bez porad.')} />
      <LocationCard onChanged={() => void qc.invalidateQueries({ queryKey: ['environment'] })} />
      {q.isLoading && <Skeleton count={2} />}
      {q.isError && <QueryError error={q.error} />}
      {d && !d.location && <Notice kind="info">{t('Wybierz miasto albo użyj położenia urządzenia, aby zobaczyć dane z najbliższej stacji.')}</Notice>}
      {d?.location && (
        <div className="grid-2">
          <Card title={t('Jakość powietrza')}>
            {d.air ? (
              <div className="stack">
                {d.air.demo && <Notice kind="warn">{t('Dane pokazowe — brak połączenia z GIOŚ.')}</Notice>}
                <p style={{ margin: 0, fontSize: '1.4rem' }}>
                  <Wind size={22} aria-hidden /> <strong>{d.air.category ? t(d.air.category) : '—'}</strong>
                </p>
                <p className="small muted" style={{ margin: 0 }}>
                  {t('Stacja: {s}', { s: d.air.stationName ?? String(d.air.stationId) })}
                  {d.air.distanceKm !== undefined && ` · ${t('{km} km', { km: fmt.number(d.air.distanceKm, 1) })}`}
                  {d.air.calculatedAt && ` · ${t('obliczono {d}', { d: d.air.calculatedAt })}`}
                </p>
                {d.air.pollutants.length > 0 && (
                  <dl className="kv">
                    {d.air.pollutants.map((p) => (
                      <div key={p.code} style={{ display: 'contents' }}>
                        <dt>{p.code}</dt>
                        <dd>{p.category ? t(p.category) : '—'}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                <p className="small muted" style={{ margin: 0 }}>{d.air.source}</p>
              </div>
            ) : (
              <Notice kind="info">{d.airError === 'no_station_nearby' ? t('W promieniu 30 km nie ma stacji GIOŚ.') : t('GIOŚ jest teraz niedostępny. Spróbuj później.')}</Notice>
            )}
          </Card>
          <Card title={t('Pogoda')}>
            {d.weather ? (
              <div className="stack">
                {d.weather.demo && <Notice kind="warn">{t('Dane pokazowe — brak połączenia z IMGW.')}</Notice>}
                <dl className="kv">
                  <dt>{t('Temperatura')}</dt>
                  <dd>{d.weather.temperature !== undefined ? `${fmt.number(d.weather.temperature, 1)} °C` : '—'}</dd>
                  <dt>{t('Wilgotność')}</dt>
                  <dd>{d.weather.humidity !== undefined ? `${fmt.number(d.weather.humidity, 0)}%` : '—'}</dd>
                  <dt>{t('Ciśnienie')}</dt>
                  <dd>{d.weather.pressure !== undefined ? `${fmt.number(d.weather.pressure, 1)} hPa` : '—'}</dd>
                  <dt>{t('Wiatr')}</dt>
                  <dd>{d.weather.windSpeed !== undefined ? `${fmt.number(d.weather.windSpeed, 0)} m/s` : '—'}</dd>
                  <dt>{t('Opad')}</dt>
                  <dd>{d.weather.precipitation !== undefined ? `${fmt.number(d.weather.precipitation, 1)} mm` : '—'}</dd>
                </dl>
                <p className="small muted" style={{ margin: 0 }}>
                  {t('Stacja: {s}', { s: d.weather.station })}
                  {d.weather.measuredAt && ` · ${fmt.dateTime(d.weather.measuredAt)}`}
                </p>
                <p className="small muted" style={{ margin: 0 }}>{d.weather.source}</p>
              </div>
            ) : (
              <Notice kind="info">{d.weatherError ? t('IMGW jest teraz niedostępny. Spróbuj później.') : t('Wybierz stację IMGW z listy.')}</Notice>
            )}
            {d.weatherStations.length > 1 && (
              <SelectField label={t('Stacja IMGW')} value={d.weather?.stationId ?? ''} onChange={(e) => prefs.mutate({ weatherStationId: e.target.value || null })}>
                <option value="">—</option>
                {d.weatherStations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </SelectField>
            )}
          </Card>
        </div>
      )}
      {d?.location && (
        <Card title={t('Powiadomienie o jakości powietrza')}>
          <div className="stack">
            <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <Switch label={t('Powiadom mnie')} checked={d.prefs.enabled} onChange={(v) => prefs.mutate({ enabled: v })} />
              <span>{t('Powiadom mnie, gdy indeks GIOŚ na najbliższej stacji osiągnie kategorię:')}</span>
              <SelectField label={t('Kategoria')} value={String(d.prefs.threshold)} onChange={(e) => prefs.mutate({ threshold: Number(e.target.value) })}>
                {d.levels.slice(1).map((l, i) => (
                  <option key={l} value={i + 1}>
                    {t(l)} {t('lub gorsza')}
                  </option>
                ))}
              </SelectField>
            </div>
            <p className="small muted" style={{ margin: 0 }}>{t('Jedno powiadomienie przy przekroczeniu progu; kolejne dopiero po spadku poniżej progu. Treść podaje kategorię i stację GIOŚ.')}</p>
          </div>
        </Card>
      )}
    </div>
  );
}

// --- apteki i refundacja --------------------------------------------------------------------------------------------

interface Pharmacy {
  id: string;
  name: string;
  kind?: string;
  street?: string;
  postcode?: string;
  city?: string;
  phone?: string;
  hours?: string;
  lat?: number;
  lon?: number;
  distanceKm?: number;
}

interface RefundItem {
  gtin?: string;
  substance?: string;
  name: string;
  pack?: string;
  limitGroup?: string;
  retailPrice?: string;
  limitAmount?: string;
  indications?: string;
  offLabel?: string;
  paymentLevel?: string;
  copay?: string;
  list?: string;
}

interface RegistryStatus {
  pharmacies: { total: number; withCoordinates: number; meta?: { importedAt: string } };
  refund: { count: number; meta?: { importedAt: string; title?: string; validFrom?: string } };
}

function PharmacySearch({ status }: { status?: RegistryStatus }) {
  const { t, fmt } = useI18n();
  const [f, setF] = useState({ q: '', near: false });
  const [run, setRun] = useState<{ q: string; near: boolean } | null>(null);
  const r = useQuery({
    queryKey: ['pharmacies', run],
    queryFn: () => get<{ items: Pharmacy[]; needLocation?: boolean; location?: string }>(`/api/registries/pharmacies${qs(run!.near ? { near: '1' } : { q: run!.q })}`),
    enabled: !!run,
  });
  if (status && !status.pharmacies.total) return <Notice kind="info">{t('Placówka nie zaimportowała jeszcze Rejestru Aptek.')}</Notice>;
  return (
    <div className="stack">
      <form
        className="row"
        style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}
        onSubmit={(e) => {
          e.preventDefault();
          setRun({ q: f.q, near: false });
        }}
      >
        <span className="grow">
          <TextField label={t('Miejscowość, ulica, kod pocztowy albo nazwa apteki')} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        </span>
        <Button type="submit" disabled={f.q.trim().length < 2}>
          {t('Szukaj')}
        </Button>
        {!!status?.pharmacies.withCoordinates && (
          <Button variant="secondary" icon={<MapPin size={16} />} onClick={() => setRun({ q: '', near: true })}>
            {t('W pobliżu')}
          </Button>
        )}
      </form>
      {r.isLoading && <Skeleton count={2} />}
      {r.isError && <QueryError error={r.error} />}
      {r.data?.needLocation && <LocationCard onChanged={() => void r.refetch()} />}
      {r.data && !r.data.needLocation && !r.data.items.length && <Empty title={t('Nie znaleziono aptek')} />}
      {r.data?.location && <p className="small muted">{t('Najbliższe od: {l}', { l: r.data.location })}</p>}
      <ul className="list">
        {r.data?.items.map((p) => {
          const address = [p.street, [p.postcode, p.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
          const to = { address: `${p.name}, ${address}`, lat: p.lat, lon: p.lon };
          return (
            <li key={p.id} className="list-item" style={{ alignItems: 'flex-start' }}>
              <span className="grow">
                <span className="list-title" style={{ display: 'block' }}>
                  {p.name} {p.distanceKm !== undefined && <span className="small muted">· {t('{km} km', { km: fmt.number(p.distanceKm, 1) })}</span>}
                </span>
                <span className="list-sub" style={{ display: 'block' }}>
                  {address}
                  {p.kind ? ` · ${p.kind}` : ''}
                </span>
                {p.hours && <span className="list-sub" style={{ display: 'block' }}>{p.hours}</span>}
                <span className="btn-row" style={{ marginTop: 6 }}>
                  {p.phone && (
                    <a className="btn secondary sm" href={`tel:${p.phone.replace(/\s/g, '')}`}>
                      <Phone size={14} aria-hidden /> {p.phone}
                    </a>
                  )}
                  <a className="btn ghost sm" href={routeUrl('osm', to)} target="_blank" rel="noopener noreferrer">
                    <Navigation size={14} aria-hidden /> OpenStreetMap
                  </a>
                  <a className="btn ghost sm" href={routeUrl('google', to)} target="_blank" rel="noopener noreferrer">
                    Google Maps
                  </a>
                  <a className="btn ghost sm" href={routeUrl('apple', to)} target="_blank" rel="noopener noreferrer">
                    Apple Maps
                  </a>
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="small muted">{t('Dane z Rejestru Aptek (Centrum e-Zdrowia). Trasę wyznacza wybrana mapa na Twoim urządzeniu — aplikacja nie wysyła tam Twojego położenia. Godziny pracy potwierdź w aptece.')}</p>
    </div>
  );
}

function RefundSearch({ status, initial }: { status?: RegistryStatus; initial: string }) {
  const { t, fmt } = useI18n();
  const [q, setQ] = useState(initial);
  const [run, setRun] = useState(initial);
  const r = useQuery({
    queryKey: ['refund', run],
    queryFn: () => get<{ items: RefundItem[] }>(`/api/registries/refund${qs(/^\d{8,14}$/.test(run) ? { gtin: run } : { q: run })}`),
    enabled: run.trim().length >= 2,
  });
  if (status && !status.refund.count) return <Notice kind="info">{t('Placówka nie zaimportowała jeszcze wykazu leków refundowanych.')}</Notice>;
  const meta = status?.refund.meta;
  return (
    <div className="stack">
      {meta && (
        <p className="small muted" style={{ margin: 0 }}>
          {meta.title ?? t('Obwieszczenie Ministra Zdrowia')}
          {meta.validFrom ? ` · ${t('obowiązuje od {d}', { d: fmt.date(meta.validFrom) })}` : ''} · {t('zaimportowano {d}', { d: fmt.date(meta.importedAt) })}
        </p>
      )}
      <form
        className="row"
        style={{ gap: 8, alignItems: 'flex-end' }}
        onSubmit={(e) => {
          e.preventDefault();
          setRun(q.trim());
        }}
      >
        <span className="grow">
          <TextField label={t('Nazwa leku, substancja czynna albo kod EAN z opakowania')} value={q} onChange={(e) => setQ(e.target.value)} />
        </span>
        <Button type="submit" disabled={q.trim().length < 2}>
          {t('Szukaj')}
        </Button>
      </form>
      {r.isLoading && <Skeleton count={2} />}
      {r.isError && <QueryError error={r.error} />}
      {r.data && !r.data.items.length && <Empty title={t('Nie ma tego leku w wykazie refundacyjnym')} />}
      {r.data?.items.map((i, n) => (
        <Card key={`${i.gtin ?? i.name}-${n}`} title={i.name}>
          <dl className="kv">
            {i.substance && (
              <>
                <dt>{t('Substancja czynna')}</dt>
                <dd>{i.substance}</dd>
              </>
            )}
            {i.pack && (
              <>
                <dt>{t('Opakowanie')}</dt>
                <dd>{i.pack}</dd>
              </>
            )}
            {i.gtin && (
              <>
                <dt>EAN</dt>
                <dd className="mono">{i.gtin}</dd>
              </>
            )}
            {i.list && (
              <>
                <dt>{t('Wykaz')}</dt>
                <dd>{i.list}</dd>
              </>
            )}
            {i.limitGroup && (
              <>
                <dt>{t('Grupa limitowa')}</dt>
                <dd>{i.limitGroup}</dd>
              </>
            )}
            {i.paymentLevel && (
              <>
                <dt>{t('Poziom odpłatności')}</dt>
                <dd>{i.paymentLevel}</dd>
              </>
            )}
            {i.retailPrice && (
              <>
                <dt>{t('Cena detaliczna')}</dt>
                <dd>{i.retailPrice} zł</dd>
              </>
            )}
            {i.copay && (
              <>
                <dt>{t('Dopłata pacjenta')}</dt>
                <dd>{i.copay} zł</dd>
              </>
            )}
            {i.indications && (
              <>
                <dt>{t('Zakres wskazań objętych refundacją')}</dt>
                <dd>{i.indications}</dd>
              </>
            )}
            {i.offLabel && (
              <>
                <dt>{t('Wskazania pozarejestracyjne objęte refundacją')}</dt>
                <dd>{i.offLabel}</dd>
              </>
            )}
          </dl>
        </Card>
      ))}
      <p className="small muted">{t('To informacja z obwieszczenia Ministra Zdrowia. O refundacji na recepcie decyduje lekarz według wskazań, a ostateczną cenę podaje apteka.')}</p>
    </div>
  );
}

export function PharmaciesPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const { profile } = useSession();
  const [tab, setTab] = useState<'pharmacies' | 'refund'>(() => (params.get('tab') === 'refund' ? 'refund' : 'pharmacies'));
  const status = useQuery({ queryKey: ['registries-status'], queryFn: () => get<RegistryStatus>('/api/registries/status') });
  return (
    <div className="stack-lg">
      <PageHead title={t('Apteki i refundacja')} sub={t('Wyszukiwarka aptek z rejestru publicznego i informacja z wykazu leków refundowanych. Zapytania nie wychodzą poza serwer placówki.')} />
      {profile && <Notice kind="info">{t('Lokalizacja „w pobliżu” to ustawienie Twojego konta, nie profilu osoby pod opieką.')}</Notice>}
      {status.isError && <QueryError error={status.error} />}
      <Tabs
        label={t('Apteki i refundacja')}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'pharmacies', label: t('Apteki') },
          { value: 'refund', label: t('Refundacja') },
        ]}
      />
      {tab === 'pharmacies' && <PharmacySearch status={status.data} />}
      {tab === 'refund' && <RefundSearch status={status.data} initial={params.get('q') ?? ''} />}
    </div>
  );
}
