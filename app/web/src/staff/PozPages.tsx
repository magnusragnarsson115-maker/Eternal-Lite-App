import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ClipboardList, HeartPulse, Plus, UserCheck, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { del, get, post, put, qs } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { hasRole, useSession } from '../session';
import type { PatientView } from '../types';
import { Badge, Button, Card, Checkbox, Combobox, Empty, Modal, Notice, PageHead, QueryError, SelectField, Skeleton, Tabs, TextArea, TextField, useConfirm, useToast } from '../ui';

/**
 * Profile placówek — ekrany personelu: wybór profilu (administrator), POZ (deklaracje, opieka koordynowana, bilans
 * „Moje Zdrowie”), plan IPOM w karcie pacjenta i zadania profilu na pulpicie.
 */

export type Feature = 'poz' | 'aesthetic';

export function useClinicFeatures(enabled = true) {
  const q = useQuery({ queryKey: ['clinic-profile'], queryFn: () => get<{ profiles: { id: string; name: string }[]; features: Feature[] }>('/api/staff/clinic-profile'), enabled, staleTime: 300_000 });
  return { features: q.data?.features ?? [], profiles: q.data?.profiles ?? [], loaded: q.isSuccess };
}

const todayIso = () => new Date().toISOString().slice(0, 10);

// --- administracja: profil placówki ---------------------------------------------------------------------------------

interface ProfilePreview {
  id: string;
  name: string;
  version: string;
  forWhom: string;
  active: boolean;
  needs: { need: string; where: string }[];
  gaps: { gap: string; why: string }[];
  legal: string[];
  interviews: string[];
  changes: {
    features: Feature[];
    modules: { id: string; name: string }[];
    services: { name: string; durationMinutes: number; mode: string; requiresPhysician?: boolean }[];
    servicesKept: string[];
    requiredDocuments: string[];
    noteTemplates: string[];
    specialties: string[];
  };
}

const IPOM_KIND_LABEL: Record<string, string> = { wizyta: 'Wizyta kontrolna', badanie: 'Badanie', konsultacja: 'Konsultacja specjalistyczna', edukacja: 'Porada edukacyjna', dietetyk: 'Porada dietetyczna' };

