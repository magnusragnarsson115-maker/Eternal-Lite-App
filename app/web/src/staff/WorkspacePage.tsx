import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Check, ChevronDown, CircleDashed, Flag, History, Inbox, MessageSquare, Plus, Video } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { get, post, put, qs } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { useSession } from '../session';
import type { PatientView } from '../types';
import { Badge, Button, Card, Checkbox, Combobox, Empty, Modal, PageHead, QueryError, Segmented, Skeleton, Tabs, TextArea, TextField, useToast } from '../ui';
import { WaitingRoomCard } from './ClinicPages';

/**
 * Eternal Klinika — przestrzeń pracy lekarza (runda 5). Ekran główny to kolejka spraw, nie sto wykresów:
 * kto dziś, kto nowy, kto na kontrolę, co pilne (oznaczone przez personel), co wymaga reakcji i komu brakuje danych.
 */

export type CaseStatus = 'new' | 'incomplete' | 'analysis' | 'doctor' | 'follow-up' | 'closed';
type Bucket = 'today' | 'new' | 'followup' | 'urgent' | 'action' | 'missing';

export interface CaseView {
  id: string;
  patientId: string;
  title: string;
  status: CaseStatus;
  statusLabel: string;
  next: CaseStatus[];
  priority: 'normal' | 'urgent';
  owner?: { userId: string; name: string };
  source: string;
  sourceRef?: string;
  dueDate?: string;
  note?: string;
  createdAt: string;
  history?: { at: string; actor?: string; kind: string; from?: string; to?: string; note?: string }[];
}

interface CompletenessItem {
  key: 'interview' | 'results' | 'consent' | 'medications' | 'measurements';
  label: string;
  status: 'ok' | 'partial' | 'missing';
  detail?: string;
}

interface QueueItem {
  key: string;
  kind: 'appointment' | 'message' | 'intake' | 'scribe' | 'rpm' | 'result' | 'grant' | 'task';
  buckets: Bucket[];
  patientId: string;
  patientName: string;
  title: string;
  detail?: string;
  at: string;
  link: string;
  source: string;
  sourceRef: string;
  case?: CaseView;
  completeness?: { percent: number; items: CompletenessItem[]; missing: string[] };
  appointment?: { id: string; start: string; serviceName?: string; mode: 'in-person' | 'tele' };
}

interface Queue {
  date: string;
  scope: 'mine' | 'all';
  counts: Record<Bucket, number>;
  items: QueueItem[];
  rule: string;
}

export function useStatusLabel() {
  const { t } = useI18n();
  return (s: CaseStatus) =>
    ({ new: t('nowa'), incomplete: t('dane niepełne'), analysis: t('do analizy'), doctor: t('do lekarza'), 'follow-up': t('kontrola (follow-up)'), closed: t('zakończona') })[s];
}

