import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CalendarClock, ChevronLeft, ChevronRight, ClipboardList, ExternalLink, UserPlus, Video } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { get, post, qs } from '../api';
import { errorMessage } from '../errors';
import { addDaysIso, clinicDate, clinicMinutes, useI18n } from '../i18n';
import { hasRole, useSession } from '../session';
import type { AppointmentView, PatientView, PractitionerView, ServiceView, SlotView } from '../types';
import { Badge, Button, Checkbox, Combobox, Modal, Notice, PageHead, QueryError, SelectField, Skeleton, StatusBadge, TextArea, TextField, useToast } from '../ui';
import { SlotPicker } from '../ui/SlotPicker';

interface DayOverview {
  date: string;
  holiday?: string;
  appointments: AppointmentView[];
  slots: SlotView[];
  practitioners: PractitionerView[];
}

const REMINDER_STATUS: Record<string, string> = {
  'skipped-late-booking': 'pominięte — wizytę zarezerwowano później',
  'skipped-superseded': 'pominięte — zastąpione krótszym przypomnieniem',
  sending: 'w trakcie wysyłki',
};

export function CalendarPage() {
  const { t, fmt } = useI18n();
  const [params, setParams] = useSearchParams();
  const today = clinicDate(new Date());
  const date = params.get('date') ?? today;
  const openAppt = params.get('wizyta');
  const [practitionerId, setPractitionerId] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [bookSlot, setBookSlot] = useState<SlotView | null>(null);
  const q = useQuery({
    queryKey: ['calendar', date, practitionerId],
    queryFn: () => get<DayOverview>(`/api/staff/calendar${qs({ date, practitionerId: practitionerId || undefined })}`),
  });
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: () => get<{ services: ServiceView[]; practitioners: PractitionerView[] }>('/api/catalog') });

  const setDate = (d: string) => setParams({ date: d });
  const setOpenAppt = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('wizyta', id);
    else next.delete('wizyta');
    setParams(next);
  };

  const data = q.data;
  const columns = useMemo(() => {
    if (!data) return [];
    const ids = new Set([...data.slots.map((s) => s.practitionerId), ...data.appointments.map((a) => a.practitionerId ?? '')]);
    const cols = data.practitioners.filter((p) => ids.has(p.id));
    return cols.length ? cols : data.practitioners;
  }, [data]);

  const [startMin, endMin] = useMemo(() => {
    if (!data) return [7 * 60, 17 * 60];
    const times = [...data.slots.flatMap((s) => [clinicMinutes(s.start), clinicMinutes(s.end)]), ...data.appointments.flatMap((a) => [clinicMinutes(a.start), clinicMinutes(a.end)])];
    if (!times.length) return [8 * 60, 16 * 60];
    return [Math.floor(Math.min(...times) / 60) * 60, Math.ceil(Math.max(...times) / 60) * 60];
  }, [data]);
  // skala: najkrótszy slot ma co najmniej 26 px wysokości
  const PX_PER_MIN = useMemo(() => {
    const durations = [...(data?.slots ?? []), ...(data?.appointments ?? [])].map((x) => (Date.parse(x.end) - Date.parse(x.start)) / 60_000).filter((d) => d > 0);
    return Math.min(4, Math.max(1.5, 26 / Math.min(...(durations.length ? durations : [20]))));
  }, [data]);
  const height = (endMin - startMin) * PX_PER_MIN;
  const nowMin = date === today ? clinicMinutes(new Date().toISOString()) : -1;

  return (
    <div className="stack-lg">
      <PageHead
        title={t('Kalendarz')}
        sub={<span>{fmt.dateLong(`${date}T12:00:00Z`)}{data?.holiday ? ` · ${data.holiday}` : ''}</span>}
        action={
          <div className="row">
            <Button variant="secondary" size="sm" aria-label={t('Poprzedni dzień')} icon={<ChevronLeft size={18} />} onClick={() => setDate(addDaysIso(date, -1))} />
            <Button variant="secondary" size="sm" onClick={() => setDate(today)}>
              {t('Dziś')}
            </Button>
            <Button variant="secondary" size="sm" aria-label={t('Następny dzień')} icon={<ChevronRight size={18} />} onClick={() => setDate(addDaysIso(date, 1))} />
            <input type="date" className="input" style={{ width: 160, minHeight: 34 }} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label={t('Data')} />
          </div>
        }
      />
      <div className="row-between">
        <div className="row">
          <select className="select" style={{ width: 240, minHeight: 36 }} value={practitionerId} onChange={(e) => setPractitionerId(e.target.value)} aria-label={t('Lekarz')}>
            <option value="">{t('Wszyscy lekarze')}</option>
            {catalog.data?.practitioners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Checkbox label={t('Pokaż odwołane')} checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} />
        </div>
        <div className="legend" aria-label={t('Legenda')}>
          <span><i style={{ background: 'var(--primary-soft)', borderLeft: '3px solid var(--primary)' }} /> {t('Zaplanowana')}</span>
          <span><i style={{ background: 'var(--info-soft)', borderLeft: '3px solid var(--info)' }} /> {t('Na miejscu')}</span>
          <span><i style={{ background: 'var(--success-soft)', borderLeft: '3px solid var(--success)' }} /> {t('Zrealizowana')}</span>
          <span><i style={{ background: 'var(--danger-soft)', borderLeft: '3px solid var(--danger)' }} /> {t('Nieobecność')}</span>
          <span><i style={{ border: '1px dashed var(--border-strong)' }} /> {t('Wolny termin')}</span>
        </div>
      </div>
      {q.isLoading && <Skeleton height={400} count={1} />}
      {q.isError && <QueryError error={q.error} retry={() => void q.refetch()} />}
      {data && columns.length === 0 && <Notice kind="info">{t('Brak grafiku na ten dzień. Dodaj dostępność w zakładce Grafik.')}</Notice>}
      {data && columns.length > 0 && (
        <div className="cal" role="grid" aria-label={t('Kalendarz dnia')}>
          <div className="cal-head" style={{ gridTemplateColumns: `64px repeat(${columns.length}, minmax(180px, 1fr))` }} role="row">
            <div role="columnheader" />
            {columns.map((p) => (
              <div key={p.id} role="columnheader">
                {p.name}
                <span className="small muted" style={{ display: 'block', fontWeight: 500 }}>{p.specialty}</span>
              </div>
            ))}
          </div>
          <div className="cal-body" style={{ gridTemplateColumns: `64px repeat(${columns.length}, minmax(180px, 1fr))`, height }}>
            <div className="cal-times" style={{ height }}>
              {Array.from({ length: (endMin - startMin) / 60 + 1 }, (_, i) => (
                <span key={i} className="cal-time" style={{ top: Math.max(8, Math.min(height - 8, i * 60 * PX_PER_MIN)) }}>
                  {String(Math.floor((startMin + i * 60) / 60)).padStart(2, '0')}:00
                </span>
              ))}
            </div>
            {columns.map((p) => {
              const appts = data.appointments.filter((a) => a.practitionerId === p.id && (showCancelled || a.status !== 'cancelled'));
              const active = appts.filter((a) => a.status !== 'cancelled');
              const slots = data.slots.filter((s) => s.practitionerId === p.id && s.status !== 'busy' && !active.some((a) => Date.parse(a.start) < Date.parse(s.end) && Date.parse(a.end) > Date.parse(s.start)));
              return (
                <div key={p.id} className="cal-col" style={{ height }} role="gridcell">
                  {Array.from({ length: (endMin - startMin) / 30 }, (_, i) => (
                    <div key={i} className={`cal-line ${i % 2 ? 'half' : ''}`} style={{ top: i * 30 * PX_PER_MIN }} />
                  ))}
                  {nowMin >= startMin && nowMin <= endMin && <div className="cal-now" style={{ top: (nowMin - startMin) * PX_PER_MIN }} aria-hidden />}
                  {slots.map((s) => {
                    const top = (clinicMinutes(s.start) - startMin) * PX_PER_MIN;
                    const h = Math.max(18, (clinicMinutes(s.end) - clinicMinutes(s.start)) * PX_PER_MIN - 2);
                    const past = Date.parse(s.start) < Date.now();
                    return s.status === 'busy-unavailable' ? (
                      <div key={s.id} className="cal-slot blocked" style={{ top, height: h }} title={s.comment}>
                        {fmt.time(s.start)} · {s.comment ?? t('zablokowany')}
                      </div>
                    ) : (
                      <button key={s.id} type="button" className="cal-slot" style={{ top, height: h }} disabled={past} onClick={() => setBookSlot(s)} aria-label={t('Wolny termin {time} — zarezerwuj', { time: fmt.time(s.start) })}>
                        {fmt.time(s.start)} {!past && <span aria-hidden>· {t('wolny')}</span>}
                      </button>
                    );
                  })}
                  {appts.map((a) => {
                    const top = (clinicMinutes(a.start) - startMin) * PX_PER_MIN;
                    const h = Math.max(20, (clinicMinutes(a.end) - clinicMinutes(a.start)) * PX_PER_MIN - 2);
                    return (
                      <button key={a.id} type="button" className={`cal-appt ${a.status} ${a.mode === 'tele' ? 'tele' : ''}`} style={{ top, height: h }} onClick={() => setOpenAppt(a.id)}>
                        <strong>
                          {fmt.time(a.start)} {a.patientName} {a.mode === 'tele' && <Video size={12} aria-label={t('teleporada')} />}
                        </strong>
                        {h > 36 && <span>{a.serviceName}</span>}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {openAppt && <AppointmentModal id={openAppt} onClose={() => setOpenAppt(null)} />}
      {bookSlot && <BookSlotModal slot={bookSlot} services={catalog.data?.services ?? []} onClose={() => setBookSlot(null)} />}
    </div>
  );
}

interface AppointmentDetail extends AppointmentView {
  patient: PatientView | null;
  reminders: { kind: string; channels: string; status: string; created_at: string }[];
  questionnaire?: { question: string; answer: string }[] | null;
  questionnaireFilled?: boolean;
  teleWindowOpen: boolean;
}

export function AppointmentModal({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, fmt } = useI18n();
  const { me } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [mode, setMode] = useState<'view' | 'cancel' | 'reschedule'>('view');
  const [reason, setReason] = useState('');
  const [newSlot, setNewSlot] = useState<SlotView | undefined>();
  const q = useQuery({ queryKey: ['appointment', 'staff', id], queryFn: () => get<AppointmentDetail>(`/api/staff/appointments/${id}`) });
  const a = q.data;
  const free = useQuery({
    queryKey: ['free-slots', a?.serviceId, a?.practitionerId],
    queryFn: () => get<{ slots: SlotView[] }>(`/api/staff/slots/free${qs({ serviceId: a?.serviceId, practitionerId: a?.practitionerId })}`),
    enabled: mode === 'reschedule' && !!a?.serviceId,
  });
  const done = (msg: string) => {
    toast(msg);
    void qc.invalidateQueries({ queryKey: ['calendar'] });
    void qc.invalidateQueries({ queryKey: ['appointment'] });
    void qc.invalidateQueries({ queryKey: ['staff-dashboard'] });
  };
  const status = useMutation({ mutationFn: (s: string) => post(`/api/staff/appointments/${id}/status`, { status: s }), onSuccess: () => done(t('Zmieniono status wizyty.')) });
  const remind = useMutation({ mutationFn: () => post<{ channels: string[] }>(`/api/staff/appointments/${id}/remind`), onSuccess: (r) => done(t('Przypomnienie wysłane: {c}.', { c: r.channels.join(', ') })) });
  const cancel = useMutation({
    mutationFn: () => post(`/api/staff/appointments/${id}/cancel`, { reason: reason || undefined }),
    onSuccess: () => {
      done(t('Wizyta odwołana. Pacjent otrzymał powiadomienie.'));
      onClose();
    },
  });
  const reschedule = useMutation({
    mutationFn: () => post<AppointmentView>(`/api/staff/appointments/${id}/reschedule`, { slotId: newSlot?.id }),
    onSuccess: () => {
      done(t('Termin zmieniony. Pacjent otrzymał powiadomienie.'));
      onClose();
    },
  });
  const tele = useMutation({ mutationFn: () => get<{ url: string }>(`/api/staff/appointments/${id}/tele`), onSuccess: (r) => window.open(r.url, '_blank', 'noopener') });
  const err = status.error ?? remind.error ?? cancel.error ?? reschedule.error ?? tele.error;
  const clinician = hasRole(me, 'practitioner');

  return (
    <Modal open onClose={onClose} title={a ? `${fmt.time(a.start)} · ${a.patientName}` : t('Wizyta')} wide>
      {q.isLoading && <Skeleton count={3} height={40} />}
      {q.isError && <QueryError error={q.error} />}
      {a && mode === 'view' && (
        <div className="stack">
          <div className="row">
            <StatusBadge status={a.status} />
            {a.mode === 'tele' && <Badge kind="info">{t('Teleporada')}</Badge>}
            {a.patient && !a.patient.identityVerified && <Badge kind="warn">{t('Tożsamość niepotwierdzona')}</Badge>}
            {a.patient?.fictional && <Badge>{t('dane fikcyjne')}</Badge>}
          </div>
          <div className="grid-2">
            <dl className="kv">
              <dt>{t('Pacjent')}</dt>
              <dd>
                <Link to={`/panel/pacjenci/${a.patientId}`}>{a.patientName}</Link>
              </dd>
              <dt>{t('Data urodzenia')}</dt>
              <dd>{a.patient?.birthDate ?? '—'}</dd>
              <dt>{t('Telefon')}</dt>
              <dd>{a.patient?.phone ?? '—'}</dd>
              <dt>PESEL</dt>
              <dd className="mono">{a.patient?.pesel ?? '—'}</dd>
            </dl>
            <dl className="kv">
              <dt>{t('Usługa')}</dt>
              <dd>{a.serviceName}</dd>
              <dt>{t('Lekarz')}</dt>
              <dd>{a.practitionerName}</dd>
              <dt>{t('Termin')}</dt>
              <dd>
                {fmt.dateLong(a.start)}, {fmt.time(a.start)}–{fmt.time(a.end)}
              </dd>
              <dt>{t('Zarezerwowano')}</dt>
              <dd>{fmt.dateTime(a.created)}</dd>
            </dl>
          </div>
          {a.comment && <Notice kind="info" title={t('Informacja od pacjenta')}>{a.comment}</Notice>}
          {a.status === 'cancelled' && (
            <Notice kind="warn">
              {t('Odwołana przez')}: {a.cancelledBy === 'patient' ? t('pacjenta') : t('placówkę')} {a.cancelReason ? `— ${a.cancelReason}` : ''}
            </Notice>
          )}
          {a.questionnaireId && (
            <div>
              <h3>
                <ClipboardList size={17} aria-hidden /> {t('Wywiad przed wizytą')}
              </h3>
              {a.questionnaire === undefined ? (
                <p className="small muted">{t('Treść wywiadu widzi wyłącznie lekarz.')}</p>
              ) : a.questionnaire === null ? (
                <p className="small muted">{t('Pacjent nie wypełnił jeszcze wywiadu.')}</p>
              ) : (
                <dl className="kv">
                  {a.questionnaire.map((x, i) => (
                    <div key={i} style={{ display: 'contents' }}>
                      <dt>{x.question}</dt>
                      <dd>{x.answer}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          )}
          <div>
            <h3>{t('Przypomnienia')}</h3>
            {a.reminders.length === 0 ? (
              <p className="small muted">{t('Jeszcze nie wysłano. Automatycznie: 24 h i 2 h przed wizytą (zgodnie ze zgodami pacjenta).')}</p>
            ) : (
              <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                {a.reminders.map((r, i) => (
                  <li key={i}>
                    {r.kind.startsWith('manual') ? t('wysłane ręcznie') : t('{h} przed wizytą', { h: r.kind.replace('h', ' h') })} · {fmt.dateTime(r.created_at)} ·{' '}
                    {r.status === 'sent' ? `${t('kanały')}: ${(r.channels || 'app').replace('app', t('aplikacja'))}` : t(REMINDER_STATUS[r.status] ?? r.status)}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {err && <Notice kind="danger">{errorMessage(err, t)}</Notice>}
          <div className="btn-row">
            {a.status === 'booked' && (
              <Button size="sm" onClick={() => status.mutate('arrived')} loading={status.isPending}>
                {t('Pacjent na miejscu')}
              </Button>
            )}
            {(a.status === 'booked' || a.status === 'arrived') && (
              <Button size="sm" variant="secondary" onClick={() => status.mutate('fulfilled')}>
                {t('Wizyta zrealizowana')}
              </Button>
            )}
            {a.status === 'booked' && Date.parse(a.start) < Date.now() && (
              <Button size="sm" variant="secondary" onClick={() => status.mutate('noshow')}>
                {t('Nieobecność')}
              </Button>
            )}
            {(a.status === 'noshow' || a.status === 'arrived') && (
              <Button size="sm" variant="ghost" onClick={() => status.mutate('booked')}>
                {t('Cofnij status')}
              </Button>
            )}
            {a.status === 'booked' && Date.parse(a.start) > Date.now() && (
              <>
                <Button size="sm" variant="secondary" icon={<BellRing size={15} />} onClick={() => remind.mutate()} loading={remind.isPending}>
                  {t('Wyślij przypomnienie')}
                </Button>
                <Button size="sm" variant="secondary" icon={<CalendarClock size={15} />} onClick={() => setMode('reschedule')}>
                  {t('Zmień termin')}
                </Button>
                <Button size="sm" variant="danger-outline" onClick={() => setMode('cancel')}>
                  {t('Odwołaj')}
                </Button>
              </>
            )}
            {a.mode === 'tele' && clinician && ['booked', 'arrived'].includes(a.status) && (
              <Button size="sm" icon={<Video size={15} />} onClick={() => tele.mutate()} loading={tele.isPending}>
                {t('Rozpocznij teleporadę')} <ExternalLink size={13} />
              </Button>
            )}
          </div>
        </div>
      )}
      {a && mode === 'cancel' && (
        <div className="stack">
          <p>{t('Pacjent otrzyma powiadomienie o odwołaniu z prośbą o wybór nowego terminu.')}</p>
          <TextArea label={t('Powód (widoczny dla pacjenta)')} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          {cancel.isError && <Notice kind="danger">{errorMessage(cancel.error, t)}</Notice>}
          <div className="btn-row">
            <Button variant="secondary" onClick={() => setMode('view')}>
              {t('Wróć')}
            </Button>
            <Button variant="danger" onClick={() => cancel.mutate()} loading={cancel.isPending}>
              {t('Odwołaj wizytę')}
            </Button>
          </div>
        </div>
      )}
      {a && mode === 'reschedule' && (
        <div className="stack">
          {free.isLoading && <Skeleton height={48} count={2} />}
          {free.data && <SlotPicker slots={free.data.slots} value={newSlot?.id} onChange={setNewSlot} />}
          {reschedule.isError && <Notice kind="danger">{errorMessage(reschedule.error, t)}</Notice>}
          <div className="btn-row">
            <Button variant="secondary" onClick={() => setMode('view')}>
              {t('Wróć')}
            </Button>
            <Button onClick={() => reschedule.mutate()} disabled={!newSlot} loading={reschedule.isPending}>
              {newSlot ? t('Przenieś na {d}', { d: fmt.dateTime(newSlot.start) }) : t('Wybierz termin')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function BookSlotModal({ slot, services, onClose, presetPatient }: { slot: SlotView; services: ServiceView[]; onClose: () => void; presetPatient?: PatientView }) {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const available = services.filter((s) => slot.serviceIds.includes(s.id));
  const [serviceId, setServiceId] = useState(available[0]?.id ?? '');
  const [patient, setPatient] = useState<PatientView | undefined>(presetPatient);
  const [comment, setComment] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [np, setNp] = useState({ given: '', family: '', birthDate: '', pesel: '', phone: '' });
  useEffect(() => {
    if (!serviceId && available[0]) setServiceId(available[0].id);
  }, [available, serviceId]);
  const createPatient = useMutation({
    mutationFn: () => post<PatientView>('/api/staff/patients', { ...np, identityVerified: false }),
    onSuccess: (p) => {
      setPatient(p);
      setNewOpen(false);
    },
  });
  const book = useMutation({
    mutationFn: () => post('/api/staff/appointments', { slotId: slot.id, serviceId, patientId: patient?.id, comment: comment || undefined }),
    onSuccess: () => {
      toast(t('Wizyta zarezerwowana. Pacjent zobaczy ją w aplikacji.'));
      void qc.invalidateQueries({ queryKey: ['calendar'] });
      void qc.invalidateQueries({ queryKey: ['patient'] });
      onClose();
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={t('Rezerwacja: {d}', { d: `${fmt.dateLong(slot.start)}, ${fmt.time(slot.start)}` })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('Anuluj')}
          </Button>
          <Button onClick={() => book.mutate()} disabled={!patient || !serviceId} loading={book.isPending}>
            {t('Zarezerwuj')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="muted small">{slot.practitionerName}</p>
        <SelectField label={t('Usługa')} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.durationMinutes} min)
            </option>
          ))}
        </SelectField>
        {patient ? (
          <Notice kind="ok" title={patient.name}>
            {patient.birthDate} {patient.phone ? `· ${patient.phone}` : ''}{' '}
            {!presetPatient && (
              <Button size="sm" variant="ghost" onClick={() => setPatient(undefined)}>
                {t('Zmień')}
              </Button>
            )}
          </Notice>
        ) : newOpen ? (
          <div className="stack card" style={{ background: 'var(--surface-2)' }}>
            <strong>{t('Nowy pacjent')}</strong>
            <div className="grid-2">
              <TextField label={t('Imię')} value={np.given} onChange={(e) => setNp({ ...np, given: e.target.value })} required />
              <TextField label={t('Nazwisko')} value={np.family} onChange={(e) => setNp({ ...np, family: e.target.value })} required />
              <TextField label={t('Data urodzenia')} type="date" value={np.birthDate} onChange={(e) => setNp({ ...np, birthDate: e.target.value })} />
              <TextField label="PESEL" inputMode="numeric" maxLength={11} value={np.pesel} onChange={(e) => setNp({ ...np, pesel: e.target.value })} />
              <TextField label={t('Telefon')} type="tel" value={np.phone} onChange={(e) => setNp({ ...np, phone: e.target.value })} />
            </div>
            {createPatient.isError && <Notice kind="danger">{errorMessage(createPatient.error, t)}</Notice>}
            <div className="btn-row">
              <Button size="sm" variant="secondary" onClick={() => setNewOpen(false)}>
                {t('Anuluj')}
              </Button>
              <Button size="sm" onClick={() => createPatient.mutate()} loading={createPatient.isPending}>
                {t('Dodaj pacjenta')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Combobox<PatientView>
              label={t('Pacjent')}
              placeholder={t('Nazwisko, PESEL, telefon lub data urodzenia')}
              search={async (term, signal) => (await get<{ items: PatientView[] }>(`/api/staff/patients${qs({ q: term })}`, signal)).items}
              render={(p) => (
                <span>
                  <strong>{p.name}</strong> <span className="muted small">{p.birthDate} {p.phone ? `· ${p.phone}` : ''}</span>
                </span>
              )}
              onSelect={setPatient}
            />
            <Button variant="ghost" size="sm" icon={<UserPlus size={16} />} onClick={() => setNewOpen(true)} style={{ alignSelf: 'flex-start' }}>
              {t('Nowy pacjent')}
            </Button>
          </>
        )}
        <TextArea label={t('Uwagi (widoczne dla pacjenta)')} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
        {book.isError && <Notice kind="danger">{errorMessage(book.error, t)}</Notice>}
      </div>
    </Modal>
  );
}