function ProfileCard({ p, onApplied }: { p: ProfilePreview; onApplied: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [open, setOpen] = useState(false);
  const apply = useMutation({
    mutationFn: () => post<ProfilePreview>(`/api/admin/clinic-profiles/${p.id}/apply`),
    onSuccess: () => (toast(t('Profil zastosowany. Dodane elementy możesz zmieniać jak zwykłe ustawienia.')), onApplied()),
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  const remove = useMutation({ mutationFn: () => del(`/api/admin/clinic-profiles/${p.id}`), onSuccess: onApplied });
  const c = p.changes;
  const nothing = !c.modules.length && !c.services.length && !c.requiredDocuments.length && !c.noteTemplates.length && !c.specialties.length && !c.features.length;
  return (
    <Card title={<h3 style={{ margin: 0 }}>{t(p.name)}</h3>} action={p.active ? <Badge kind="ok">{t('włączony')}</Badge> : undefined}>
      {dialog}
      <p className="small muted">{t(p.forWhom)}</p>
      <details className="explain" open={open} onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
        <summary>{t('Co realnie potrzebuje taka placówka — i gdzie to jest')}</summary>
        <ul className="profile-needs">
          {p.needs.map((n) => (
            <li key={n.need}>
              <CheckCircle2 size={15} aria-hidden /> <span>{t(n.need)}</span>
              <span className="small muted">→ {t(n.where)}</span>
            </li>
          ))}
        </ul>
        <h4 className="small" style={{ margin: '10px 0 4px' }}>{t('Czego jeszcze brakuje')}</h4>
        <ul className="profile-needs">
          {p.gaps.map((g) => (
            <li key={g.gap}>
              <XCircle size={15} aria-hidden className="text-warn" /> <span>{t(g.gap)}</span>
              <span className="small muted">{t(g.why)}</span>
            </li>
          ))}
        </ul>
        <h4 className="small" style={{ margin: '10px 0 4px' }}>{t('Zasady, które profil uwzględnia')}</h4>
        <ul className="small">
          {p.legal.map((l) => (
            <li key={l}>{t(l)}</li>
          ))}
        </ul>
      </details>
      <div className="stack-sm" style={{ marginTop: 10 }}>
        <p className="small" style={{ margin: 0 }}>
          <strong>{t('Po zastosowaniu (tylko dodaje):')}</strong>{' '}
          {nothing
            ? t('wszystko jest już ustawione.')
            : [
                c.features.length ? t('funkcje profilu: {f}', { f: c.features.map((f) => (f === 'poz' ? t('POZ') : t('zabiegi'))).join(', ') }) : '',
                c.modules.length ? t('moduły: {n}', { n: c.modules.length }) : '',
                c.services.length ? t('usługi: {n}', { n: c.services.length }) : '',
                c.requiredDocuments.length ? t('wymagane dokumenty: {n}', { n: c.requiredDocuments.length }) : '',
                c.noteTemplates.length ? t('szablony notatek: {n}', { n: c.noteTemplates.length }) : '',
              ]
                .filter(Boolean)
                .join(' · ')}
        </p>
        {c.services.length > 0 && <p className="small muted" style={{ margin: 0 }}>{c.services.map((s) => t(s.name)).join(', ')}</p>}
        <div className="btn-row">
          {!p.active || !nothing ? (
            <Button
              size="sm"
              loading={apply.isPending}
              onClick={async () => {
                if (await confirm({ title: t('Zastosować profil „{p}”?', { p: t(p.name) }), body: t('Profil doda brakujące usługi, dokumenty, szablony i moduły. Niczego nie usuwa ani nie nadpisuje.'), confirmLabel: t('Zastosuj') })) apply.mutate();
              }}
            >
              {p.active ? t('Uzupełnij brakujące') : t('Zastosuj profil')}
            </Button>
          ) : null}
          {p.active && (
            <Button size="sm" variant="ghost" loading={remove.isPending} onClick={() => remove.mutate()}>
              {t('Wyłącz funkcje profilu')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export function ClinicProfilesTab() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin-clinic-profiles'], queryFn: () => get<{ items: ProfilePreview[]; ipomLimits: Record<string, number> }>('/api/admin/clinic-profiles') });
  const [limits, setLimits] = useState<Record<string, string> | null>(null);
  const saveLimits = useMutation({
    mutationFn: () => put('/api/admin/ipom-limits', { limits: Object.fromEntries(Object.entries(limits ?? {}).filter(([, v]) => v !== '').map(([k, v]) => [k, Number(v)])) }),
    onSuccess: () => (toast(t('Zapisano limity.')), void qc.invalidateQueries({ queryKey: ['admin-clinic-profiles'] })),
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['admin-clinic-profiles'] });
    void qc.invalidateQueries({ queryKey: ['clinic-profile'] });
    void qc.invalidateQueries({ queryKey: ['admin-catalog'] });
    void qc.invalidateQueries({ queryKey: ['modules'] });
  };
  if (q.isLoading) return <Skeleton />;
  if (q.isError) return <QueryError error={q.error} />;
  const pozOn = q.data!.items.find((p) => p.id === 'poz')?.active;
  const lim = limits ?? Object.fromEntries(Object.keys(IPOM_KIND_LABEL).map((k) => [k, q.data!.ipomLimits[k] !== undefined ? String(q.data!.ipomLimits[k]) : '']));
  return (
    <div className="stack">
      <Notice kind="info">{t('Profil dopasowuje Eternal do rodzaju placówki: usługi, dokumenty, szablony notatek, moduły i funkcje (np. deklaracje POZ, karta zabiegu). Placówka może mieć kilka profili. Każdy profil pokazuje też, czego jeszcze nie ma.')}</Notice>
      <div className="grid-2">
        {q.data!.items.map((p) => (
          <ProfileCard key={p.id} p={p} onApplied={refresh} />
        ))}
      </div>
      {pozOn && (
        <Card title={t('Opieka koordynowana — roczne limity pozycji planu')}>
          <p className="small muted">{t('Ustaw według aktualnego zarządzenia Prezesa NFZ i umowy placówki. Aplikacja liczy wykorzystanie — nie decyduje o kwalifikacji pacjenta.')}</p>
          <div className="grid-3">
            {Object.entries(IPOM_KIND_LABEL).map(([k, label]) => (
              <TextField key={k} label={t(label)} type="number" min={0} max={100} value={lim[k] ?? ''} onChange={(e) => setLimits({ ...lim, [k]: e.target.value })} hint={t('puste = bez limitu')} />
            ))}
          </div>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <Button size="sm" disabled={!limits} loading={saveLimits.isPending} onClick={() => saveLimits.mutate()}>
              {t('Zapisz limity')}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

// --- zadania profilu na pulpicie ------------------------------------------------------------------------------------

export function ProfileTasksCard() {
  const { t } = useI18n();
  const { features, loaded } = useClinicFeatures();
  const q = useQuery({
    queryKey: ['profile-tasks'],
    queryFn: () =>
      get<{
        poz?: { declarationsPending: number; ipomOverdue: number; ipomMine: number; activePlans: number };
        aesthetic?: { controlsThisWeek: number; drafts: number; consentsToSign: number; lotsExpiringSoon: number; lotsExpired: number; openComplications: number };
      }>('/api/staff/profile-tasks'),
    enabled: loaded && features.length > 0,
  });
  if (!features.length || !q.data) return null;
  const row = (to: string, n: number, label: string, warn = false) => (
    <li key={label}>
      <Link to={to} className="profile-task">
        <span className={`count ${n > 0 && warn ? 'warn' : ''}`}>{n}</span> <span>{label}</span>
      </Link>
    </li>
  );
  return (
    <Card title={t('Zadania placówki')}>
      <ul className="profile-tasks">
        {q.data.poz && [
          row('/panel/poz', q.data.poz.declarationsPending, t('deklaracje POZ do przyjęcia'), true),
          row('/panel/poz?tab=ipom', q.data.poz.ipomOverdue, t('zaległe pozycje IPOM'), true),
          row('/panel/poz?tab=ipom', q.data.poz.ipomMine, t('plany, w których jestem koordynatorem')),
        ]}
        {q.data.aesthetic && [
          row('/panel/zabiegi', q.data.aesthetic.controlsThisWeek, t('kontrole po zabiegu w tym tygodniu')),
          row('/panel/zabiegi', q.data.aesthetic.consentsToSign, t('zgody czekające na podpis')),
          row('/panel/zabiegi', q.data.aesthetic.drafts, t('niepodpisane karty zabiegu'), true),
          row('/panel/zabiegi?tab=produkty', q.data.aesthetic.lotsExpired + q.data.aesthetic.lotsExpiringSoon, t('partie po terminie lub z krótką datą'), true),
          row('/panel/zabiegi?tab=powiklania', q.data.aesthetic.openComplications, t('otwarte powikłania'), true),
        ]}
      </ul>
    </Card>
  );
}

// --- POZ ------------------------------------------------------------------------------------------------------------

interface Declaration {
  id: string;
  patientId: string;
  patientName: string;
  kind: 'lekarz' | 'pielegniarka' | 'polozna';
  practitionerId: string;
  practitionerName: string;
  source: 'papier' | 'ikp';
  status: 'zlozona' | 'przyjeta' | 'odrzucona' | 'wycofana' | 'zastapiona';
  reason?: string;
  submittedOn: string;
  decidedAt?: string;
  decidedBy?: string;
}

interface PozMeta {
  kinds: string[];
  groups: Record<string, string>;
  itemKinds: string[];
  practitioners: { id: string; name: string; profession?: string }[];
  coordinators: { userId: string; name: string }[];
  limits: Record<string, number>;
}

export const DECL_KIND_LABEL: Record<string, string> = { lekarz: 'lekarz POZ', pielegniarka: 'pielęgniarka POZ', polozna: 'położna POZ' };
export const DECL_STATUS_LABEL: Record<string, string> = { zlozona: 'złożona', przyjeta: 'przyjęta', odrzucona: 'odrzucona', wycofana: 'wycofana', zastapiona: 'zastąpiona nową' };
const DECL_STATUS_KIND: Record<string, 'ok' | 'warn' | 'danger' | 'info' | undefined> = { zlozona: 'warn', przyjeta: 'ok', odrzucona: 'danger', wycofana: undefined, zastapiona: undefined };

function NewDeclarationModal({ open, onClose, meta }: { open: boolean; onClose: () => void; meta?: PozMeta }) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [patient, setPatient] = useState<{ id: string; name: string } | null>(null);
  const [kind, setKind] = useState('lekarz');
  const [practitionerId, setPractitionerId] = useState('');
  const [source, setSource] = useState<'papier' | 'ikp'>('papier');
  const [date, setDate] = useState(todayIso());
  const save = useMutation({
    mutationFn: () => post('/api/staff/poz/declarations', { patientId: patient!.id, kind, practitionerId, source, submittedOn: date }),
    onSuccess: () => {
      toast(t('Zapisano deklarację.'));
      void qc.invalidateQueries({ queryKey: ['poz-declarations'] });
      setPatient(null);
      setPractitionerId('');
      onClose();
    },
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  const options = (meta?.practitioners ?? []).filter((p) => !p.profession || p.profession === kind);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Nowa deklaracja POZ')}
      footer={
        <Button disabled={!patient || !practitionerId} loading={save.isPending} onClick={() => save.mutate()}>
          {t('Zapisz deklarację')}
        </Button>
      }
    >
      <div className="stack">
        {patient ? (
          <p>
            {t('Pacjent')}: <strong>{patient.name}</strong>{' '}
            <button type="button" className="link-btn" onClick={() => setPatient(null)}>
              {t('zmień')}
            </button>
          </p>
        ) : (
          <Combobox<PatientView>
            label={t('Pacjent')}
            placeholder={t('Nazwisko, PESEL lub telefon')}
            search={async (term, signal) => (await get<{ items: PatientView[] }>(`/api/staff/patients${qs({ q: term })}`, signal)).items}
            render={(p) => `${p.name}${p.birthDate ? ` · ${p.birthDate}` : ''}`}
            onSelect={(p) => setPatient({ id: p.id, name: p.name })}
          />
        )}
        <div className="grid-2">
          <SelectField label={t('Rodzaj deklaracji')} value={kind} onChange={(e) => (setKind(e.target.value), setPractitionerId(''))}>
            {(meta?.kinds ?? []).map((k) => (
              <option key={k} value={k}>
                {t(DECL_KIND_LABEL[k] ?? k)}
              </option>
            ))}
          </SelectField>
          <SelectField label={t('Osoba wybrana w deklaracji')} value={practitionerId} onChange={(e) => setPractitionerId(e.target.value)}>
            <option value="">—</option>
            {options.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </SelectField>
          <SelectField label={t('Sposób złożenia')} value={source} onChange={(e) => setSource(e.target.value as 'papier' | 'ikp')}>
            <option value="papier">{t('w przychodni (papier)')}</option>
            <option value="ikp">{t('elektronicznie w IKP')}</option>
          </SelectField>
          <TextField label={t('Data złożenia')} type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
        </div>
        <p className="small muted" style={{ margin: 0 }}>{t('Eternal prowadzi rejestr i statusy. Zgłoszenie deklaracji do NFZ wykonuje system rozliczeniowy placówki.')}</p>
      </div>
    </Modal>
  );
}

function DeclarationsTab() {
  const { t, fmt } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [status, setStatus] = useState('zlozona');
  const [adding, setAdding] = useState(false);
  const [reject, setReject] = useState<Declaration | null>(null);
  const [reason, setReason] = useState('');
  const meta = useQuery({ queryKey: ['poz-meta'], queryFn: () => get<PozMeta>('/api/staff/poz/meta') });
  const q = useQuery({
    queryKey: ['poz-declarations', status],
    queryFn: () => get<{ items: Declaration[]; active: { practitionerId: string; practitionerName: string; kind: string; count: number }[] }>(`/api/staff/poz/declarations${qs({ status: status || undefined })}`),
  });
  const decide = useMutation({
    mutationFn: (v: { id: string; action: 'accept' | 'reject' | 'withdraw'; reason?: string }) => post(`/api/staff/poz/declarations/${v.id}/decision`, { action: v.action, reason: v.reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['poz-declarations'] });
      void qc.invalidateQueries({ queryKey: ['profile-tasks'] });
      setReject(null);
      setReason('');
    },
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  return (
    <div className="stack">
      <div className="row-between">
        <div className="segmented" role="group" aria-label={t('Status deklaracji')}>
          {[
            ['zlozona', t('do przyjęcia')],
            ['przyjeta', t('przyjęte')],
            ['odrzucona', t('odrzucone')],
            ['', t('wszystkie')],
          ].map(([v, l]) => (
            <button key={v} type="button" aria-pressed={status === v} onClick={() => setStatus(v)}>
              {l}
            </button>
          ))}
        </div>
        <Button size="sm" icon={<Plus size={15} />} onClick={() => setAdding(true)}>
          {t('Nowa deklaracja')}
        </Button>
      </div>
      {q.data && q.data.active.length > 0 && (
        <Card title={t('Lista aktywna')}>
          <ul className="chips" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {q.data.active.map((a) => (
              <li key={`${a.practitionerId}-${a.kind}`} className="badge info">
                {a.practitionerName} · {t(DECL_KIND_LABEL[a.kind] ?? a.kind)}: {a.count}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card className="card-flush" as="section">
        {q.isLoading ? (
          <Skeleton />
        ) : q.isError ? (
          <QueryError error={q.error} />
        ) : !q.data!.items.length ? (
          <Empty title={t('Brak deklaracji w tym widoku')}>{t('Deklaracje złożone w przychodni i w IKP wpisuje rejestracja.')}</Empty>
        ) : (
          <ul className="list">
            {q.data!.items.map((d) => (
              <li key={d.id} className="list-item" style={{ flexWrap: 'wrap' }}>
                <span className="grow">
                  <Link to={`/panel/pacjenci/${d.patientId}`} className="list-title">
                    {d.patientName}
                  </Link>
                  <span className="list-sub" style={{ display: 'block' }}>
                    {t(DECL_KIND_LABEL[d.kind])}: {d.practitionerName} · {d.source === 'ikp' ? t('IKP') : t('papier')} · {fmt.date(d.submittedOn)}
                    {d.reason ? ` · ${d.reason}` : ''}
                  </span>
                </span>
                <Badge kind={DECL_STATUS_KIND[d.status]}>{t(DECL_STATUS_LABEL[d.status])}</Badge>
                {d.status === 'zlozona' && (
                  <span className="btn-row">
                    <Button size="sm" onClick={() => decide.mutate({ id: d.id, action: 'accept' })}>
                      {t('Przyjmij')}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setReject(d)}>
                      {t('Odrzuć')}
                    </Button>
                  </span>
                )}
                {d.status === 'przyjeta' && (
                  <Button size="sm" variant="ghost" onClick={() => decide.mutate({ id: d.id, action: 'withdraw' })}>
                    {t('Wycofaj')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <NewDeclarationModal open={adding} onClose={() => setAdding(false)} meta={meta.data} />
      <Modal
        open={!!reject}
        onClose={() => setReject(null)}
        title={t('Odrzucenie deklaracji')}
        footer={
          <Button variant="danger" disabled={reason.trim().length < 3} loading={decide.isPending} onClick={() => reject && decide.mutate({ id: reject.id, action: 'reject', reason })}>
            {t('Odrzuć deklarację')}
          </Button>
        }
      >
        <TextArea label={t('Powód (widoczny dla pacjenta w aplikacji)')} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={3} />
      </Modal>
    </div>
  );
}

interface PlanSummary {
  id: string;
  patientId: string;
  patientName: string;
  groups: string[];
  coordinator?: string;
  nextDue?: string;
  overdue: number;
  open: number;
}

function PlansTab() {
  const { t, fmt } = useI18n();
  const [filter, setFilter] = useState<'all' | 'overdue' | 'mine'>('all');
  const meta = useQuery({ queryKey: ['poz-meta'], queryFn: () => get<PozMeta>('/api/staff/poz/meta') });
  const q = useQuery({ queryKey: ['poz-plans', filter], queryFn: () => get<{ items: PlanSummary[] }>(`/api/staff/poz/ipom${qs({ overdue: filter === 'overdue' ? '1' : undefined, mine: filter === 'mine' ? '1' : undefined })}`) });
  return (
    <div className="stack">
      <div className="segmented" role="group" aria-label={t('Filtr planów')}>
        {[
          ['all', t('wszystkie aktywne')],
          ['overdue', t('z zaległościami')],
          ['mine', t('jestem koordynatorem')],
        ].map(([v, l]) => (
          <button key={v} type="button" aria-pressed={filter === v} onClick={() => setFilter(v as typeof filter)}>
            {l}
          </button>
        ))}
      </div>
      <Card className="card-flush" as="section">
        {q.isLoading ? (
          <Skeleton />
        ) : !q.data?.items.length ? (
          <Empty title={t('Brak planów w tym widoku')}>{t('IPOM zakłada lekarz w karcie pacjenta (zakładka „Opieka koordynowana”).')}</Empty>
        ) : (
          <ul className="list">
            {q.data.items.map((p) => (
              <li key={p.id}>
                <Link to={`/panel/pacjenci/${p.patientId}?tab=ipom`} className="list-item">
                  <span className="list-icon">
                    <HeartPulse size={18} aria-hidden />
                  </span>
                  <span className="grow">
                    <span className="list-title" style={{ display: 'block' }}>
                      {p.patientName}
                    </span>
                    <span className="list-sub">
                      {p.groups.map((g) => t(meta.data?.groups[g] ?? g)).join(', ')}
                      {p.coordinator ? ` · ${t('koordynator')}: ${p.coordinator}` : ` · ${t('bez koordynatora')}`}
                    </span>
                  </span>
                  {p.overdue > 0 && <Badge kind="warn">{t('zaległe: {n}', { n: p.overdue })}</Badge>}
                  <span className="small muted">{p.nextDue ? t('najbliżej: {d}', { d: fmt.date(p.nextDue) }) : t('otwarte: {n}', { n: p.open })}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

interface BzodItem {
  patientId: string;
  patientName: string;
  birthDate?: string;
  age?: number;
  intervalYears?: number;
  lastDone?: string;
  eligibleNow: boolean;
  nextYear?: number;
  reason: string;
}

function BzodTab() {
  const { t, fmt } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['poz-bzod'], queryFn: () => get<{ rule: string; source: string; items: BzodItem[] }>('/api/staff/poz/bzod') });
  const [mark, setMark] = useState<BzodItem | null>(null);
  const [date, setDate] = useState(todayIso());
  const save = useMutation({
    mutationFn: () => post(`/api/staff/patients/${mark!.patientId}/bzod`, { doneOn: date }),
    onSuccess: () => (toast(t('Zapisano wykonanie bilansu.')), setMark(null), void qc.invalidateQueries({ queryKey: ['poz-bzod'] })),
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  if (q.isLoading) return <Skeleton />;
  if (q.isError) return <QueryError error={q.error} />;
  const eligible = q.data!.items.filter((i) => i.eligibleNow);
  return (
    <div className="stack">
      <Notice kind="info" title={t('Bilans zdrowia osoby dorosłej „Moje Zdrowie”')}>
        {t(q.data!.rule)} {t('Lista obejmuje pacjentów z przyjętą deklaracją do lekarza POZ. Uprawnienie jest orientacyjne — ostatecznie potwierdza je IKP; badania dobiera ankieta programu i lekarz.')}
        <span className="small muted" style={{ display: 'block' }}>{q.data!.source}</span>
      </Notice>
      <Card title={t('Mogą skorzystać teraz ({n})', { n: eligible.length })} className="card-flush" as="section">
        {!q.data!.items.length ? (
          <Empty title={t('Brak pacjentów z deklaracją')} />
        ) : (
          <ul className="list">
            {q.data!.items.map((i) => (
              <li key={i.patientId} className="list-item" style={{ flexWrap: 'wrap' }}>
                <span className="grow">
                  <Link to={`/panel/pacjenci/${i.patientId}`} className="list-title">
                    {i.patientName}
                  </Link>
                  <span className="list-sub" style={{ display: 'block' }}>
                    {i.age !== undefined ? t('{n} lat (rocznikowo)', { n: i.age }) : t('brak daty urodzenia')}
                    {i.intervalYears ? ` · ${t('co {n} lat', { n: i.intervalYears })}` : ''}
                    {i.lastDone ? ` · ${t('ostatni bilans: {d}', { d: fmt.date(i.lastDone) })}` : ''}
                  </span>
                </span>
                {i.eligibleNow ? <Badge kind="ok">{t('może skorzystać')}</Badge> : <Badge>{i.nextYear ? t('od {y} r.', { y: i.nextYear }) : t('nie teraz')}</Badge>}
                <Button size="sm" variant="secondary" onClick={() => setMark(i)}>
                  {t('Zapisz wykonanie')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Modal
        open={!!mark}
        onClose={() => setMark(null)}
        title={t('Bilans wykonany — {p}', { p: mark?.patientName ?? '' })}
        footer={
          <Button loading={save.isPending} onClick={() => save.mutate()}>
            {t('Zapisz')}
          </Button>
        }
      >
        <TextField label={t('Data wizyty podsumowującej')} type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
      </Modal>
    </div>
  );
}

export function PozPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const { key } = useLocation();
  const linked = params.get('tab') === 'ipom' ? 'ipom' : params.get('tab') === 'bzod' ? 'bzod' : params.get('tab') === 'deklaracje' ? 'deklaracje' : null;
  const [tab, setTab] = useState<'deklaracje' | 'ipom' | 'bzod'>(linked ?? 'deklaracje');
  useEffect(() => {
    if (linked) setTab(linked);
  }, [linked, key]);
  return (
    <div className="stack-lg">
      <PageHead title={t('Podstawowa opieka zdrowotna')} sub={t('Deklaracje wyboru, opieka koordynowana (IPOM) i bilans „Moje Zdrowie”.')} />
      <Tabs
        label={t('POZ')}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'deklaracje', label: t('Deklaracje') },
          { value: 'ipom', label: t('Opieka koordynowana') },
          { value: 'bzod', label: t('Bilans dorosłych') },
        ]}
      />
      {tab === 'deklaracje' && <DeclarationsTab />}
      {tab === 'ipom' && <PlansTab />}
      {tab === 'bzod' && <BzodTab />}
    </div>
  );
}

// --- IPOM w karcie pacjenta -----------------------------------------------------------------------------------------

interface IpomItem {
  id: string;
  kind: string;
  title: string;
  dueOn?: string;
  status: 'zaplanowane' | 'zrealizowane' | 'odwolane';
  overdue: boolean;
  doneOn?: string;
  doneBy?: string;
  note?: string;
}
export interface IpomView {
  id: string;
  patientId: string;
  patientName: string;
  groups: string[];
  coordinator?: { userId: string; name: string };
  author?: string;
  status: 'aktywny' | 'zakonczony';
  note?: string;
  validFrom: string;
  items: IpomItem[];
  usage: { kind: string; done: number; planned: number; limit?: number }[];
}

const ITEM_STATUS_LABEL: Record<string, string> = { zaplanowane: 'zaplanowane', zrealizowane: 'zrealizowane', odwolane: 'odwołane' };

function NewPlanForm({ patientId, meta, onDone }: { patientId: string; meta: PozMeta; onDone: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [groups, setGroups] = useState<string[]>([]);
  const [coordinator, setCoordinator] = useState('');
  const [note, setNote] = useState('');
  const [items, setItems] = useState<{ kind: string; title: string; dueOn: string }[]>([{ kind: 'wizyta', title: '', dueOn: '' }]);
  const save = useMutation({
    mutationFn: () =>
      post(`/api/staff/patients/${patientId}/ipom`, {
        groups,
        coordinatorUserId: coordinator || null,
        note: note || undefined,
        items: items.filter((i) => i.title.trim()).map((i) => ({ kind: i.kind, title: i.title.trim(), dueOn: i.dueOn || undefined })),
      }),
    onSuccess: () => (toast(t('Zapisano Indywidualny Plan Opieki Medycznej.')), onDone()),
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  return (
    <Card title={t('Nowy IPOM')}>
      <div className="stack">
        <fieldset className="fieldset">
          <legend>{t('Choroby przewlekłe objęte planem')}</legend>
          <div className="grid-2">
            {Object.entries(meta.groups).map(([k, label]) => (
              <Checkbox key={k} label={t(label)} checked={groups.includes(k)} onChange={(e) => setGroups(e.target.checked ? [...groups, k] : groups.filter((g) => g !== k))} />
            ))}
          </div>
        </fieldset>
        <SelectField label={t('Koordynator opieki')} value={coordinator} onChange={(e) => setCoordinator(e.target.value)}>
          <option value="">{t('bez koordynatora')}</option>
          {meta.coordinators.map((c) => (
            <option key={c.userId} value={c.userId}>
              {c.name}
            </option>
          ))}
        </SelectField>
        <fieldset className="fieldset">
          <legend>{t('Pozycje planu')}</legend>
          <div className="stack-sm">
            {items.map((it, i) => (
              <div key={i} className="ipom-row">
                <SelectField label={t('Rodzaj')} value={it.kind} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))}>
                  {meta.itemKinds.map((k) => (
                    <option key={k} value={k}>
                      {t(IPOM_KIND_LABEL[k] ?? k)}
                    </option>
                  ))}
                </SelectField>
                <TextField label={t('Co')} value={it.title} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} maxLength={200} />
                <TextField label={t('Termin')} type="date" value={it.dueOn} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, dueOn: e.target.value } : x)))} />
              </div>
            ))}
            <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => setItems([...items, { kind: 'badanie', title: '', dueOn: '' }])}>
              {t('Dodaj pozycję')}
            </Button>
          </div>
        </fieldset>
        <TextArea label={t('Notatka dla zespołu (pacjent jej nie widzi)')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={2} />
        <div className="btn-row">
          <Button disabled={!groups.length} loading={save.isPending} onClick={() => save.mutate()}>
            {t('Zapisz IPOM')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export function IpomPanel({ patientId }: { patientId: string }) {
  const { t, fmt } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const { me } = useSession();
  const doctor = hasRole(me, 'practitioner');
  const meta = useQuery({ queryKey: ['poz-meta'], queryFn: () => get<PozMeta>('/api/staff/poz/meta') });
  const q = useQuery({ queryKey: ['ipom', patientId], queryFn: () => get<{ active?: IpomView; history: { id: string; validFrom: string; groups: string[] }[] }>(`/api/staff/patients/${patientId}/ipom`) });
  const [creating, setCreating] = useState(false);
  const [newItem, setNewItem] = useState({ kind: 'badanie', title: '', dueOn: '' });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['ipom', patientId] });
    void qc.invalidateQueries({ queryKey: ['poz-plans'] });
    void qc.invalidateQueries({ queryKey: ['profile-tasks'] });
  };
  const item = useMutation({
    mutationFn: (v: { planId: string; itemId: string; status: string }) => put(`/api/staff/poz/ipom/${v.planId}/items/${v.itemId}`, { status: v.status }),
    onSuccess: refresh,
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  const add = useMutation({
    mutationFn: (planId: string) => post(`/api/staff/poz/ipom/${planId}/items`, { kind: newItem.kind, title: newItem.title.trim(), dueOn: newItem.dueOn || undefined }),
    onSuccess: () => (setNewItem({ kind: 'badanie', title: '', dueOn: '' }), refresh()),
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  const coord = useMutation({ mutationFn: (v: { planId: string; id: string | null }) => put(`/api/staff/poz/ipom/${v.planId}/coordinator`, { coordinatorUserId: v.id }), onSuccess: refresh });
  const close = useMutation({ mutationFn: (planId: string) => post(`/api/staff/poz/ipom/${planId}/close`), onSuccess: refresh });
  if (q.isLoading || meta.isLoading) return <Skeleton />;
  if (q.isError) return <QueryError error={q.error} />;
  const plan = q.data!.active;
  if (!plan || creating)
    return creating && meta.data ? (
      <NewPlanForm patientId={patientId} meta={meta.data} onDone={() => (setCreating(false), refresh())} />
    ) : (
      <Card title={t('Opieka koordynowana')}>
        <Empty icon={<ClipboardList size={32} />} title={t('Pacjent nie ma aktywnego IPOM')}>
          {t('Plan zakłada lekarz POZ po poradzie kompleksowej. Pacjent widzi plan w aplikacji, a koordynator pilnuje terminów.')}
        </Empty>
        {doctor && (
          <div className="btn-row" style={{ justifyContent: 'center' }}>
            <Button icon={<Plus size={15} />} onClick={() => setCreating(true)}>
              {t('Załóż IPOM')}
            </Button>
          </div>
        )}
      </Card>
    );
  return (
    <div className="stack">
      <Card
        title={t('Indywidualny Plan Opieki Medycznej')}
        action={
          doctor ? (
            <Button size="sm" variant="ghost" onClick={() => close.mutate(plan.id)}>
              {t('Zakończ plan')}
            </Button>
          ) : undefined
        }
      >
        <div className="stack-sm">
          <div className="chips">
            {plan.groups.map((g) => (
              <span key={g} className="badge primary">
                {t(meta.data?.groups[g] ?? g)}
              </span>
            ))}
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            {t('od {d}', { d: fmt.date(plan.validFrom) })} · {t('ułożył(a)')}: {plan.author ?? '—'}
          </p>
          <div className="row" style={{ gap: 8 }}>
            <label className="small" htmlFor="ipom-coord">
              {t('Koordynator')}
            </label>
            <select id="ipom-coord" className="select sm" value={plan.coordinator?.userId ?? ''} onChange={(e) => coord.mutate({ planId: plan.id, id: e.target.value || null })}>
              <option value="">{t('bez koordynatora')}</option>
              {meta.data?.coordinators.map((c) => (
                <option key={c.userId} value={c.userId}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {plan.note && <Notice kind="info">{plan.note}</Notice>}
          {plan.usage.length > 0 && (
            <ul className="chips" style={{ listStyle: 'none', margin: 0, padding: 0 }} aria-label={t('Wykorzystanie w tym roku')}>
              {plan.usage.map((u) => (
                <li key={u.kind} className={`badge ${u.limit !== undefined && u.done >= u.limit ? 'warn' : ''}`}>
                  {t(IPOM_KIND_LABEL[u.kind] ?? u.kind)}: {u.done}
                  {u.limit !== undefined ? ` / ${u.limit}` : ''} {u.planned ? `(+${u.planned} ${t('zaplanowane')})` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
      <Card title={t('Pozycje planu')} className="card-flush" as="section">
        <ul className="list">
          {plan.items.map((i) => (
            <li key={i.id} className="list-item" style={{ flexWrap: 'wrap' }}>
              <span className={`list-icon ${i.overdue ? 'warn' : i.status === 'zrealizowane' ? 'ok' : ''}`}>{i.overdue ? <AlertTriangle size={18} aria-hidden /> : i.status === 'zrealizowane' ? <CheckCircle2 size={18} aria-hidden /> : <ClipboardList size={18} aria-hidden />}</span>
              <span className="grow">
                <span className="list-title" style={{ display: 'block' }}>
                  {i.title}
                </span>
                <span className="list-sub">
                  {t(IPOM_KIND_LABEL[i.kind] ?? i.kind)}
                  {i.dueOn ? ` · ${t('termin')}: ${fmt.date(i.dueOn)}` : ''}
                  {i.doneOn ? ` · ${t('zrealizowano')}: ${fmt.date(i.doneOn)}${i.doneBy ? ` (${i.doneBy})` : ''}` : ''}
                </span>
              </span>
              <Badge kind={i.overdue ? 'warn' : i.status === 'zrealizowane' ? 'ok' : undefined}>{i.overdue ? t('zaległe') : t(ITEM_STATUS_LABEL[i.status])}</Badge>
              {i.status === 'zaplanowane' && (
                <span className="btn-row">
                  <Button size="sm" variant="secondary" onClick={() => item.mutate({ planId: plan.id, itemId: i.id, status: 'zrealizowane' })}>
                    {t('Zrealizowane')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => item.mutate({ planId: plan.id, itemId: i.id, status: 'odwolane' })}>
                    {t('Odwołaj')}
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
        <div className="ipom-row" style={{ padding: '12px 18px' }}>
          <SelectField label={t('Rodzaj')} value={newItem.kind} onChange={(e) => setNewItem({ ...newItem, kind: e.target.value })}>
            {(meta.data?.itemKinds ?? []).map((k) => (
              <option key={k} value={k}>
                {t(IPOM_KIND_LABEL[k] ?? k)}
              </option>
            ))}
          </SelectField>
          <TextField label={t('Nowa pozycja')} value={newItem.title} onChange={(e) => setNewItem({ ...newItem, title: e.target.value })} maxLength={200} />
          <TextField label={t('Termin')} type="date" value={newItem.dueOn} onChange={(e) => setNewItem({ ...newItem, dueOn: e.target.value })} />
          <Button size="sm" disabled={!newItem.title.trim()} loading={add.isPending} onClick={() => add.mutate(plan.id)}>
            {t('Dodaj')}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// --- deklaracje i bilans w karcie pacjenta (krótko) ----------------------------------------------------------------

export function PatientPozSummary({ patientId }: { patientId: string }) {
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['poz-declarations', 'patient', patientId], queryFn: () => get<{ items: Declaration[] }>(`/api/staff/poz/declarations${qs({ patientId })}`) });
  const active = (q.data?.items ?? []).filter((d) => d.status === 'przyjeta' || d.status === 'zlozona');
  return (
    <Card title={t('Deklaracje POZ')}>
      {!active.length ? (
        <p className="small muted" style={{ margin: 0 }}>{t('Brak aktywnej deklaracji w tej placówce.')}</p>
      ) : (
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          {active.map((d) => (
            <li key={d.id}>
              <UserCheck size={13} aria-hidden /> {t(DECL_KIND_LABEL[d.kind])}: {d.practitionerName} · {t(DECL_STATUS_LABEL[d.status])} ({fmt.date(d.submittedOn)})
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

