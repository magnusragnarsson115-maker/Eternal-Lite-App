import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, CalendarPlus, FilePlus2, FileText, FlaskConical, KeyRound, MessageSquarePlus, Paperclip, Plus, Search, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, get, post, put, qs } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { RecordBody } from '../patient/RecordPages';
import { hasRole, useSession } from '../session';
import type { AppointmentView, ConsentState, MeasurementView, MedicationView, PatientView, RecordView, ServiceView, SlotView, ThreadView } from '../types';
import { Badge, Button, Card, Checkbox, Combobox, Empty, Modal, Notice, PageHead, QueryError, SelectField, Skeleton, StatusBadge, Switch, Tabs, TextArea, TextField, useToast } from '../ui';
import { SlotPicker } from '../ui/SlotPicker';
import { TrendChart } from '../ui/TrendChart';
import { AppointmentModal, BookSlotModal } from './CalendarPage';

export function PatientsPage() {
  const { t } = useI18n();
  const nav = useNavigate();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const q = useQuery({ queryKey: ['patients', submitted], queryFn: () => get<{ items: PatientView[] }>(`/api/staff/patients${qs({ q: submitted })}`), enabled: submitted.length >= 2 });
  return (
    <div className="stack-lg">
      <PageHead title={t('Pacjenci')} action={<Button icon={<UserPlus size={18} />} onClick={() => setCreateOpen(true)}>{t('Nowy pacjent')}</Button>} />
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(query.trim());
        }}
      >
        <input className="input grow" style={{ maxWidth: 460 }} placeholder={t('Nazwisko, PESEL, telefon lub data urodzenia (RRRR-MM-DD)')} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={t('Szukaj pacjenta')} />
        <Button type="submit" icon={<Search size={18} />}>
          {t('Szukaj')}
        </Button>
      </form>
      <p className="small muted">{t('Każde wyszukiwanie i otwarcie karty jest rejestrowane w dzienniku dostępu.')}</p>
      {q.isLoading && <Skeleton />}
      {q.isError && <QueryError error={q.error} />}
      {q.data && q.data.items.length === 0 && <Empty title={t('Nie znaleziono pacjentów')} />}
      {q.data && q.data.items.length > 0 && (
        <div className="card card-flush table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('Pacjent')}</th>
                <th scope="col">{t('Data urodzenia')}</th>
                <th scope="col">PESEL</th>
                <th scope="col">{t('Telefon')}</th>
                <th scope="col">{t('Status')}</th>
              </tr>
            </thead>
            <tbody>
              {q.data.items.map((p) => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => nav(`/panel/pacjenci/${p.id}`)}>
                  <td>
                    <Link to={`/panel/pacjenci/${p.id}`} onClick={(e) => e.stopPropagation()} style={{ fontWeight: 600 }}>
                      {p.name}
                    </Link>
                  </td>
                  <td>{p.birthDate}</td>
                  <td className="mono">{p.pesel ?? '—'}</td>
                  <td>{p.phone ?? '—'}</td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      {p.identityVerified ? <Badge kind="ok">{t('tożsamość ✓')}</Badge> : <Badge kind="warn">{t('niepotwierdzona')}</Badge>}
                      {p.hasAccount && <Badge kind="primary">{t('konto')}</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <PatientFormModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={(p) => nav(`/panel/pacjenci/${p.id}`)} />
    </div>
  );
}

function PatientFormModal({ open, onClose, onSaved, patient }: { open: boolean; onClose: () => void; onSaved: (p: PatientView) => void; patient?: PatientView }) {
  const { t } = useI18n();
  const [f, setF] = useState({
    given: patient?.given ?? '',
    family: patient?.family ?? '',
    birthDate: patient?.birthDate ?? '',
    pesel: patient?.pesel ?? '',
    phone: patient?.phone ?? '',
    email: patient?.email ?? '',
    line: patient?.address?.line ?? '',
    postalCode: patient?.address?.postalCode ?? '',
    city: patient?.address?.city ?? '',
    identityVerified: false,
  });
  const save = useMutation({
    mutationFn: () => {
      const body = {
        given: f.given,
        family: f.family,
        birthDate: f.birthDate,
        pesel: f.pesel,
        phone: f.phone,
        email: f.email,
        address: { line: f.line || undefined, postalCode: f.postalCode || undefined, city: f.city || undefined },
      };
      return patient ? put<PatientView>(`/api/staff/patients/${patient.id}`, body) : post<PatientView>('/api/staff/patients', { ...body, identityVerified: f.identityVerified });
    },
    onSuccess: (p) => {
      onSaved(p);
      onClose();
    },
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={patient ? t('Edycja danych pacjenta') : t('Nowy pacjent')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('Anuluj')}
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending}>
            {t('Zapisz')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="grid-2">
          <TextField label={t('Imię')} value={f.given} onChange={set('given')} required />
          <TextField label={t('Nazwisko')} value={f.family} onChange={set('family')} required />
          <TextField label="PESEL" inputMode="numeric" maxLength={11} value={f.pesel} onChange={set('pesel')} hint={t('Data urodzenia i płeć zostaną odczytane z numeru.')} />
          <TextField label={t('Data urodzenia')} type="date" value={f.birthDate} onChange={set('birthDate')} />
          <TextField label={t('Telefon')} type="tel" value={f.phone} onChange={set('phone')} />
          <TextField label={t('E-mail')} type="email" value={f.email} onChange={set('email')} />
          <TextField label={t('Ulica i numer')} value={f.line} onChange={set('line')} />
          <TextField label={t('Kod i miejscowość')} value={f.city} onChange={set('city')} placeholder="Warszawa" />
        </div>
        {!patient && <Checkbox label={t('Tożsamość potwierdzona dokumentem')} hint={t('Zaznacz tylko po okazaniu dowodu osobistego, paszportu lub mObywatela.')} checked={f.identityVerified} onChange={(e) => setF({ ...f, identityVerified: e.target.checked })} />}
        {save.isError && <Notice kind="danger">{errorMessage(save.error, t)}</Notice>}
      </div>
    </Modal>
  );
}

interface PatientCard {
  patient: PatientView;
  consents: ConsentState[];
  appointments: AppointmentView[];
  clinicalAccess: boolean;
}

interface ClinicalData {
  records: RecordView[];
  measurements: { shared: boolean; items: MeasurementView[] };
  medications: MedicationView[];
  questionnaires: { id: string; authored: string; answers: { question: string; answer: string }[]; appointmentId: string }[];
}

type Tab = 'data' | 'appointments' | 'records' | 'measurements' | 'medications' | 'questionnaires' | 'messages' | 'consents';

export function PatientDetailPage() {
  const { id = '' } = useParams();
  const { t, fmt, locale } = useI18n();
  const { me } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const clinician = hasRole(me, 'practitioner');
  const [tab, setTab] = useState<Tab>('data');
  const [editOpen, setEditOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [method, setMethod] = useState('id-card');
  const [activation, setActivation] = useState<{ code: string; expiresInDays: number } | null>(null);
  const [apptId, setApptId] = useState<string | null>(null);
  const [bookOpen, setBookOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [openRecord, setOpenRecord] = useState<RecordView | null>(null);

  const card = useQuery({ queryKey: ['patient', id], queryFn: () => get<PatientCard>(`/api/staff/patients/${id}`) });
  const clinical = useQuery({ queryKey: ['patient-clinical', id], queryFn: () => get<ClinicalData>(`/api/staff/patients/${id}/clinical`), enabled: clinician && ['records', 'measurements', 'medications', 'questionnaires'].includes(tab) });
  const threads = useQuery({ queryKey: ['threads', 'patient', id], queryFn: () => get<{ items: ThreadView[] }>(`/api/staff/threads${qs({ patientId: id })}`), enabled: tab === 'messages' });

  const verify = useMutation({
    mutationFn: () => post<PatientView>(`/api/staff/patients/${id}/verify-identity`, { method }),
    onSuccess: () => {
      setVerifyOpen(false);
      void qc.invalidateQueries({ queryKey: ['patient', id] });
      toast(t('Tożsamość potwierdzona — pacjent ma dostęp do udostępnionych wyników.'));
    },
  });
  const activate = useMutation({ mutationFn: () => post<{ code: string; expiresInDays: number }>(`/api/staff/patients/${id}/activation-code`), onSuccess: setActivation });
  const share = useMutation({
    mutationFn: ({ r, shared }: { r: RecordView; shared: boolean }) => post<RecordView>(`/api/staff/records/${r.type === 'report' ? 'r' : 'd'}/${r.id}/share`, { shared }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['patient-clinical', id] });
      toast(r.shared ? t('Udostępniono pacjentowi — otrzymał powiadomienie.') : t('Cofnięto udostępnienie.'));
    },
    onError: (err) => toast(errorMessage(err, t), 'error'),
  });

  if (card.isLoading) return <Skeleton count={3} />;
  if (card.isError) return <QueryError error={card.error} />;
  const { patient: p, consents, appointments } = card.data!;
  const upcoming = appointments.filter((a) => ['booked', 'arrived'].includes(a.status) && Date.parse(a.end) > Date.now());

  const tabs: { value: Tab; label: string }[] = [
    { value: 'data', label: t('Dane') },
    { value: 'appointments', label: `${t('Wizyty')} (${appointments.length})` },
    ...(clinician
      ? ([
          { value: 'records', label: t('Wyniki i dokumenty') },
          { value: 'measurements', label: t('Pomiary') },
          { value: 'medications', label: t('Leki') },
          { value: 'questionnaires', label: t('Wywiady') },
        ] as { value: Tab; label: string }[])
      : []),
    { value: 'messages', label: t('Wiadomości') },
    { value: 'consents', label: t('Zgody') },
  ];

  return (
    <div className="stack-lg">
      <PageHead
        title={p.name}
        sub={
          <span className="row" style={{ gap: 6 }}>
            {p.birthDate} · {p.gender === 'female' ? t('kobieta') : p.gender === 'male' ? t('mężczyzna') : ''}
            {p.identityVerified ? <Badge kind="ok">{t('tożsamość potwierdzona')}</Badge> : <Badge kind="warn">{t('tożsamość niepotwierdzona')}</Badge>}
            {p.hasAccount ? <Badge kind="primary">{t('konto w aplikacji')}</Badge> : <Badge>{t('bez konta')}</Badge>}
            {p.fictional && <Badge>{t('dane fikcyjne')}</Badge>}
          </span>
        }
        back={{ to: '/panel/pacjenci', label: t('Pacjenci') }}
        action={
          <div className="btn-row">
            <Button size="sm" icon={<CalendarPlus size={16} />} onClick={() => setBookOpen(true)}>
              {t('Umów wizytę')}
            </Button>
            {clinician && (
              <Button size="sm" variant="secondary" icon={<FlaskConical size={16} />} onClick={() => setReportOpen(true)}>
                {t('Dodaj wynik')}
              </Button>
            )}
          </div>
        }
      />
      <Tabs label={t('Karta pacjenta')} value={tab} onChange={setTab} tabs={tabs} />

      {tab === 'data' && (
        <div className="grid-2">
          <Card title={t('Dane osobowe i kontaktowe')} action={<Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>{t('Edytuj')}</Button>}>
            <dl className="kv">
              <dt>PESEL</dt>
              <dd className="mono">{p.pesel ?? '—'}</dd>
              <dt>{t('Telefon')}</dt>
              <dd>{p.phone ?? '—'}</dd>
              <dt>{t('E-mail')}</dt>
              <dd>{p.email ?? '—'}</dd>
              <dt>{t('Adres')}</dt>
              <dd>{p.address ? [p.address.line, p.address.postalCode, p.address.city].filter(Boolean).join(', ') : '—'}</dd>
              <dt>{t('Najbliższa wizyta')}</dt>
              <dd>{upcoming[0] ? `${fmt.dateTime(upcoming[0].start)} · ${upcoming[0].serviceName}` : '—'}</dd>
            </dl>
          </Card>
          <Card title={t('Dostęp do aplikacji')}>
            <div className="stack">
              {!p.identityVerified && (
                <Notice kind="warn" title={t('Tożsamość niepotwierdzona')}>
                  <p>{t('Do czasu potwierdzenia pacjent nie widzi wyników ani dokumentów w aplikacji.')}</p>
                  <Button size="sm" icon={<BadgeCheck size={16} />} onClick={() => setVerifyOpen(true)}>
                    {t('Potwierdź tożsamość')}
                  </Button>
                </Notice>
              )}
              {!p.hasAccount && p.identityVerified && (
                <>
                  <p className="small muted">{t('Pacjent nie ma konta. Wydaj kod aktywacyjny — pacjent założy konto i od razu zobaczy swoje dane.')}</p>
                  <Button size="sm" variant="secondary" icon={<KeyRound size={16} />} onClick={() => activate.mutate()} loading={activate.isPending} style={{ alignSelf: 'flex-start' }}>
                    {t('Wydaj kod aktywacyjny')}
                  </Button>
                  {activate.isError && <Notice kind="danger">{errorMessage(activate.error, t)}</Notice>}
                </>
              )}
              {p.hasAccount && <p className="small">{t('Pacjent korzysta z aplikacji. Zmiany wizyt, wyniki i wiadomości widzi na bieżąco.')}</p>}
              <Button size="sm" variant="ghost" icon={<MessageSquarePlus size={16} />} onClick={() => setMsgOpen(true)} style={{ alignSelf: 'flex-start' }} disabled={!p.hasAccount}>
                {t('Napisz do pacjenta')}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {tab === 'appointments' && (
        <div className="card card-flush">
          {appointments.length === 0 ? (
            <Empty title={t('Brak wizyt')} />
          ) : (
            <ul className="list">
              {appointments.map((a) => (
                <li key={a.id}>
                  <button type="button" className="list-item" onClick={() => setApptId(a.id)}>
                    <span className="grow">
                      <span className="list-title" style={{ display: 'block' }}>
                        {fmt.dateTime(a.start)} · {a.serviceName}
                      </span>
                      <span className="list-sub">{a.practitionerName}</span>
                    </span>
                    <StatusBadge status={a.status} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'records' && clinician && (
        <div className="stack">
          <div className="btn-row">
            <Button size="sm" icon={<FlaskConical size={16} />} onClick={() => setReportOpen(true)}>
              {t('Dodaj wynik badania')}
            </Button>
            <Button size="sm" variant="secondary" icon={<FilePlus2 size={16} />} onClick={() => setDocOpen(true)}>
              {t('Dodaj dokument / zalecenia')}
            </Button>
          </div>
          {!p.identityVerified && <Notice kind="warn">{t('Udostępnianie wymaga potwierdzenia tożsamości pacjenta.')}</Notice>}
          {clinical.isLoading && <Skeleton />}
          {clinical.data && clinical.data.records.length === 0 && <Empty title={t('Brak wyników i dokumentów')} />}
          {clinical.data && clinical.data.records.length > 0 && (
            <div className="card card-flush">
              <ul className="list">
                {clinical.data.records.map((r) => (
                  <li key={r.ref} className="list-item">
                    <span className={`list-icon ${r.type === 'report' ? 'info' : ''}`}>{r.type === 'report' ? <FlaskConical size={20} /> : <FileText size={20} />}</span>
                    <button type="button" className="grow" style={{ background: 'none', border: 0, textAlign: 'left', font: 'inherit', cursor: 'pointer', color: 'inherit', padding: 0 }} onClick={() => setOpenRecord(r)}>
                      <span className="list-title" style={{ display: 'block' }}>
                        {r.title} {r.attachment && <Paperclip size={14} aria-label={t('załącznik')} />}
                      </span>
                      <span className="list-sub">
                        {fmt.date(r.date)} · {r.shared ? (r.readAt ? t('odczytano {d}', { d: fmt.dateTime(r.readAt) }) : t('udostępniono, nieodczytane')) : t('nieudostępnione')}
                      </span>
                    </button>
                    <span className="row" style={{ gap: 8 }}>
                      <span className="small muted">{t('Pacjent widzi')}</span>
                      <Switch checked={r.shared} label={t('Udostępnij pacjentowi: {t}', { t: r.title })} onChange={(v) => share.mutate({ r, shared: v })} disabled={share.isPending || (!p.identityVerified && !r.shared)} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === 'measurements' && clinician && (
        <Card title={t('Pomiary domowe pacjenta')}>
          {clinical.isLoading && <Skeleton />}
          {clinical.data && !clinical.data.measurements.shared && <Notice kind="info">{t('Pacjent nie wyraził zgody na przekazywanie pomiarów placówce.')}</Notice>}
          {clinical.data?.measurements.shared && clinical.data.measurements.items.length === 0 && <Empty title={t('Brak pomiarów')} />}
          {clinical.data?.measurements.shared && clinical.data.measurements.items.length > 0 && <MeasurementsSummary items={clinical.data.measurements.items} />}
        </Card>
      )}

      {tab === 'medications' && clinician && (
        <Card title={t('Leki zgłoszone przez pacjenta')}>
          {clinical.data && clinical.data.medications.length === 0 && <Empty title={t('Brak leków na liście')} />}
          <ul className="list">
            {clinical.data?.medications.map((m) => (
              <li key={m.id} className="list-item" style={{ padding: '10px 0' }}>
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>{m.name}</span>
                  <span className="list-sub">{[m.dosage, m.since && t('od {d}', { d: m.since }), m.rplId && 'RPL'].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="small muted">{fmt.date(m.reportedAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {tab === 'questionnaires' && clinician && (
        <div className="stack">
          {clinical.data && clinical.data.questionnaires.length === 0 && <Empty title={t('Brak wypełnionych wywiadów')} />}
          {clinical.data?.questionnaires.map((qr) => (
            <Card key={qr.id} title={<h3>{t('Wywiad z {d}', { d: fmt.dateTime(qr.authored) })}</h3>}>
              <dl className="kv">
                {qr.answers.map((x, i) => (
                  <div key={i} style={{ display: 'contents' }}>
                    <dt>{x.question}</dt>
                    <dd>{x.answer}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ))}
        </div>
      )}

      {tab === 'messages' && (
        <div className="stack">
          <Button size="sm" icon={<MessageSquarePlus size={16} />} onClick={() => setMsgOpen(true)} disabled={!p.hasAccount} style={{ alignSelf: 'flex-start' }}>
            {t('Nowa wiadomość')}
          </Button>
          {threads.data && threads.data.items.length === 0 && <Empty title={t('Brak wiadomości')} />}
          {threads.data && threads.data.items.length > 0 && (
            <div className="card card-flush">
              <ul className="list">
                {threads.data.items.map((th) => (
                  <li key={th.id}>
                    <Link to={`/panel/wiadomosci/${th.id}`} className="list-item">
                      {th.unread && <span className="unread-dot" />}
                      <span className="grow">
                        <span className="list-title" style={{ display: 'block' }}>{th.subject}</span>
                        <span className="list-sub">{fmt.relative(th.lastMessageAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {tab === 'consents' && (
        <Card title={t('Zgody pacjenta')} className="card-flush" as="section">
          <ul className="list">
            {consents.map((c) => (
              <li key={c.type} className="list-item">
                <span className="grow">{locale === 'en' ? c.label.en : c.label.pl}</span>
                <span className="small muted">{c.updatedAt ? fmt.dateTime(c.updatedAt) : ''}</span>
                <Badge kind={c.granted ? 'ok' : undefined}>{c.granted ? t('tak') : t('nie')}</Badge>
              </li>
            ))}
          </ul>
          <p className="small muted" style={{ padding: '0 18px 14px' }}>{t('Zgody zmienia wyłącznie pacjent w aplikacji. Historia zmian jest zapisana w zasobach FHIR Consent.')}</p>
        </Card>
      )}

      {editOpen && <PatientFormModal open onClose={() => setEditOpen(false)} patient={p} onSaved={() => void qc.invalidateQueries({ queryKey: ['patient', id] })} />}
      <Modal
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        title={t('Potwierdzenie tożsamości')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setVerifyOpen(false)}>
              {t('Anuluj')}
            </Button>
            <Button onClick={() => verify.mutate()} loading={verify.isPending}>
              {t('Potwierdzam')}
            </Button>
          </>
        }
      >
        <div className="stack">
          <p>{t('Potwierdź, że pacjent okazał dokument tożsamości, a dane w kartotece są z nim zgodne.')}</p>
          <SelectField label={t('Dokument')} value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="id-card">{t('Dowód osobisty')}</option>
            <option value="passport">{t('Paszport')}</option>
            <option value="mobywatel">mObywatel</option>
            <option value="other">{t('Inny dokument ze zdjęciem')}</option>
          </SelectField>
          {verify.isError && <Notice kind="danger">{errorMessage(verify.error, t)}</Notice>}
        </div>
      </Modal>
      <Modal open={!!activation} onClose={() => setActivation(null)} title={t('Kod aktywacyjny')}>
        {activation && (
          <div className="stack" style={{ textAlign: 'center' }}>
            <p className="mono" style={{ fontSize: '2rem', fontWeight: 750, letterSpacing: '0.08em', margin: '8px 0' }}>{activation.code}</p>
            <p className="small muted">{t('Przekaż kod pacjentowi (wydruk lub ustnie). Ważny {n} dni, jednorazowy. Przy aktywacji pacjent poda też datę urodzenia.', { n: activation.expiresInDays })}</p>
            <Button variant="secondary" onClick={() => window.print()}>
              {t('Drukuj')}
            </Button>
          </div>
        )}
      </Modal>
      {apptId && <AppointmentModal id={apptId} onClose={() => setApptId(null)} />}
      {bookOpen && <BookForPatientModal patient={p} onClose={() => setBookOpen(false)} />}
      {reportOpen && <ReportFormModal patient={p} onClose={() => setReportOpen(false)} />}
      {docOpen && <DocumentFormModal patient={p} onClose={() => setDocOpen(false)} />}
      {msgOpen && <NewMessageModal patient={p} onClose={() => setMsgOpen(false)} />}
      <Modal open={!!openRecord} onClose={() => setOpenRecord(null)} title={openRecord?.title ?? ''} wide>
        {openRecord && <RecordLoader record={openRecord} />}
      </Modal>
    </div>
  );
}

function RecordLoader({ record }: { record: RecordView }) {
  const q = useQuery({ queryKey: ['record', 'staff', record.ref], queryFn: () => get<RecordView>(`/api/staff/records/${record.type === 'report' ? 'r' : 'd'}/${record.id}`) });
  if (q.isLoading) return <Skeleton count={2} />;
  if (q.isError) return <QueryError error={q.error} />;
  return <RecordBody record={q.data!} fileBase="/api/staff/files" />;
}

function MeasurementsSummary({ items }: { items: MeasurementView[] }) {
  const { t, fmt } = useI18n();
  const bp = items.filter((m) => m.kind === 'bp').sort((a, b) => a.effective.localeCompare(b.effective)).slice(-30);
  const others = items.filter((m) => m.kind !== 'bp').slice(0, 12);
  return (
    <div className="stack">
      {bp.length > 0 && (
        <>
          <h3>{t('Ciśnienie tętnicze')}</h3>
          <TrendChart
            dates={bp.map((m) => m.effective)}
            unit="mmHg"
            series={[
              { key: 's', label: t('Skurczowe'), color: 'var(--chart-line)', values: bp.map((m) => m.systolic) },
              { key: 'd', label: t('Rozkurczowe'), color: 'var(--chart-line-2)', values: bp.map((m) => m.diastolic) },
            ]}
          />
        </>
      )}
      {others.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{t('Data')}</th>
              <th scope="col">{t('Pomiar')}</th>
              <th scope="col" className="num">{t('Wartość')}</th>
              <th scope="col">{t('Źródło')}</th>
            </tr>
          </thead>
          <tbody>
            {others.map((m) => (
              <tr key={m.id}>
                <td>{fmt.dateTime(m.effective)}</td>
                <td>{t({ heartRate: 'Tętno', weight: 'Waga', height: 'Wzrost', temperature: 'Temperatura', spo2: 'Saturacja', glucose: 'Glukoza', bp: 'Ciśnienie' }[m.kind])}</td>
                <td className="num">
                  {fmt.number(m.value)} {m.unit}
                </td>
                <td className="small">{m.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="small muted">{t('Pomiary wprowadzone przez pacjenta lub z urządzeń — bez weryfikacji placówki.')}</p>
    </div>
  );
}

function BookForPatientModal({ patient, onClose }: { patient: PatientView; onClose: () => void }) {
  const { t } = useI18n();
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: () => get<{ services: ServiceView[] }>('/api/catalog') });
  const [serviceId, setServiceId] = useState('');
  const [slot, setSlot] = useState<SlotView | null>(null);
  const free = useQuery({ queryKey: ['free-slots', serviceId], queryFn: () => get<{ slots: SlotView[] }>(`/api/staff/slots/free${qs({ serviceId })}`), enabled: !!serviceId });
  if (slot) return <BookSlotModal slot={slot} services={catalog.data?.services ?? []} presetPatient={patient} onClose={onClose} />;
  return (
    <Modal open onClose={onClose} title={t('Umów wizytę: {p}', { p: patient.name })} wide>
      <div className="stack">
        <SelectField label={t('Usługa')} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
          <option value="">{t('Wybierz…')}</option>
          {catalog.data?.services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </SelectField>
        {free.isLoading && <Skeleton height={48} count={2} />}
        {free.data && <SlotPicker slots={free.data.slots} onChange={setSlot} showPractitioner />}
      </div>
    </Modal>
  );
}

interface LoincHit {
  code: string;
  display: string;
  displayPl?: string;
  unit?: string;
  source: string;
}

interface ObsRow {
  loinc?: string;
  name: string;
  value: string;
  unit: string;
  refLow: string;
  refHigh: string;
  refText: string;
  labFlag: string;
}

const emptyRow = (): ObsRow => ({ name: '', value: '', unit: '', refLow: '', refHigh: '', refText: '', labFlag: '' });

function ReportFormModal({ patient, onClose }: { patient: PatientView; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ title: '', loinc: '', category: 'LAB', effective: new Date().toISOString().slice(0, 10), laboratory: '', conclusion: '', share: false });
  const [rows, setRows] = useState<ObsRow[]>([emptyRow()]);
  const [file, setFile] = useState<{ binaryId: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');
  const searchLoinc = async (term: string, signal: AbortSignal) => (await get<{ hits: LoincHit[] }>(`/api/staff/terminology/loinc${qs({ q: term })}`, signal)).hits;
  const num = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));
  const save = useMutation({
    mutationFn: () =>
      post<RecordView>('/api/staff/reports', {
        patientId: patient.id,
        title: f.title,
        loinc: f.loinc || undefined,
        category: f.category,
        effective: new Date(`${f.effective}T08:00:00`).toISOString(),
        laboratory: f.laboratory || undefined,
        conclusion: f.conclusion || undefined,
        binaryId: file?.binaryId,
        share: f.share,
        observations: rows
          .filter((r) => r.name.trim() && r.value.trim())
          .map((r) => ({ loinc: r.loinc, name: r.name, value: r.value, unit: r.unit || undefined, refLow: num(r.refLow), refHigh: num(r.refHigh), refText: r.refText || undefined, labFlag: r.labFlag || undefined })),
      }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['patient-clinical', patient.id] });
      toast(r.shared ? t('Wynik zapisany i udostępniony pacjentowi.') : t('Wynik zapisany (nieudostępniony).'));
      onClose();
    },
  });
  const upload = async (fl: File) => {
    setUploadErr('');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', fl);
      const r = await api<{ binaryId: string }>('/api/staff/uploads', { method: 'POST', form });
      setFile({ binaryId: r.binaryId, name: fl.name });
    } catch (err) {
      setUploadErr(errorMessage(err, t));
    } finally {
      setUploading(false);
    }
  };
  const setRow = (i: number, patch: Partial<ObsRow>) => setRows(rows.map((r, j) => (i === j ? { ...r, ...patch } : r)));
  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={t('Nowy wynik badania: {p}', { p: patient.name })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('Anuluj')}
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending}>
            {f.share ? t('Zapisz i udostępnij') : t('Zapisz')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <div className="grid-2">
          <Combobox<LoincHit>
            label={t('Badanie (LOINC)')}
            placeholder={t('np. morfologia, lipidogram, TSH')}
            search={searchLoinc}
            render={(h) => (
              <span>
                <strong>{h.displayPl ?? h.display}</strong> <span className="mono small muted">{h.code}</span>
              </span>
            )}
            onSelect={(h) => setF({ ...f, title: h.displayPl ?? h.display, loinc: h.code })}
          />
          <TextField label={t('Tytuł wyniku')} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} hint={f.loinc ? `LOINC ${f.loinc}` : undefined} required />
          <SelectField label={t('Rodzaj')} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            <option value="LAB">{t('Laboratoryjne')}</option>
            <option value="RAD">{t('Obrazowe')}</option>
            <option value="OTH">{t('Inne')}</option>
          </SelectField>
          <TextField label={t('Data badania')} type="date" value={f.effective} onChange={(e) => setF({ ...f, effective: e.target.value })} />
          <TextField label={t('Laboratorium / pracownia')} value={f.laboratory} onChange={(e) => setF({ ...f, laboratory: e.target.value })} />
        </div>
        <h3 style={{ marginTop: 6 }}>{t('Parametry (przepisz z wyniku laboratorium)')}</h3>
        {rows.map((r, i) => (
          <div key={i} className="card" style={{ padding: 12, background: 'var(--surface-2)' }}>
            <div className="grid-3">
              <Combobox<LoincHit>
                label={t('Parametr')}
                search={searchLoinc}
                render={(h) => (
                  <span>
                    {h.displayPl ?? h.display} <span className="mono small muted">{h.code}</span>
                  </span>
                )}
                onSelect={(h) => setRow(i, { loinc: h.code, name: h.displayPl ?? h.display, unit: h.unit ?? r.unit })}
              />
              <TextField label={t('Nazwa')} value={r.name} onChange={(e) => setRow(i, { name: e.target.value, loinc: undefined })} hint={r.loinc ? `LOINC ${r.loinc}` : undefined} />
              <div className="grid-2" style={{ gap: 8 }}>
                <TextField label={t('Wynik')} value={r.value} onChange={(e) => setRow(i, { value: e.target.value })} />
                <TextField label={t('Jednostka')} value={r.unit} onChange={(e) => setRow(i, { unit: e.target.value })} />
              </div>
            </div>
            <div className="row" style={{ marginTop: 8, alignItems: 'flex-end' }}>
              <TextField label={t('Zakres od')} inputMode="decimal" value={r.refLow} onChange={(e) => setRow(i, { refLow: e.target.value })} style={{ width: 100 }} />
              <TextField label={t('Zakres do')} inputMode="decimal" value={r.refHigh} onChange={(e) => setRow(i, { refHigh: e.target.value })} style={{ width: 100 }} />
              <SelectField label={t('Oznaczenie lab.')} value={r.labFlag} onChange={(e) => setRow(i, { labFlag: e.target.value })} style={{ width: 120 }}>
                <option value="">—</option>
                <option value="H">H</option>
                <option value="L">L</option>
                <option value="HH">HH</option>
                <option value="LL">LL</option>
                <option value="A">A</option>
                <option value="N">N</option>
              </SelectField>
              <Button variant="ghost" size="sm" aria-label={t('Usuń parametr')} icon={<Trash2 size={16} />} onClick={() => setRows(rows.filter((_, j) => j !== i))} disabled={rows.length === 1} />
            </div>
          </div>
        ))}
        <Button variant="ghost" size="sm" icon={<Plus size={16} />} onClick={() => setRows([...rows, emptyRow()])} style={{ alignSelf: 'flex-start' }}>
          {t('Dodaj parametr')}
        </Button>
        <div className="field">
          <label htmlFor="report-file">{t('Plik wyniku (PDF, JPG, PNG — opcjonalnie)')}</label>
          <input id="report-file" type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          {uploading && <span className="hint">{t('Przesyłanie…')}</span>}
          {file && <span className="hint">✓ {file.name}</span>}
          {uploadErr && <span className="error">{uploadErr}</span>}
        </div>
        <TextArea label={t('Komentarz lekarza (widoczny dla pacjenta po udostępnieniu)')} value={f.conclusion} onChange={(e) => setF({ ...f, conclusion: e.target.value })} maxLength={4000} />
        <Checkbox label={t('Udostępnij pacjentowi od razu')} hint={patient.identityVerified ? t('Pacjent otrzyma powiadomienie (bez treści wyniku).') : t('Wymaga potwierdzenia tożsamości pacjenta.')} checked={f.share} disabled={!patient.identityVerified} onChange={(e) => setF({ ...f, share: e.target.checked })} />
        {save.isError && <Notice kind="danger">{errorMessage(save.error, t)}</Notice>}
      </div>
    </Modal>
  );
}

function DocumentFormModal({ patient, onClose }: { patient: PatientView; onClose: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [f, setF] = useState({ title: 'Zalecenia po wizycie', kind: 'recommendations', text: '', share: false });
  const save = useMutation({
    mutationFn: () => post<RecordView>('/api/staff/documents', { patientId: patient.id, ...f }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['patient-clinical', patient.id] });
      toast(r.shared ? t('Dokument zapisany i udostępniony.') : t('Dokument zapisany.'));
      onClose();
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={t('Nowy dokument: {p}', { p: patient.name })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('Anuluj')}
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending}>
            {t('Zapisz')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <SelectField label={t('Rodzaj dokumentu')} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
          <option value="recommendations">{t('Zalecenia')}</option>
          <option value="visit-summary">{t('Podsumowanie wizyty')}</option>
          <option value="certificate">{t('Zaświadczenie')}</option>
          <option value="other">{t('Inny')}</option>
        </SelectField>
        <TextField label={t('Tytuł')} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <TextArea label={t('Treść')} rows={8} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} maxLength={10000} />
        <Checkbox label={t('Udostępnij pacjentowi')} checked={f.share} disabled={!patient.identityVerified} onChange={(e) => setF({ ...f, share: e.target.checked })} />
        {save.isError && <Notice kind="danger">{errorMessage(save.error, t)}</Notice>}
      </div>
    </Modal>
  );
}

function NewMessageModal({ patient, onClose }: { patient: PatientView; onClose: () => void }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const [f, setF] = useState({ subject: '', body: '' });
  const send = useMutation({ mutationFn: () => post<ThreadView>('/api/staff/threads', { patientId: patient.id, ...f }), onSuccess: (th) => nav(`/panel/wiadomosci/${th.id}`) });
  return (
    <Modal
      open
      onClose={onClose}
      title={t('Wiadomość do: {p}', { p: patient.name })}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('Anuluj')}
          </Button>
          <Button onClick={() => send.mutate()} loading={send.isPending} disabled={!f.subject.trim() || !f.body.trim()}>
            {t('Wyślij')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <TextField label={t('Temat')} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} maxLength={120} />
        <TextArea label={t('Treść')} rows={6} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} maxLength={2000} />
        <p className="small muted">{t('Pacjent otrzyma powiadomienie bez treści wiadomości.')}</p>
        {send.isError && <Notice kind="danger">{errorMessage(send.error, t)}</Notice>}
      </div>
    </Modal>
  );
}
