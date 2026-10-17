import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, CheckCircle2, CircleAlert, CircleDashed, Lock, MessagesSquare, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { get, post, put, qs } from '../api';
import { errorMessage } from '../errors';
import { addDaysIso, clinicDate, useI18n } from '../i18n';
import { useSession } from '../session';
import type { LocationView, PractitionerView, ServiceView, ThreadView } from '../types';
import { Badge, Button, Card, Checkbox, Empty, Modal, Notice, PageHead, QueryError, SelectField, Skeleton, Tabs, TextArea, TextField, useToast } from '../ui';
import { ThreadConversation } from '../ui/ThreadView';

// --- wiadomości --------------------------------------------------------------------------------------

const CAT_LABEL: Record<string, string> = { question: 'Pytanie do lekarza', administrative: 'Organizacyjne', prescription: 'Recepta', results: 'Wyniki' };

export function StaffMessagesPage() {
  const { id } = useParams();
  const { t, fmt } = useI18n();
  const list = useQuery({ queryKey: ['threads', 'staff'], queryFn: () => get<{ items: ThreadView[] }>('/api/staff/threads') });
  const thread = useQuery({ queryKey: ['thread', 'staff', id], queryFn: () => get<ThreadView>(`/api/staff/threads/${id}`), enabled: !!id });
  return (
    <div className="stack-lg">
      <PageHead title={t('Wiadomości od pacjentów')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 360px) 1fr', gap: 16 }} className="msg-grid">
        <div className="card card-flush" style={{ alignSelf: 'start' }}>
          {list.isLoading && <div style={{ padding: 16 }}><Skeleton count={4} height={48} /></div>}
          {list.data && list.data.items.length === 0 && <Empty icon={<MessagesSquare size={32} />} title={t('Brak wiadomości')} />}
          <ul className="list">
            {list.data?.items.map((th) => (
              <li key={th.id}>
                <Link to={`/panel/wiadomosci/${th.id}`} className="list-item" aria-current={th.id === id ? 'page' : undefined} style={th.id === id ? { background: 'var(--primary-soft)' } : undefined}>
                  {th.unread && <span className="unread-dot" aria-label={t('nieprzeczytane')} />}
                  <span className="grow">
                    <span className="list-title" style={{ display: 'block', fontWeight: th.unread ? 750 : 600 }}>{th.patientName}</span>
                    <span className="list-sub" style={{ display: 'block' }}>{th.subject}</span>
                    <span className="small muted">
                      {t(CAT_LABEL[th.category] ?? th.category)} · {fmt.relative(th.lastMessageAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          {!id && <Card><Empty title={t('Wybierz wątek z listy')} /></Card>}
          {id && thread.isLoading && <Skeleton count={3} />}
          {id && thread.isError && <QueryError error={thread.error} />}
          {thread.data && (
            <Card title={<div><h2 style={{ margin: 0 }}>{thread.data.subject}</h2><Link to={`/panel/pacjenci/${thread.data.patientId}`} className="small">{thread.data.patientName}</Link></div>}>
              <ThreadConversation thread={thread.data} viewer="clinic" replyUrl={`/api/staff/threads/${id}/reply`} onSent={() => void thread.refetch()} />
            </Card>
          )}
        </div>
      </div>
      <style>{`@media (max-width: 900px) { .msg-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}

// --- grafik ------------------------------------------------------------------------------------------

const WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

export function SchedulePage() {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: () => get<{ services: ServiceView[]; practitioners: PractitionerView[]; locations: LocationView[] }>('/api/catalog') });
  const today = clinicDate(new Date());
  const [f, setF] = useState({ practitionerId: '', serviceIds: [] as string[], locationId: '', from: today, to: addDaysIso(today, 27), weekdays: [1, 2, 3, 4, 5], startTime: '08:00', endTime: '14:00', slotMinutes: 20, breakStart: '', breakEnd: '', skipHolidays: true });
  const [result, setResult] = useState<{ created: number; skippedOverlap: number; skippedHolidays: { date: string; name: string }[] } | null>(null);
  const [block, setBlock] = useState({ practitionerId: '', from: `${today}T08:00`, to: `${today}T16:00`, reason: 'Urlop' });
  const create = useMutation({
    mutationFn: () => post<typeof result>('/api/staff/availability', { ...f, locationId: f.locationId || undefined }),
    onSuccess: (r) => {
      setResult(r);
      void qc.invalidateQueries({ queryKey: ['calendar'] });
    },
  });
  const blockM = useMutation({
    mutationFn: () => post<{ blocked: number; conflicts: { id: string; patientName: string; start: string }[] }>('/api/staff/availability/block', { ...block, from: new Date(block.from).toISOString(), to: new Date(block.to).toISOString() }),
    onSuccess: (r) => toast(t('Zablokowano {n} terminów. Wizyty kolidujące: {c}.', { n: r.blocked, c: r.conflicts.length })),
  });
  const practitioner = catalog.data?.practitioners.find((p) => p.id === f.practitionerId);
  const services = catalog.data?.services.filter((s) => !practitioner || practitioner.serviceIds.includes(s.id)) ?? [];

  return (
    <div className="stack-lg">
      <PageHead title={t('Grafik')} sub={t('Dostępność lekarzy generuje wolne terminy widoczne od razu w aplikacji pacjenta. Dni ustawowo wolne są pomijane.')} />
      {catalog.isError && <QueryError error={catalog.error} />}
      <Card title={t('Dodaj dostępność')}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="grid-3">
            <SelectField label={t('Lekarz')} value={f.practitionerId} onChange={(e) => setF({ ...f, practitionerId: e.target.value, serviceIds: [] })} required>
              <option value="">{t('Wybierz…')}</option>
              {catalog.data?.practitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectField>
            <SelectField label={t('Lokalizacja')} value={f.locationId} onChange={(e) => setF({ ...f, locationId: e.target.value })}>
              <option value="">{t('Brak (teleporady)')}</option>
              {catalog.data?.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </SelectField>
            <TextField label={t('Długość wizyty (min)')} type="number" min={5} max={240} value={f.slotMinutes} onChange={(e) => setF({ ...f, slotMinutes: Number(e.target.value) })} />
          </div>
          <fieldset style={{ border: 0, padding: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: 6 }}>{t('Usługi w tych terminach')}</legend>
            <div className="row">
              {services.map((s) => (
                <Checkbox
                  key={s.id}
                  label={s.name}
                  checked={f.serviceIds.includes(s.id)}
                  onChange={(e) => setF({ ...f, serviceIds: e.target.checked ? [...f.serviceIds, s.id] : f.serviceIds.filter((x) => x !== s.id) })}
                />
              ))}
            </div>
          </fieldset>
          <div className="grid-4">
            <TextField label={t('Od dnia')} type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
            <TextField label={t('Do dnia')} type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
            <TextField label={t('Od godz.')} type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} />
            <TextField label={t('Do godz.')} type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} />
            <TextField label={t('Przerwa od')} type="time" value={f.breakStart} onChange={(e) => setF({ ...f, breakStart: e.target.value })} />
            <TextField label={t('Przerwa do')} type="time" value={f.breakEnd} onChange={(e) => setF({ ...f, breakEnd: e.target.value })} />
          </div>
          <fieldset style={{ border: 0, padding: 0 }}>
            <legend style={{ fontWeight: 600, marginBottom: 6 }}>{t('Dni tygodnia')}</legend>
            <div className="segmented">
              {WEEKDAYS.map((d, i) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={f.weekdays.includes(i + 1)}
                  onClick={() => setF({ ...f, weekdays: f.weekdays.includes(i + 1) ? f.weekdays.filter((x) => x !== i + 1) : [...f.weekdays, i + 1] })}
                >
                  {t(d)}
                </button>
              ))}
            </div>
          </fieldset>
          <Checkbox label={t('Pomiń dni ustawowo wolne od pracy')} checked={f.skipHolidays} onChange={(e) => setF({ ...f, skipHolidays: e.target.checked })} />
          {create.isError && <Notice kind="danger">{errorMessage(create.error, t)}</Notice>}
          {result && (
            <Notice kind="ok" title={t('Utworzono {n} terminów', { n: result.created })}>
              {result.skippedOverlap > 0 && <p>{t('Pominięto {n} kolidujących z istniejącym grafikiem.', { n: result.skippedOverlap })}</p>}
              {result.skippedHolidays.length > 0 && <p>{t('Pominięte święta')}: {result.skippedHolidays.map((h) => `${h.date} (${h.name})`).join(', ')}</p>}
            </Notice>
          )}
          <Button type="submit" icon={<CalendarPlus size={18} />} loading={create.isPending} disabled={!f.practitionerId || f.serviceIds.length === 0} style={{ alignSelf: 'flex-start' }}>
            {t('Generuj terminy')}
          </Button>
        </form>
      </Card>
      <Card title={t('Zablokuj czas (urlop, szkolenie)')}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            blockM.mutate();
          }}
        >
          <div className="grid-4">
            <SelectField label={t('Lekarz')} value={block.practitionerId} onChange={(e) => setBlock({ ...block, practitionerId: e.target.value })} required>
              <option value="">{t('Wybierz…')}</option>
              {catalog.data?.practitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectField>
            <TextField label={t('Od')} type="datetime-local" value={block.from} onChange={(e) => setBlock({ ...block, from: e.target.value })} />
            <TextField label={t('Do')} type="datetime-local" value={block.to} onChange={(e) => setBlock({ ...block, to: e.target.value })} />
            <TextField label={t('Powód')} value={block.reason} onChange={(e) => setBlock({ ...block, reason: e.target.value })} maxLength={200} />
          </div>
          {blockM.isError && <Notice kind="danger">{errorMessage(blockM.error, t)}</Notice>}
          {blockM.data && blockM.data.conflicts.length > 0 && (
            <Notice kind="warn" title={t('Wizyty w zablokowanym czasie — odwołaj lub przenieś je w kalendarzu')}>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {blockM.data.conflicts.map((c) => (
                  <li key={c.id}>
                    <Link to={`/panel/kalendarz?date=${clinicDate(c.start)}&wizyta=${c.id}`}>{c.patientName}</Link>
                  </li>
                ))}
              </ul>
            </Notice>
          )}
          <Button type="submit" variant="secondary" icon={<Lock size={18} />} loading={blockM.isPending} disabled={!block.practitionerId} style={{ alignSelf: 'flex-start' }}>
            {t('Zablokuj')}
          </Button>
        </form>
      </Card>
    </div>
  );
}

// --- wysyłka powiadomień ---------------------------------------------------------------------------------

interface OutboxItem {
  id: string;
  channel: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  attempts: number;
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

export function OutboxPage() {
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['outbox'], queryFn: () => get<{ items: OutboxItem[] }>('/api/staff/outbox') });
  const statusBadge = (s: string, err: string | null) =>
    s === 'sent' ? <Badge kind="ok">{t('wysłano')}</Badge> : s === 'pending' ? <Badge kind="info">{t('w kolejce')}</Badge> : s === 'skipped' ? <Badge kind="warn">{err === 'provider_not_configured' ? t('kanał nieskonfigurowany') : t('pominięto')}</Badge> : <Badge kind="danger">{t('błąd')}</Badge>;
  return (
    <div className="stack-lg">
      <PageHead title={t('Wysłane przypomnienia i powiadomienia')} sub={t('E-mail, SMS i push wysyłane są wyłącznie za zgodą pacjenta. Treść nie zawiera danych medycznych.')} />
      {q.isLoading && <Skeleton />}
      {q.isError && <QueryError error={q.error} />}
      {q.data && q.data.items.length === 0 && <Empty title={t('Brak wysyłek')} />}
      {q.data && q.data.items.length > 0 && (
        <div className="card card-flush table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('Utworzono')}</th>
                <th scope="col">{t('Kanał')}</th>
                <th scope="col">{t('Odbiorca')}</th>
                <th scope="col">{t('Treść')}</th>
                <th scope="col">{t('Status')}</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((o) => (
                <tr key={o.id}>
                  <td className="nowrap">{fmt.dateTime(o.created_at)}</td>
                  <td>{o.channel}</td>
                  <td className="mono small">{o.recipient}</td>
                  <td>
                    <strong>{o.subject}</strong>
                    <div className="small muted">{o.body}</div>
                  </td>
                  <td>{statusBadge(o.status, o.error)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- administracja ---------------------------------------------------------------------------------------

type AdminTab = 'settings' | 'users' | 'services' | 'integrations' | 'audit' | 'requests';

export function AdminPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<AdminTab>('settings');
  return (
    <div className="stack-lg">
      <PageHead title={t('Administracja')} />
      <Tabs
        label={t('Administracja')}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'settings', label: t('Placówka') },
          { value: 'users', label: t('Personel') },
          { value: 'services', label: t('Usługi i lekarze') },
          { value: 'integrations', label: t('Integracje') },
          { value: 'audit', label: t('Dziennik zdarzeń') },
          { value: 'requests', label: t('Wnioski pacjentów') },
        ]}
      />
      {tab === 'settings' && <SettingsTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'services' && <CatalogTab />}
      {tab === 'integrations' && <IntegrationsTab />}
      {tab === 'audit' && <AuditTab />}
      {tab === 'requests' && <RequestsTab />}
    </div>
  );
}

interface Settings {
  name: string;
  phone: string;
  email: string;
  address: string;
  cancelMinHours: number;
  reminderOffsetsHours: number[];
  emergencyInfo: string;
  messageResponseDays: number;
  privacyContact: string;
}

function SettingsTab() {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-settings'], queryFn: () => get<Settings>('/api/admin/settings') });
  const [f, setF] = useState<Settings | null>(null);
  const cur = f ?? q.data;
  const save = useMutation({
    mutationFn: () => put<Settings>('/api/admin/settings', cur),
    onSuccess: () => {
      toast(t('Zapisano ustawienia.'));
      void qc.invalidateQueries({ queryKey: ['public-config'] });
    },
  });
  if (!cur) return <Skeleton count={3} />;
  const set = (patch: Partial<Settings>) => setF({ ...cur, ...patch });
  return (
    <Card>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid-2">
          <TextField label={t('Nazwa placówki')} value={cur.name} onChange={(e) => set({ name: e.target.value })} />
          <TextField label={t('Telefon rejestracji')} value={cur.phone} onChange={(e) => set({ phone: e.target.value })} />
          <TextField label={t('E-mail')} value={cur.email} onChange={(e) => set({ email: e.target.value })} />
          <TextField label={t('Adres')} value={cur.address} onChange={(e) => set({ address: e.target.value })} />
          <TextField label={t('Odwołanie online najpóźniej (godz. przed wizytą)')} type="number" min={0} max={168} value={cur.cancelMinHours} onChange={(e) => set({ cancelMinHours: Number(e.target.value) })} />
          <TextField
            label={t('Przypomnienia (godz. przed wizytą, po przecinku)')}
            value={cur.reminderOffsetsHours.join(', ')}
            onChange={(e) => set({ reminderOffsetsHours: e.target.value.split(',').map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0) })}
          />
          <TextField label={t('Czas odpowiedzi na wiadomości (dni)')} type="number" min={1} max={14} value={cur.messageResponseDays} onChange={(e) => set({ messageResponseDays: Number(e.target.value) })} />
          <TextField label={t('Kontakt do inspektora ochrony danych')} value={cur.privacyContact} onChange={(e) => set({ privacyContact: e.target.value })} />
        </div>
        <TextArea label={t('Informacja o stanach nagłych')} value={cur.emergencyInfo} onChange={(e) => set({ emergencyInfo: e.target.value })} maxLength={300} />
        {save.isError && <Notice kind="danger">{errorMessage(save.error, t)}</Notice>}
        <Button type="submit" loading={save.isPending} style={{ alignSelf: 'flex-start' }}>
          {t('Zapisz')}
        </Button>
      </form>
    </Card>
  );
}

interface UserRow {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  fhirRef: string | null;
  status: string;
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  locked: boolean;
}

function UsersTab() {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const { me } = useSession();
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [f, setF] = useState({ email: '', displayName: '', roles: ['reception'] as string[], practitionerId: '' });
  const users = useQuery({ queryKey: ['admin-users'], queryFn: () => get<{ items: UserRow[] }>('/api/admin/users') });
  const catalog = useQuery({ queryKey: ['admin-catalog'], queryFn: () => get<{ practitioners: PractitionerView[] }>('/api/admin/catalog') });
  const create = useMutation({
    mutationFn: () => post<{ user: UserRow; temporaryPassword: string }>('/api/admin/users', { ...f, practitionerId: f.practitionerId || undefined }),
    onSuccess: (r) => {
      setOpen(false);
      setCreated({ email: r.user.email, password: r.temporaryPassword });
      void qc.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });
  const update = useMutation({ mutationFn: ({ id, body }: { id: string; body: object }) => put(`/api/admin/users/${id}`, body), onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-users'] }) });
  const resetMfa = useMutation({ mutationFn: (id: string) => post(`/api/admin/users/${id}/reset-mfa`), onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-users'] }) });
  const resetPw = useMutation({ mutationFn: (u: UserRow) => post<{ temporaryPassword: string }>(`/api/admin/users/${u.id}/reset-password`).then((r) => ({ ...r, email: u.email })), onSuccess: (r) => setCreated({ email: r.email, password: r.temporaryPassword }) });
  const roleLabel: Record<string, string> = { admin: 'Administrator', reception: 'Rejestracja', practitioner: 'Lekarz' };
  return (
    <div className="stack">
      <Button icon={<UserPlus size={18} />} onClick={() => setOpen(true)} style={{ alignSelf: 'flex-start' }}>
        {t('Dodaj konto personelu')}
      </Button>
      {users.isLoading && <Skeleton />}
      {users.data && (
        <div className="card card-flush table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('Osoba')}</th>
                <th scope="col">{t('Role')}</th>
                <th scope="col">MFA</th>
                <th scope="col">{t('Ostatnie logowanie')}</th>
                <th scope="col">{t('Status')}</th>
                <th scope="col"><span className="sr-only">{t('Akcje')}</span></th>
              </tr>
            </thead>
            <tbody>
              {users.data.items.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.displayName}</strong>
                    <div className="small muted">{u.email}</div>
                  </td>
                  <td>{u.roles.map((r) => t(roleLabel[r] ?? r)).join(', ')}</td>
                  <td>{u.mfaEnabled ? <Badge kind="ok">{t('włączone')}</Badge> : <Badge kind="warn">{t('przy logowaniu')}</Badge>}</td>
                  <td>{u.lastLoginAt ? fmt.dateTime(u.lastLoginAt) : '—'}</td>
                  <td>{u.status === 'active' ? (u.locked ? <Badge kind="danger">{t('zablokowane')}</Badge> : <Badge kind="ok">{t('aktywne')}</Badge>) : <Badge>{t('wyłączone')}</Badge>}</td>
                  <td>
                    {u.id !== me?.user?.id && (
                      <div className="row" style={{ gap: 4 }}>
                        <Button size="sm" variant="ghost" onClick={() => resetPw.mutate(u)}>
                          {t('Reset hasła')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => resetMfa.mutate(u.id)}>
                          {t('Reset MFA')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: u.id, body: { status: u.status === 'active' ? 'disabled' : 'active' } })}>
                          {u.status === 'active' ? t('Wyłącz') : t('Włącz')}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={t('Nowe konto personelu')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              {t('Anuluj')}
            </Button>
            <Button onClick={() => create.mutate()} loading={create.isPending}>
              {t('Utwórz')}
            </Button>
          </>
        }
      >
        <div className="stack">
          <TextField label={t('Imię i nazwisko')} value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} />
          <TextField label={t('E-mail służbowy')} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <fieldset style={{ border: 0, padding: 0 }}>
            <legend style={{ fontWeight: 600 }}>{t('Role')}</legend>
            {(['reception', 'practitioner', 'admin'] as const).map((r) => (
              <Checkbox key={r} label={t(roleLabel[r])} checked={f.roles.includes(r)} onChange={(e) => setF({ ...f, roles: e.target.checked ? [...f.roles, r] : f.roles.filter((x) => x !== r) })} />
            ))}
          </fieldset>
          {f.roles.includes('practitioner') && (
            <SelectField label={t('Powiązany lekarz')} value={f.practitionerId} onChange={(e) => setF({ ...f, practitionerId: e.target.value })}>
              <option value="">{t('Wybierz…')}</option>
              {catalog.data?.practitioners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectField>
          )}
          <p className="small muted">{t('Konto otrzyma hasło tymczasowe; przy pierwszym logowaniu wymagana jest zmiana hasła i konfiguracja MFA.')}</p>
          {create.isError && <Notice kind="danger">{errorMessage(create.error, t)}</Notice>}
        </div>
      </Modal>
      <Modal open={!!created} onClose={() => setCreated(null)} title={t('Hasło tymczasowe')}>
        {created && (
          <div className="stack">
            <p>{created.email}</p>
            <p className="mono" style={{ fontSize: '1.4rem', fontWeight: 700 }}>{created.password}</p>
            <Notice kind="warn">{t('Przekaż hasło osobiście lub innym bezpiecznym kanałem. Nie będzie ponownie wyświetlone.')}</Notice>
          </div>
        )}
      </Modal>
    </div>
  );
}

function CatalogTab() {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-catalog'], queryFn: () => get<{ services: ServiceView[]; practitioners: PractitionerView[]; locations: LocationView[]; questionnaires: { id: string; title: string }[] }>('/api/admin/catalog') });
  const [svc, setSvc] = useState<Partial<ServiceView> | null>(null);
  const saveSvc = useMutation({
    mutationFn: () => {
      const body = { ...svc, durationMinutes: Number(svc?.durationMinutes ?? 20), price: svc?.price === undefined || (svc.price as unknown) === '' ? undefined : Number(svc.price), locationIds: svc?.locationIds ?? [], active: svc?.active ?? true, questionnaireId: svc?.questionnaireId || undefined };
      return svc?.id ? put(`/api/admin/services/${svc.id}`, body) : post('/api/admin/services', body);
    },
    onSuccess: () => {
      setSvc(null);
      void qc.invalidateQueries({ queryKey: ['admin-catalog'] });
      void qc.invalidateQueries({ queryKey: ['catalog'] });
    },
  });
  if (q.isLoading) return <Skeleton />;
  if (q.isError) return <QueryError error={q.error} />;
  return (
    <div className="grid-2">
      <Card title={t('Usługi')} action={<Button size="sm" onClick={() => setSvc({ mode: 'in-person', durationMinutes: 20, active: true, locationIds: q.data!.locations.slice(0, 1).map((l) => l.id) })}>{t('Dodaj')}</Button>} className="card-flush" as="section">
        <ul className="list">
          {q.data!.services.map((s) => (
            <li key={s.id}>
              <button type="button" className="list-item" onClick={() => setSvc(s)}>
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>
                    {s.name} {!s.active && <Badge>{t('nieaktywna')}</Badge>}
                  </span>
                  <span className="list-sub">
                    {s.durationMinutes} min · {s.mode === 'tele' ? t('teleporada') : t('stacjonarnie')} {s.price !== undefined ? `· ${fmt.money(s.price)}` : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
      <Card title={t('Lekarze')} className="card-flush" as="section">
        <ul className="list">
          {q.data!.practitioners.map((p) => (
            <li key={p.id} className="list-item">
              <span className="grow">
                <span className="list-title" style={{ display: 'block' }}>{p.name}</span>
                <span className="list-sub">
                  {p.specialty} · {p.serviceIds.map((id) => q.data!.services.find((s) => s.id === id)?.name).filter(Boolean).join(', ')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Modal
        open={!!svc}
        onClose={() => setSvc(null)}
        title={svc?.id ? t('Edycja usługi') : t('Nowa usługa')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setSvc(null)}>
              {t('Anuluj')}
            </Button>
            <Button onClick={() => saveSvc.mutate()} loading={saveSvc.isPending}>
              {t('Zapisz')}
            </Button>
          </>
        }
      >
        {svc && (
          <div className="stack">
            <TextField label={t('Nazwa')} value={svc.name ?? ''} onChange={(e) => setSvc({ ...svc, name: e.target.value })} />
            <div className="grid-2">
              <TextField label={t('Czas trwania (min)')} type="number" value={svc.durationMinutes ?? 20} onChange={(e) => setSvc({ ...svc, durationMinutes: Number(e.target.value) })} />
              <TextField label={t('Cena (PLN)')} type="number" value={svc.price ?? ''} onChange={(e) => setSvc({ ...svc, price: e.target.value === '' ? undefined : Number(e.target.value) })} />
              <SelectField label={t('Forma')} value={svc.mode} onChange={(e) => setSvc({ ...svc, mode: e.target.value as 'tele' | 'in-person' })}>
                <option value="in-person">{t('Stacjonarnie')}</option>
                <option value="tele">{t('Teleporada')}</option>
              </SelectField>
              <SelectField label={t('Wywiad przed wizytą')} value={svc.questionnaireId ?? ''} onChange={(e) => setSvc({ ...svc, questionnaireId: e.target.value || undefined })}>
                <option value="">{t('Brak')}</option>
                {q.data!.questionnaires.map((qq) => (
                  <option key={qq.id} value={qq.id}>
                    {qq.title}
                  </option>
                ))}
              </SelectField>
            </div>
            <TextArea label={t('Opis')} value={svc.description ?? ''} onChange={(e) => setSvc({ ...svc, description: e.target.value })} maxLength={500} />
            <TextArea label={t('Przygotowanie (widoczne dla pacjenta)')} value={svc.preparation ?? ''} onChange={(e) => setSvc({ ...svc, preparation: e.target.value })} maxLength={500} />
            <Checkbox label={t('Usługa aktywna (widoczna w rezerwacji)')} checked={svc.active ?? true} onChange={(e) => setSvc({ ...svc, active: e.target.checked })} />
            {saveSvc.isError && <Notice kind="danger">{errorMessage(saveSvc.error, t)}</Notice>}
          </div>
        )}
      </Modal>
    </div>
  );
}

interface Integration {
  id: string;
  name: string;
  category: string;
  cost: string;
  status: string;
  purpose: string;
  config: string;
  docs: string;
  health?: { ok: boolean; detail: string; checkedAt: string };
}

function IntegrationsTab() {
  const { t } = useI18n();
  const [health, setHealth] = useState(false);
  const q = useQuery({ queryKey: ['integrations-admin', health], queryFn: () => get<{ items: Integration[] }>(`/api/admin/integrations${qs({ health: health ? '1' : undefined })}`) });
  const statusBadge: Record<string, React.ReactNode> = {
    active: <Badge kind="ok">{t('aktywna')}</Badge>,
    'not-configured': <Badge kind="warn">{t('wymaga konfiguracji')}</Badge>,
    disabled: <Badge>{t('wyłączona')}</Badge>,
    'requires-agreement': <Badge kind="info">{t('wymaga umowy')}</Badge>,
    'requires-certification': <Badge kind="info">{t('wymaga certyfikacji')}</Badge>,
  };
  const costLabel: Record<string, string> = { free: 'bezpłatna', 'free-registration': 'bezpłatna po rejestracji', paid: 'płatna', partner: 'umowa partnerska' };
  return (
    <div className="stack">
      <div className="row-between">
        <p className="small muted" style={{ margin: 0 }}>{t('Stan połączeń z usługami zewnętrznymi. Klucze i sekrety konfiguruje się w zmiennych środowiskowych serwera.')}</p>
        <Button size="sm" variant="secondary" onClick={() => setHealth(true)} loading={q.isFetching && health}>
          {t('Sprawdź połączenia')}
        </Button>
      </div>
      {q.isLoading && <Skeleton />}
      <div className="grid-2">
        {q.data?.items.map((i) => (
          <Card key={i.id} title={<h3 style={{ margin: 0 }}>{i.name}</h3>} action={statusBadge[i.status]}>
            <p className="small">{i.purpose}</p>
            <p className="small muted" style={{ margin: 0 }}>
              {t(costLabel[i.cost] ?? i.cost)} · <span className="mono">{i.config}</span>
            </p>
            {i.health && (
              <p className="small" style={{ marginTop: 8, marginBottom: 0 }}>
                {i.health.ok ? <CheckCircle2 size={15} color="var(--success)" aria-hidden /> : <CircleAlert size={15} color="var(--danger)" aria-hidden />} {i.health.detail}
              </p>
            )}
            {!i.health && health && i.status === 'active' && (
              <p className="small muted" style={{ marginTop: 8, marginBottom: 0 }}>
                <CircleDashed size={15} aria-hidden /> {t('bez testu połączenia')}
              </p>
            )}
            <a href={i.docs} target="_blank" rel="noopener noreferrer" className="small">
              {t('Dokumentacja')}
            </a>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface AuditRow {
  seq: number;
  ts: string;
  actor_display: string | null;
  actor_roles: string | null;
  action: string;
  subtype: string;
  entity_ref: string | null;
  patient_ref: string | null;
  outcome: string;
  ip: string | null;
}

function AuditTab() {
  const { t, fmt } = useI18n();
  const [patientRef, setPatientRef] = useState('');
  const q = useQuery({ queryKey: ['audit', patientRef], queryFn: () => get<{ items: AuditRow[] }>(`/api/admin/audit${qs({ patientRef: patientRef || undefined, limit: 200 })}`) });
  const verify = useMutation({ mutationFn: () => get<{ ok: boolean; count: number; brokenAt?: number }>('/api/admin/audit/verify') });
  return (
    <div className="stack">
      <div className="row-between">
        <input className="input" style={{ maxWidth: 360 }} placeholder={t('Filtr: Patient/<id>')} value={patientRef} onChange={(e) => setPatientRef(e.target.value.trim())} aria-label={t('Filtr pacjenta')} />
        <Button variant="secondary" icon={<ShieldCheck size={18} />} onClick={() => verify.mutate()} loading={verify.isPending}>
          {t('Zweryfikuj integralność dziennika')}
        </Button>
      </div>
      {verify.data && (
        <Notice kind={verify.data.ok ? 'ok' : 'danger'}>
          {verify.data.ok ? t('Łańcuch HMAC poprawny — {n} wpisów, brak modyfikacji.', { n: verify.data.count }) : t('NARUSZENIE integralności przy wpisie #{n}.', { n: verify.data.brokenAt ?? 0 })}
        </Notice>
      )}
      {q.isLoading && <Skeleton />}
      {q.data && (
        <div className="card card-flush table-wrap" style={{ maxHeight: 560, overflowY: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">{t('Czas')}</th>
                <th scope="col">{t('Kto')}</th>
                <th scope="col">{t('Zdarzenie')}</th>
                <th scope="col">{t('Zasób')}</th>
                <th scope="col">{t('Wynik')}</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((r) => (
                <tr key={r.seq}>
                  <td className="mono small">{r.seq}</td>
                  <td className="nowrap small">{fmt.dateTime(r.ts)}</td>
                  <td className="small">
                    {r.actor_display ?? '—'} <span className="muted">{r.actor_roles}</span>
                  </td>
                  <td className="small">
                    <span className="mono">{r.action}</span> {r.subtype}
                  </td>
                  <td className="mono small">{r.entity_ref ?? ''}</td>
                  <td>{r.outcome === 'success' ? <Badge kind="ok">OK</Badge> : <Badge kind="danger">{t('błąd')}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RequestsTab() {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin-requests'], queryFn: () => get<{ items: UserRow[] }>('/api/admin/users?scope=deletion') });
  const close = useMutation({ mutationFn: (id: string) => post(`/api/admin/users/${id}/close`), onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin-requests'] }) });
  return (
    <Card title={t('Wnioski o usunięcie konta')}>
      <p className="small muted">{t('Zamknięcie konta usuwa dostęp online i dane logowania. Dokumentacja medyczna pozostaje w repozytorium FHIR zgodnie z obowiązkiem przechowywania.')}</p>
      {q.data && q.data.items.length === 0 && <Empty title={t('Brak wniosków')} />}
      <ul className="list">
        {q.data?.items.map((u) => (
          <li key={u.id} className="list-item" style={{ padding: '10px 0' }}>
            <span className="grow">
              <strong>{u.displayName}</strong> <span className="small muted">{u.email} · {u.lastLoginAt ? fmt.date(u.lastLoginAt) : ''}</span>
            </span>
            <Button size="sm" variant="danger-outline" icon={<Trash2 size={15} />} onClick={() => close.mutate(u.id)} loading={close.isPending}>
              {t('Zamknij konto')}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