export function CaseStatusChip({ c, onChange, busy }: { c: CaseView; onChange: (s: CaseStatus) => void; busy?: boolean }) {
  const { t } = useI18n();
  const label = useStatusLabel();
  return (
    <details className="case-menu">
      <summary className="status-chip" data-status={c.status} aria-label={t('Status sprawy: {s} — zmień', { s: label(c.status) })}>
        {label(c.status)} <ChevronDown size={13} aria-hidden />
      </summary>
      <div className="case-menu-list" role="menu">
        <div className="small muted" style={{ padding: '4px 10px' }}>
          {t('Zmień status na')}
        </div>
        {c.next.map((s) => (
          <button
            key={s}
            type="button"
            role="menuitem"
            className="case-menu-item"
            disabled={busy}
            onClick={(e) => {
              (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
              onChange(s);
            }}
          >
            <span className="status-dot" data-status={s} aria-hidden /> {label(s)}
          </button>
        ))}
      </div>
    </details>
  );
}

export function CompletenessChips({ items }: { items: CompletenessItem[] }) {
  const { t } = useI18n();
  const name: Record<CompletenessItem['key'], string> = { interview: t('wywiad'), results: t('wyniki'), consent: t('zgoda'), medications: t('leki'), measurements: t('pomiary') };
  return (
    <ul className="cmp-chips" aria-label={t('Kompletność danych przed wizytą')}>
      {items.map((i) => (
        <li key={i.key} className={`cmp-chip ${i.status}`} title={[i.label, i.detail].filter(Boolean).join(' — ')}>
          {i.status === 'ok' ? <Check size={12} aria-hidden /> : <CircleDashed size={12} aria-hidden />}
          <span>{name[i.key]}</span>
          <span className="sr-only">{i.status === 'ok' ? t('jest') : i.status === 'partial' ? t('częściowo') : t('brak')}</span>
        </li>
      ))}
    </ul>
  );
}

function CaseHistory({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t, fmt } = useI18n();
  const label = useStatusLabel();
  const q = useQuery({ queryKey: ['case', id], queryFn: () => get<CaseView>(`/api/staff/cases/${id}`), enabled: !!id });
  const kindLabel = (e: NonNullable<CaseView['history']>[0]) => {
    switch (e.kind) {
      case 'created':
        return t('utworzono sprawę ({s})', { s: label(e.to as CaseStatus) });
      case 'status':
        return `${label(e.from as CaseStatus)} → ${label(e.to as CaseStatus)}`;
      case 'owner':
        return t('właściciel: {a} → {b}', { a: e.from ?? '—', b: e.to ?? '—' });
      case 'priority':
        return e.to === 'urgent' ? t('oznaczono jako pilne') : t('zdjęto oznaczenie „pilne”');
      case 'due':
        return t('termin: {d}', { d: e.to ?? '—' });
      default:
        return t('notatka');
    }
  };
  return (
    <Modal open={!!id} onClose={onClose} title={t('Historia sprawy')}>
      {q.isLoading ? (
        <Skeleton count={2} height={40} />
      ) : q.data ? (
        <div className="stack">
          <strong>{q.data.title}</strong>
          <ol className="case-history">
            {(q.data.history ?? []).map((e, i) => (
              <li key={i}>
                <span className="small muted tabular">{fmt.dateTime(e.at)}</span> · <strong>{e.actor ?? '—'}</strong>: {kindLabel(e)}
                {e.note && <div className="small">„{e.note}”</div>}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </Modal>
  );
}

function NewTaskModal({ open, onClose, preset }: { open: boolean; onClose: () => void; preset?: { patientId: string; patientName: string } }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [patient, setPatient] = useState<{ id: string; name: string } | null>(preset ? { id: preset.patientId, name: preset.patientName } : null);
  const [title, setTitle] = useState('');
  const [due, setDue] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [note, setNote] = useState('');
  const create = useMutation({
    mutationFn: () => post<CaseView>('/api/staff/cases', { patientId: patient!.id, title, dueDate: due || undefined, priority: urgent ? 'urgent' : 'normal', note: note || undefined, source: 'manual' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['workspace'] });
      void qc.invalidateQueries({ queryKey: ['cases'] });
      toast(t('Dodano zadanie do kolejki.'));
      setTitle('');
      setNote('');
      onClose();
    },
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Nowe zadanie')}
      footer={
        <Button disabled={!patient || !title.trim()} loading={create.isPending} onClick={() => create.mutate()}>
          {t('Dodaj do kolejki')}
        </Button>
      }
    >
      <div className="stack">
        {patient ? (
          <div className="row-between">
            <span>
              {t('Pacjent')}: <strong>{patient.name}</strong>
            </span>
            {!preset && (
              <button type="button" className="link-btn" onClick={() => setPatient(null)}>
                {t('zmień')}
              </button>
            )}
          </div>
        ) : (
          <Combobox<PatientView>
            label={t('Pacjent')}
            placeholder={t('Nazwisko, PESEL lub telefon')}
            search={async (term, signal) => (await get<{ items: PatientView[] }>(`/api/staff/patients${qs({ q: term })}`, signal)).items}
            render={(p) => `${p.name}${p.birthDate ? ` · ${p.birthDate}` : ''}`}
            onSelect={(p) => setPatient({ id: p.id, name: p.name })}
          />
        )}
        <TextField label={t('Co trzeba zrobić')} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} required />
        <TextField label={t('Termin (opcjonalnie)')} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <Checkbox label={t('Pilne')} hint={t('Pilność nadaje personel — aplikacja nie ocenia stanu pacjenta.')} checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
        <TextArea label={t('Notatka (opcjonalnie)')} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3} />
      </div>
    </Modal>
  );
}

const KIND_ICON: Record<QueueItem['kind'], typeof Inbox> = { appointment: CalendarDays, message: MessageSquare, intake: Inbox, scribe: Inbox, rpm: Inbox, result: Inbox, grant: Inbox, task: Flag };

function StatusName({ s }: { s: CaseStatus }) {
  const label = useStatusLabel();
  return <>{label(s)}</>;
}

export function WorkspacePage() {
  const { t, fmt } = useI18n();
  const { me } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [bucket, setBucket] = useState<Bucket | 'all'>('today');
  const [history, setHistory] = useState<string | null>(null);
  const [newTask, setNewTask] = useState(false);
  const q = useQuery({ queryKey: ['workspace', scope], queryFn: () => get<Queue>(`/api/staff/workspace${qs({ scope })}`), refetchInterval: 60_000 });
  const owners = useQuery({ queryKey: ['case-owners'], queryFn: () => get<{ items: { userId: string; name: string; role: string }[] }>('/api/staff/case-owners'), staleTime: 300_000 });
  // pierwsze otwarcie: pierwsza niepusta zakładka (dziś → pilne → wymaga reakcji → braki → nowi → kontrola)
  const [picked, setPicked] = useState(false);
  useEffect(() => {
    if (picked || !q.data) return;
    const c = q.data.counts;
    const first = (['today', 'urgent', 'action', 'missing', 'new', 'followup'] as Bucket[]).find((b) => c[b] > 0);
    setBucket(first ?? 'all');
    setPicked(true);
  }, [q.data, picked]);
  const done = () => void qc.invalidateQueries({ queryKey: ['workspace'] });
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) => put<CaseView>(`/api/staff/cases/${id}`, patch),
    onSuccess: done,
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  const take = useMutation({
    mutationFn: ({ item, status }: { item: QueueItem; status: CaseStatus }) =>
      post<CaseView>('/api/staff/cases', { patientId: item.patientId, title: `${item.title}${item.detail ? ` — ${item.detail}` : ''}`.slice(0, 160), source: item.source, sourceRef: item.sourceRef, status }),
    onSuccess: done,
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });

  if (q.isLoading) return <Skeleton count={4} height={80} />;
  if (q.isError) return <QueryError error={q.error} retry={() => void q.refetch()} />;
  const d = q.data!;
  const tabs: { value: Bucket | 'all'; label: string }[] = [
    { value: 'today', label: `${t('Dziś')} (${d.counts.today})` },
    { value: 'new', label: `${t('Nowi')} (${d.counts.new})` },
    { value: 'followup', label: `${t('Kontrola')} (${d.counts.followup})` },
    { value: 'urgent', label: `${t('Pilne')} (${d.counts.urgent})` },
    { value: 'action', label: `${t('Wymaga reakcji')} (${d.counts.action})` },
    { value: 'missing', label: `${t('Braki danych')} (${d.counts.missing})` },
    { value: 'all', label: `${t('Wszystko')} (${d.items.length})` },
  ];
  const items = bucket === 'all' ? d.items : d.items.filter((i) => i.buckets.includes(bucket));
  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="stack-lg">
      <PageHead
        title={`${t('Dzień dobry')}, ${me?.user?.displayName}`}
        sub={
          <span>
            {fmt.dateLong(new Date().toISOString())} · {t('Eternal Klinika — kolejka pacjentów')}
          </span>
        }
        action={
          <div className="btn-row">
            <Segmented
              label={t('Zakres')}
              value={scope}
              onChange={setScope}
              options={[
                { value: 'mine', label: t('Moja kolejka') },
                { value: 'all', label: t('Cała placówka') },
              ]}
            />
            <Button size="sm" icon={<Plus size={16} />} onClick={() => setNewTask(true)}>
              {t('Nowe zadanie')}
            </Button>
          </div>
        }
      />
      <Tabs label={t('Kolejka')} value={bucket} onChange={setBucket} tabs={tabs} />
      <div className="ws-grid">
        <Card className="card-flush" as="section">
          {items.length === 0 ? (
            <Empty title={t('Nic w tej zakładce')}>{t('Pozycje pojawiają się z wizyt, wiadomości, dokumentów, wyników, telemonitoringu i zadań.')}</Empty>
          ) : (
            <ul className="list" aria-label={t('Pozycje kolejki')}>
              {items.map((it) => {
                const Icon = KIND_ICON[it.kind];
                const c = it.case;
                return (
                  <li key={it.key} className={`wq-item ${c?.priority === 'urgent' ? 'urgent' : ''}`}>
                    <div className="wq-time tabular">
                      {it.kind === 'appointment' && it.at.slice(0, 10) === todayIso ? fmt.time(it.at) : fmt.date(it.at)}
                      {it.appointment?.mode === 'tele' && <Video size={14} aria-label={t('teleporada')} />}
                    </div>
                    <div className="wq-body">
                      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                        <Link to={`/panel/pacjenci/${it.patientId}`} className="list-title">
                          {it.patientName}
                        </Link>
                        <span className="muted small">
                          <Icon size={13} aria-hidden /> {it.title}
                        </span>
                        {c?.priority === 'urgent' && <Badge kind="warn">{t('pilne (oznaczone przez personel)')}</Badge>}
                      </div>
                      {it.detail && <div className="small muted">{it.detail}</div>}
                      {it.completeness && <CompletenessChips items={it.completeness.items} />}
                      {c && c.title !== it.title && it.kind !== 'task' && <div className="small">{c.title}</div>}
                    </div>
                    <div className="wq-actions">
                      {c ? (
                        <>
                          <CaseStatusChip c={c} busy={update.isPending} onChange={(s) => update.mutate({ id: c.id, patch: { status: s } })} />
                          <label className="sr-only" htmlFor={`own-${c.id}`}>
                            {t('Właściciel sprawy')}
                          </label>
                          <select id={`own-${c.id}`} className="select sm" value={c.owner?.userId ?? ''} onChange={(e) => update.mutate({ id: c.id, patch: { ownerUserId: e.target.value || null } })}>
                            <option value="">{t('bez właściciela')}</option>
                            {(owners.data?.items ?? []).map((o) => (
                              <option key={o.userId} value={o.userId}>
                                {o.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            className={`icon-btn ${c.priority === 'urgent' ? 'on' : ''}`}
                            aria-pressed={c.priority === 'urgent'}
                            title={c.priority === 'urgent' ? t('Zdejmij oznaczenie „pilne”') : t('Oznacz jako pilne')}
                            onClick={() => update.mutate({ id: c.id, patch: { priority: c.priority === 'urgent' ? 'normal' : 'urgent' } })}
                          >
                            <Flag size={15} aria-hidden />
                            <span className="sr-only">{t('Pilne')}</span>
                          </button>
                          <button type="button" className="icon-btn" title={t('Historia sprawy')} onClick={() => setHistory(c.id)}>
                            <History size={15} aria-hidden />
                            <span className="sr-only">{t('Historia sprawy')}</span>
                          </button>
                        </>
                      ) : (
                        <details className="case-menu">
                          <summary className="btn secondary sm">{t('Prowadź jako sprawę')}</summary>
                          <div className="case-menu-list" role="menu">
                            {(['new', 'incomplete', 'analysis', 'doctor', 'follow-up'] as CaseStatus[]).map((s) => (
                              <button key={s} type="button" role="menuitem" className="case-menu-item" onClick={() => take.mutate({ item: it, status: s })}>
                                <span className="status-dot" data-status={s} aria-hidden /> <StatusName s={s} />
                              </button>
                            ))}
                          </div>
                        </details>
                      )}
                      <Link to={it.link} className="btn ghost sm">
                        {t('Otwórz')}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <div className="stack">
          <WaitingRoomCard />
          <Card title={t('Jak działa kolejka')}>
            <p className="small muted">{t(d.rule)}</p>
            <p className="small muted">{t('Statusy spraw: nowa → dane niepełne → do analizy → do lekarza → kontrola → zakończona. Każda zmiana ma autora i godzinę.')}</p>
            <div className="btn-row">
              <Link to="/panel/skrzynka" className="btn secondary sm">
                {t('Skrzynka materiałów')}
              </Link>
              <Link to="/panel/kalendarz" className="btn secondary sm">
                <CalendarDays size={16} /> {t('Kalendarz')}
              </Link>
              <Link to="/panel/pulpit" className="btn secondary sm">
                {t('Statystyki dnia')}
              </Link>
            </div>
          </Card>
        </div>
      </div>
      <CaseHistory id={history} onClose={() => setHistory(null)} />
      <NewTaskModal open={newTask} onClose={() => setNewTask(false)} />
    </div>
  );
}

/** Sprawy pacjenta w karcie pacjenta (lista z historią). */
export function PatientCasesCard({ patientId, patientName }: { patientId: string; patientName: string }) {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [history, setHistory] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [closed, setClosed] = useState(false);
  const q = useQuery({ queryKey: ['cases', patientId, closed], queryFn: () => get<{ items: CaseView[] }>(`/api/staff/cases${qs({ patientId, includeClosed: closed ? '1' : undefined })}`) });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CaseStatus }) => put<CaseView>(`/api/staff/cases/${id}`, { status }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cases', patientId] });
      void qc.invalidateQueries({ queryKey: ['workspace'] });
    },
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  return (
    <Card
      title={t('Sprawy pacjenta')}
      action={
        <div className="btn-row">
          <Checkbox label={t('pokaż zakończone')} checked={closed} onChange={(e) => setClosed(e.target.checked)} />
          <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>
            {t('Zadanie')}
          </Button>
        </div>
      }
    >
      {q.isLoading ? (
        <Skeleton count={1} height={40} />
      ) : !q.data?.items.length ? (
        <p className="muted small">{t('Brak otwartych spraw.')}</p>
      ) : (
        <ul className="list">
          {q.data.items.map((c) => (
            <li key={c.id} className="row-between" style={{ padding: '8px 0', gap: 8 }}>
              <span className="grow">
                {c.title}
                <span className="small muted" style={{ display: 'block' }}>
                  {c.owner?.name ?? t('bez właściciela')}
                  {c.dueDate ? ` · ${t('termin')} ${fmt.date(c.dueDate)}` : ''}
                  {c.priority === 'urgent' ? ` · ${t('pilne')}` : ''}
                </span>
              </span>
              <CaseStatusChip c={c} busy={update.isPending} onChange={(s) => update.mutate({ id: c.id, status: s })} />
              <button type="button" className="icon-btn" title={t('Historia sprawy')} onClick={() => setHistory(c.id)}>
                <History size={15} aria-hidden />
                <span className="sr-only">{t('Historia sprawy')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <CaseHistory id={history} onClose={() => setHistory(null)} />
      <NewTaskModal open={open} onClose={() => setOpen(false)} preset={{ patientId, patientName }} />
    </Card>
  );
}
