import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, CalendarPlus, CalendarX2, ClipboardCheck, ClipboardList, Download, MapPin, Phone, Video } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { get, post } from '../api';
import { errorCode, errorMessage } from '../errors';
import { useI18n } from '../i18n';
import type { TeleState } from '../mvp-types';
import type { AppointmentView, Questionnaire, QuestionnaireItem, ServiceView } from '../types';
import { Badge, Button, Card, Empty, FullText, LinkButton, Modal, Notice, PageHead, QueryError, Segmented, Skeleton, Spinner, StatusBadge, Tabs, TextArea, useToast } from '../ui';
import { useSession } from '../session';

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
          <a className="btn secondary" href={`/api/me/appointments/${a.id}/ics`} download>
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

// --- wywiad przed wizytą -----------------------------------------------------------------------------

type Answers = Record<string, string | number | boolean | string[] | null>;

function enabled(item: QuestionnaireItem, answers: Answers): boolean {
  if (!item.enableWhen?.length) return true;
  const res = item.enableWhen.map((c) => {
    const a = answers[c.question];
    const expected = c.answerBoolean ?? c.answerString ?? c.answerCoding?.code;
    if (c.operator === 'exists') return (a !== undefined && a !== null && a !== '') === c.answerBoolean;
    if (c.operator === '=') return Array.isArray(a) ? a.includes(String(expected)) : a === expected;
    if (c.operator === '!=') return a !== expected;
    return true;
  });
  return item.enableBehavior === 'any' ? res.some(Boolean) : res.every(Boolean);
}

