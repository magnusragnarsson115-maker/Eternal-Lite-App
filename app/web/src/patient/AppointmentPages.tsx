import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CalendarPlus, CalendarX2, ClipboardCheck, ClipboardList, Download, MapPin, Phone, Video } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { get, post, withProfile } from '../api';
import { errorCode, errorMessage } from '../errors';
import { useI18n } from '../i18n';
import type { TeleState } from '../mvp-types';
import type { AppointmentView, Questionnaire, ServiceView } from '../types';
import { Badge, Button, Card, Empty, FullText, LinkButton, Modal, Notice, PageHead, QueryError, Skeleton, Spinner, StatusBadge, Tabs, TextArea, useToast } from '../ui';
import { answersFromResponse, QuestionnaireForm, type Answers } from '../shared/QuestionnaireForm';

export function AppointmentsPage() {
  const { t, fmt } = useI18n();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const q = useQuery({ queryKey: ['appointments'], queryFn: () => get<{ items: AppointmentView[] }>('/api/me/appointments') });
  const now = Date.now();
  const items = (q.data?.items ?? []).filter((a) =>
    tab === 'upcoming' ? Date.parse(a.end) > now && ['booked', 'arrived', 'pending'].includes(a.status) : !(Date.parse(a.end) > now && ['booked', 'arrived', 'pending'].includes(a.status)),
  );
  if (tab === 'upcoming') items.sort((a, b) => a.start.localeCompare(b.start));
  return (
    <div className="stack-lg">
      <PageHead title={t('Wizyty')} action={<LinkButton to="/rezerwacja" icon={<CalendarPlus size={18} />}>{t('Umów wizytę')}</LinkButton>} />
      <Tabs
        label={t('Wizyty')}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'upcoming', label: t('Nadchodzące') },
          { value: 'past', label: t('Historia') },
        ]}
      />
      {q.isLoading && <Skeleton />}
      {q.isError && <QueryError error={q.error} retry={() => void q.refetch()} />}
      {q.data && items.length === 0 && (
        <Empty icon={<CalendarClock size={40} />} title={tab === 'upcoming' ? t('Brak zaplanowanych wizyt') : t('Brak wcześniejszych wizyt')}>
          {tab === 'upcoming' && <LinkButton to="/rezerwacja">{t('Umów wizytę')}</LinkButton>}
        </Empty>
      )}
      {items.length > 0 && (
        <div className="card card-flush">
          <ul className="list">
            {items.map((a) => (
              <li key={a.id}>
                <Link to={`/wizyty/${a.id}`} className="list-item">
                  <span className={`list-icon ${a.status === 'cancelled' ? 'warn' : ''}`}>{a.mode === 'tele' ? <Video size={20} /> : <CalendarClock size={20} />}</span>
                  <span className="grow">
                    <span className="list-title" style={{ display: 'block' }}>
                      {fmt.dateLong(a.start)}, {fmt.time(a.start)}
                    </span>
                    <span className="list-sub">
                      {a.serviceName} · {a.practitionerName}
                    </span>
                  </span>
                  <StatusBadge status={a.status} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

interface AppointmentDetail extends AppointmentView {
  questionnaireDone: boolean;
  service?: ServiceView;
  teleWindowOpen: boolean;
  clinic: { phone: string; cancelMinHours: number };
}

export function AppointmentDetailPage() {
  const { id = '' } = useParams();
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const q = useQuery({ queryKey: ['appointment', id], queryFn: () => get<AppointmentDetail>(`/api/me/appointments/${id}`), refetchInterval: 60_000 });
  const cancel = useMutation({
    mutationFn: () => post(`/api/me/appointments/${id}/cancel`, { reason: reason || undefined }),
    onSuccess: () => {
      setCancelOpen(false);
      void qc.invalidateQueries({ queryKey: ['appointments'] });
      void qc.invalidateQueries({ queryKey: ['appointment', id] });
      toast(t('Wizyta została odwołana. Termin wrócił do puli.'));
    },
  });

  if (q.isLoading) return <Skeleton count={3} />;
  if (q.isError) return <QueryError error={q.error} retry={() => void q.refetch()} />;
  const a = q.data!;
  const active = ['booked', 'arrived'].includes(a.status) && Date.parse(a.end) > Date.now();

  return (
    <div className="stack-lg">
      <PageHead title={a.serviceName ?? t('Wizyta')} back={{ to: '/wizyty', label: t('Wizyty') }} action={<StatusBadge status={a.status} />} />
      <Card>
        <dl className="kv">
          <dt>{t('Termin')}</dt>
          <dd>
            {fmt.dateLong(a.start)}, {fmt.time(a.start)}–{fmt.time(a.end)}
          </dd>
          <dt>{t('Lekarz')}</dt>
          <dd>{a.practitionerName}</dd>
          <dt>{t('Forma')}</dt>
          <dd>{a.mode === 'tele' ? <Badge kind="info">{t('Teleporada wideo')}</Badge> : t('Wizyta w placówce')}</dd>
          {a.mode !== 'tele' && a.locationName && (
            <>
              <dt>{t('Miejsce')}</dt>
              <dd>
                <MapPin size={15} aria-hidden style={{ verticalAlign: '-2px' }} /> {a.locationName}
              </dd>
            </>
          )}
          {a.comment && (
            <>
              <dt>{t('Twoja informacja')}</dt>
              <dd>{a.comment}</dd>
            </>
          )}
          {a.status === 'cancelled' && (
            <>
              <dt>{t('Odwołana przez')}</dt>
              <dd>
                {a.cancelledBy === 'patient' ? t('Ciebie') : t('placówkę')}
                {a.cancelReason ? ` — ${a.cancelReason}` : ''}
              </dd>
            </>
          )}
        </dl>
      </Card>

      {a.preparation && active && (
        <Notice kind="info" title={t('Przygotowanie do wizyty')}>
          {a.preparation}
        </Notice>
      )}

      {active && a.mode === 'tele' && (
        <Card title={t('Teleporada')}>
          {a.teleWindowOpen ? (
            <>
              <p>{t('Pokój jest otwarty. Przygotuj słuchawki i sprawdź kamerę.')}</p>
              <LinkButton to={`/wizyty/${a.id}/teleporada`} icon={<Video size={18} />}>
                {t('Dołącz do teleporady')}
              </LinkButton>
            </>
          ) : (
            <p className="muted">{t('Przycisk dołączenia pojawi się 15 minut przed rozpoczęciem wizyty.')}</p>
          )}
        </Card>
      )}

      {active && a.questionnaireId && (
        <Card>
          <div className="row">
            <span className={`list-icon ${a.questionnaireDone ? 'ok' : 'warn'}`}>{a.questionnaireDone ? <ClipboardCheck size={20} /> : <ClipboardList size={20} />}</span>
            <div className="grow">
              <strong>{t('Wywiad przed wizytą')}</strong>
              <p className="small muted" style={{ margin: 0 }}>
                {a.questionnaireDone ? t('Wypełniony — możesz go poprawić do czasu wizyty.') : t('Odpowiedz na kilka pytań, aby lekarz mógł się przygotować.')}
              </p>
            </div>
            <LinkButton to={`/wizyty/${a.id}/wywiad`} variant={a.questionnaireDone ? 'secondary' : 'primary'} size="sm">
              {a.questionnaireDone ? t('Popraw') : t('Wypełnij')}
            </LinkButton>
          </div>
        </Card>
      )}

      {active && (
        <div className="btn-row">
          <a className="btn secondary" href={withProfile(`/api/me/appointments/${a.id}/ics`)} download>
            <Download size={18} /> {t('Dodaj do kalendarza')}
          </a>
          {a.canCancelOnline ? (
            <>
              <Button variant="secondary" icon={<CalendarClock size={18} />} onClick={() => nav(`/rezerwacja?przeloz=${a.id}`)}>
                {t('Zmień termin')}
              </Button>
              <Button variant="danger-outline" icon={<CalendarX2 size={18} />} onClick={() => setCancelOpen(true)}>
                {t('Odwołaj wizytę')}
              </Button>
            </>
          ) : (
            a.status === 'booked' && (
              <Notice kind="warn">
                {t('Odwołanie online było możliwe do {h} godz. przed wizytą.', { h: a.clinic.cancelMinHours })}{' '}
                {a.clinic.phone && (
                  <a href={`tel:${a.clinic.phone.replace(/\s/g, '')}`}>
                    <Phone size={14} aria-hidden /> {a.clinic.phone}
                  </a>
                )}
              </Notice>
            )
          )}
        </div>
      )}
      {active && a.canCancelOnline && (
        <p className="small muted">{t('Odwołanie lub zmiana terminu online możliwe do {d}.', { d: fmt.dateTime(a.cancelDeadline) })}</p>
      )}

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={t('Odwołać wizytę?')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              {t('Nie, zostaw')}
            </Button>
            <Button variant="danger" onClick={() => cancel.mutate()} loading={cancel.isPending}>
              {t('Tak, odwołaj')}
            </Button>
          </>
        }
      >
        <div className="stack">
          <p>
            {a.serviceName}, <span>{fmt.dateLong(a.start)}</span>, {fmt.time(a.start)}.
          </p>
          <p className="muted small">{t('Termin od razu wróci do puli i będzie mógł skorzystać z niego inny pacjent.')}</p>
          <TextArea label={t('Powód (opcjonalnie)')} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          {cancel.isError && <Notice kind="danger">{errorMessage(cancel.error, t)}</Notice>}
        </div>
      </Modal>
    </div>
  );
}

// --- wywiad przed wizytą (M27) -----------------------------------------------------------------------

export function QuestionnairePage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['appointment', id, 'questionnaire'],
    queryFn: () => get<{ questionnaire: Questionnaire; response: Parameters<typeof answersFromResponse>[0] }>(`/api/me/appointments/${id}/questionnaire`),
  });
  const save = useMutation({
    mutationFn: (answers: Answers) => post(`/api/me/appointments/${id}/questionnaire`, { answers }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['appointment'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast(t('Dziękujemy — odpowiedzi trafiły do lekarza.'));
      nav(`/wizyty/${id}`);
    },
  });
  if (q.isLoading) return <Skeleton count={4} />;
  if (q.isError) return <QueryError error={q.error} />;
  return (
    <div className="stack-lg">
      <PageHead title={q.data!.questionnaire.title ?? t('Wywiad przed wizytą')} sub={q.data!.questionnaire.description} back={{ to: `/wizyty/${id}`, label: t('Wizyta') }} />
      <QuestionnaireForm
        questionnaire={q.data!.questionnaire}
        initial={answersFromResponse(q.data!.response)}
        onSubmit={(a) => save.mutate(a)}
        submitting={save.isPending}
        error={save.isError ? <Notice kind="danger">{errorMessage(save.error, t)}</Notice> : undefined}
      />
    </div>
  );
}

// --- teleporada -------------------------------------------------------------------------------------

export function TelePage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  // poczekalnia (D7): adres pokoju dopiero po wpuszczeniu przez lekarza; stan odświeżany co kilka sekund
  const q = useQuery({
    queryKey: ['tele', id],
    queryFn: () => get<TeleState>(`/api/me/appointments/${id}/tele`),
    retry: false,
    refetchInterval: (qq) => (qq.state.data?.join || qq.state.data?.ended ? false : 4000),
  });
  const join = q.data?.join;
  return (
    <div className="stack-lg">
      <PageHead title={t('Teleporada')} back={{ to: `/wizyty/${id}`, label: t('Wizyta') }} />
      {q.isLoading && <Skeleton height={320} count={1} />}
      {q.isError && <Notice kind={errorCode(q.error) === 'tele_window_closed' ? 'info' : 'danger'}>{errorMessage(q.error, t)}</Notice>}
      {q.data && !join && !q.data.ended && (
        <Card>
          <div className="stack center">
            <Spinner label={t('Poczekalnia')} />
            <h2>{t('Jesteś w poczekalni')}</h2>
            <p className="muted">{t('Lekarz wpuści Cię do rozmowy. Nie zamykaj tej strony.')}</p>
          </div>
        </Card>
      )}
      {q.data?.ended && <Notice kind="info">{t('Wizyta wideo została zakończona.')}</Notice>}
      {join && !q.data?.ended && (
        <>
          {join.publicServer && <Notice kind="warn">{t('Instancja testowa: połączenie przez publiczny serwer meet.jit.si. W produkcji placówka używa własnego serwera wideo.')}</Notice>}
          <iframe
            className="tele-frame"
            title={t('Połączenie wideo z lekarzem')}
            src={join.url}
            allow="camera; microphone; display-capture; autoplay; clipboard-write"
            referrerPolicy="no-referrer"
          />
          <p className="small muted"><FullText text="Połączenie nie jest nagrywane. Jeśli obraz się nie pojawia, zezwól przeglądarce na dostęp do kamery i mikrofonu." /></p>
        </>
      )}
    </div>
  );
}