function QItem({ item, answers, set }: { item: QuestionnaireItem; answers: Answers; set: (k: string, v: Answers[string]) => void }) {
  const { t } = useI18n();
  if (!enabled(item, answers)) return null;
  const id = `q-${item.linkId}`;
  const label = (
    <label htmlFor={id} style={{ fontWeight: 600 }}>
      {item.text}
      {item.required && <span aria-hidden> *</span>}
    </label>
  );
  const v = answers[item.linkId];
  switch (item.type) {
    case 'display':
      return <p className="small muted">{item.text}</p>;
    case 'group':
      return (
        <fieldset className="stack" style={{ border: 0, padding: 0 }}>
          <legend style={{ fontWeight: 650 }}>{item.text}</legend>
          {item.item?.map((c) => <QItem key={c.linkId} item={c} answers={answers} set={set} />)}
        </fieldset>
      );
    case 'boolean':
      return (
        <fieldset className="field" style={{ border: 0, padding: 0 }}>
          <legend style={{ fontWeight: 600, marginBottom: 6 }}>
            {item.text}
            {item.required && <span aria-hidden> *</span>}
          </legend>
          <div className="segmented">
            <button type="button" aria-pressed={v === true} onClick={() => set(item.linkId, true)}>
              {t('Tak')}
            </button>
            <button type="button" aria-pressed={v === false} onClick={() => set(item.linkId, false)}>
              {t('Nie')}
            </button>
          </div>
        </fieldset>
      );
    case 'choice':
      return (
        <fieldset className="field" style={{ border: 0, padding: 0 }}>
          <legend style={{ fontWeight: 600, marginBottom: 6 }}>
            {item.text}
            {item.required && <span aria-hidden> *</span>}
          </legend>
          <div className="stack" style={{ gap: 6 }}>
            {item.answerOption?.map((o) => {
              const code = o.valueCoding?.code ?? o.valueString ?? '';
              if (item.repeats) {
                // wielokrotny wybór — zaznacz wszystkie pasujące
                const list = Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : [];
                return (
                  <label key={code} className="check">
                    <input type="checkbox" checked={list.includes(code)} onChange={(e) => set(item.linkId, e.target.checked ? [...list, code] : list.filter((x) => x !== code))} />
                    <span>{o.valueCoding?.display ?? o.valueString}</span>
                  </label>
                );
              }
              return (
                <label key={code} className="check">
                  <input type="radio" name={id} checked={v === code} onChange={() => set(item.linkId, code)} />
                  <span>{o.valueCoding?.display ?? o.valueString}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      );
    case 'text':
      return (
        <div className="field">
          {label}
          <textarea id={id} className="textarea" maxLength={2000} value={(v as string) ?? ''} onChange={(e) => set(item.linkId, e.target.value)} required={item.required} />
        </div>
      );
    case 'integer':
    case 'decimal':
      return (
        <div className="field">
          {label}
          <input id={id} className="input" type="number" step={item.type === 'integer' ? 1 : 'any'} value={(v as number) ?? ''} onChange={(e) => set(item.linkId, e.target.value === '' ? null : Number(e.target.value))} />
        </div>
      );
    case 'date':
      return (
        <div className="field">
          {label}
          <input id={id} className="input" type="date" value={(v as string) ?? ''} onChange={(e) => set(item.linkId, e.target.value)} />
        </div>
      );
    default:
      return (
        <div className="field">
          {label}
          <input id={id} className="input" maxLength={300} value={(v as string) ?? ''} onChange={(e) => set(item.linkId, e.target.value)} required={item.required} />
        </div>
      );
  }
}

function answersFromResponse(resp: { item?: { linkId: string; answer?: Record<string, unknown>[]; item?: unknown[] }[] } | null): Answers {
  const out: Answers = {};
  const walk = (items: { linkId: string; answer?: Record<string, unknown>[]; item?: unknown[] }[] = []) => {
    for (const i of items) {
      const a = i.answer?.[0];
      if (i.answer && i.answer.length > 1) {
        // wielokrotny wybór
        out[i.linkId] = i.answer.map((x) => String((x.valueCoding as { code?: string } | undefined)?.code ?? x.valueString ?? ''));
      } else if (a) {
        const coding = a.valueCoding as { code?: string } | undefined;
        const v = a.valueBoolean ?? a.valueString ?? coding?.code ?? a.valueInteger ?? a.valueDecimal ?? a.valueDate;
        out[i.linkId] = v === undefined ? null : (v as Answers[string]);
      }
      walk(i.item as typeof items);
    }
  };
  walk(resp?.item);
  return out;
}

export function QuestionnairePage() {
  const { id = '' } = useParams();
  const { t } = useI18n();
  const { a11y } = useSession();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const [answers, setAnswers] = useState<Answers | null>(null);
  // M27 — wywiad w formie rozmowy: jedno pytanie na ekranie, podsumowanie przed wysłaniem.
  // Domyślnie przy prostym języku albo dużym tekście; zawsze do przełączenia.
  const [mode, setMode] = useState<'all' | 'step'>(a11y.simpleLanguage || a11y.textScale >= 150 ? 'step' : 'all');
  const [step, setStep] = useState(0);
  const [missing, setMissing] = useState(false);
  const stepRef = useRef<HTMLDivElement>(null);
  const q = useQuery({
    queryKey: ['appointment', id, 'questionnaire'],
    queryFn: () => get<{ questionnaire: Questionnaire; response: Parameters<typeof answersFromResponse>[0] }>(`/api/me/appointments/${id}/questionnaire`),
  });
  const save = useMutation({
    mutationFn: () => post(`/api/me/appointments/${id}/questionnaire`, { answers: answers ?? {} }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['appointment'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast(t('Dziękujemy — odpowiedzi trafiły do lekarza.'));
      nav(`/wizyty/${id}`);
    },
  });
  useEffect(() => {
    if (mode === 'step') stepRef.current?.focus();
  }, [step, mode]);
  if (q.isLoading) return <Skeleton count={4} />;
  if (q.isError) return <QueryError error={q.error} />;
  const current = answers ?? answersFromResponse(q.data!.response);
  const set = (k: string, v: Answers[string]) => {
    setMissing(false);
    setAnswers({ ...current, [k]: v });
  };
  const items = q.data!.questionnaire.item ?? [];
  const steps = items.filter((i) => i.type !== 'display' && enabled(i, current));
  const notes = items.filter((i) => i.type === 'display');
  const reviewing = step >= steps.length;
  const isEmpty = (v: Answers[string] | undefined) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  const next = () => {
    const item = steps[step];
    if (item?.required && isEmpty(current[item.linkId])) return setMissing(true);
    setMissing(false);
    setStep(step + 1);
  };
  const submit = () => {
    if (!answers) setAnswers(current);
    save.mutate();
  };
  return (
    <div className="stack-lg">
      <PageHead title={q.data!.questionnaire.title ?? t('Wywiad przed wizytą')} sub={q.data!.questionnaire.description} back={{ to: `/wizyty/${id}`, label: t('Wizyta') }} />
      <Segmented
        label={t('Sposób wypełniania')}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setStep(0);
        }}
        options={[
          { value: 'step', label: t('Po jednym pytaniu') },
          { value: 'all', label: t('Wszystkie pytania') },
        ]}
      />
      {mode === 'all' ? (
        <form
          className="card stack-lg"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {items.map((item) => <QItem key={item.linkId} item={item} answers={current} set={set} />)}
          {save.isError && <Notice kind="danger">{errorMessage(save.error, t)}</Notice>}
          <Button type="submit" loading={save.isPending}>
            {t('Wyślij odpowiedzi')}
          </Button>
        </form>
      ) : (
        <div className="card stack-lg">
          <div>
            <p className="small muted" style={{ margin: '0 0 6px' }}>
              {reviewing ? t('Sprawdź odpowiedzi przed wysłaniem') : t('Pytanie {n} z {m}', { n: step + 1, m: steps.length })}
            </p>
            <div className="step-progress" role="progressbar" aria-label={t('Postęp wywiadu')} aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={Math.min(step, steps.length)}>
              <span style={{ width: `${steps.length ? Math.round((Math.min(step, steps.length) / steps.length) * 100) : 100}%` }} />
            </div>
          </div>
          <div ref={stepRef} tabIndex={-1} className="stack" style={{ outline: 'none' }}>
            {!reviewing && steps[step] && <QItem item={steps[step]} answers={current} set={set} />}
            {!reviewing && missing && <Notice kind="warn">{t('To pytanie jest wymagane — odpowiedz, żeby przejść dalej.')}</Notice>}
            {reviewing && (
              <dl className="answers-review">
                {steps.map((item, i) => (
                  <div key={item.linkId}>
                    <dt>{item.text}</dt>
                    <dd>
                      {answerText(item, current, t) || <span className="muted">{t('bez odpowiedzi')}</span>}{' '}
                      <button type="button" className="link-btn" onClick={() => setStep(i)} aria-label={t('Zmień odpowiedź: {q}', { q: item.text ?? '' })}>
                        {t('Zmień')}
                      </button>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {reviewing && notes.map((n) => <p key={n.linkId} className="small muted" style={{ margin: 0 }}>{n.text}</p>)}
          </div>
          {save.isError && <Notice kind="danger">{errorMessage(save.error, t)}</Notice>}
          <div className="btn-row">
            {step > 0 && (
              <Button variant="secondary" onClick={() => setStep(step - 1)}>
                {t('Wstecz')}
              </Button>
            )}
            {reviewing ? (
              <Button onClick={submit} loading={save.isPending}>
                {t('Wyślij odpowiedzi')}
              </Button>
            ) : (
              <Button onClick={next}>{step === steps.length - 1 ? t('Podsumowanie') : t('Dalej')}</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Odpowiedź w czytelnej postaci (podsumowanie przed wysłaniem). */
function answerText(item: QuestionnaireItem, answers: Answers, t: (s: string) => string): string {
  if (item.type === 'group') return (item.item ?? []).filter((c) => enabled(c, answers)).map((c) => answerText(c, answers, t)).filter(Boolean).join('; ');
  const v = answers[item.linkId];
  if (v === undefined || v === null || v === '') return '';
  if (typeof v === 'boolean') return v ? t('Tak') : t('Nie');
  const label = (code: string) => item.answerOption?.find((o) => (o.valueCoding?.code ?? o.valueString) === code)?.valueCoding?.display ?? code;
  if (Array.isArray(v)) return v.map(label).join(', ');
  return item.type === 'choice' ? label(String(v)) : String(v);
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
