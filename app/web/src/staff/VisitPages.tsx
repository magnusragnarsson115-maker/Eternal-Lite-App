import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BellRing, CheckCircle2, CircleDashed, Clock, Download, FileText, Inbox, Link2, Mic, QrCode, RefreshCw, Send, Stethoscope, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { get, post, qs } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import type { FactRow, FactsReport, GrantView, IntakeView, InviteView, VisitPrep } from '../mvp-types';
import { IntakeReview, IntakeStatusBadge, KIND_PL, type FieldAction } from '../shared/IntakeReview';
import { useSession, hasRole } from '../session';
import { Badge, Button, Card, Empty, Modal, Notice, PageHead, QueryError, Skeleton, StatusBadge, Tabs, TextField, useConfirm, useToast } from '../ui';
import { TrendChart } from '../ui/TrendChart';
import { ScribePanel } from './ScribePanel';

function todayLocal(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw' }).format(new Date());
}

export function CompletenessBar({ prep }: { prep: Pick<VisitPrep, 'completeness' | 'status'> }) {
  const { t } = useI18n();
  const color = prep.status === 'ready' ? 'var(--success)' : prep.status === 'to_confirm' ? 'var(--warning)' : 'var(--danger)';
  return (
    <div style={{ minWidth: 120 }} aria-label={t('Kompletność {n}%', { n: prep.completeness })}>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--surface-3)', overflow: 'hidden' }}>
        <div style={{ width: `${prep.completeness}%`, height: '100%', background: color }} />
      </div>
      <span className="small muted tabular">{prep.completeness}%</span>
    </div>
  );
}

const REQ_ICON = {
  missing: <XCircle size={16} color="var(--danger)" aria-hidden />,
  to_confirm: <CircleDashed size={16} color="var(--warning)" aria-hidden />,
  ready: <CheckCircle2 size={16} color="var(--success)" aria-hidden />,
};

function SharingBadge({ prep }: { prep: VisitPrep }) {
  const { t } = useI18n();
  switch (prep.sharing) {
    case 'shared':
      return <Badge kind="ok">{t('udostępnione')}</Badge>;
    case 'invited':
      return <Badge kind="info">{prep.invite?.firstOpenedAt ? t('link otwarty') : t('zaproszenie wysłane')}</Badge>;
    case 'withdrawn':
      return <Badge kind="danger">{t('zgoda wycofana / wygasła')}</Badge>;
    default:
      return <Badge>{t('bez zaproszenia')}</Badge>;
  }
}

/** Zaproszenie: SMS z linkiem albo kod QR do pokazania w rejestracji (D1). */
export function InviteButton({ appointmentId, size }: { appointmentId: string; size?: 'sm' }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [res, setRes] = useState<{ url: string; qr: string; smsQueued: boolean } | null>(null);
  const create = useMutation({
    mutationFn: (send: boolean) => post<{ url: string; qr: string; smsQueued: boolean; invite: InviteView }>(`/api/staff/appointments/${appointmentId}/invite`, { phone: phone || undefined, send }),
    onSuccess: (r) => {
      setRes(r);
      void qc.invalidateQueries({ queryKey: ['inbox'] });
      void qc.invalidateQueries({ queryKey: ['prep'] });
    },
  });
  return (
    <>
      <Button size={size} variant="secondary" icon={<Send size={16} />} onClick={() => (setRes(null), setOpen(true))}>
        {t('Zaproś')}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('Zaproszenie do przesłania dokumentów')}>
        {res ? (
          <div className="stack center">
            {res.smsQueued && <Notice kind="ok">{t('SMS z linkiem został wysłany.')}</Notice>}
            <div dangerouslySetInnerHTML={{ __html: res.qr }} aria-label={t('Kod QR z linkiem')} style={{ background: '#fff', padding: 8, borderRadius: 8 }} />
            <p className="small muted">{t('Pacjent może zeskanować kod telefonem w rejestracji. Link działa do wizyty + okres udostępnienia z ustawień kliniki.')}</p>
            <Button
              variant="secondary"
              icon={<Link2 size={16} />}
              onClick={() => {
                void navigator.clipboard?.writeText(res.url);
              }}
            >
              {t('Kopiuj link')}
            </Button>
          </div>
        ) : (
          <div className="stack">
            <TextField label={t('Telefon pacjenta (opcjonalnie — domyślnie z kartoteki)')} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {create.isError && <Notice kind="danger">{errorMessage(create.error, t)}</Notice>}
            <div className="btn-row">
              <Button icon={<Send size={16} />} loading={create.isPending} onClick={() => create.mutate(true)}>
                {t('Wyślij SMS z linkiem')}
              </Button>
              <Button variant="secondary" icon={<QrCode size={16} />} loading={create.isPending} onClick={() => create.mutate(false)}>
                {t('Pokaż kod QR')}
              </Button>
            </div>
            <p className="small muted">{t('Treść SMS nie zawiera danych o zdrowiu — tylko nazwę placówki, termin i link.')}</p>
          </div>
        )}
      </Modal>
    </>
  );
}

/** D2 — skrzynka materiałów: lista wizyt dnia z paskiem kompletności, filtr „brakuje”, przypomnienie. */
export function InboxPage() {
  const { t, fmt } = useI18n();
  const { me } = useSession();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const date = params.get('data') ?? todayLocal();
  const filter = (params.get('filtr') as 'all' | 'missing') ?? 'all';
  const mine = hasRole(me, 'practitioner');
  const q = useQuery({ queryKey: ['inbox', date, filter], queryFn: () => get<{ date: string; items: VisitPrep[] }>(`/api/staff/inbox${qs({ date, filter, mine })}`), refetchInterval: 60_000 });
  const remind = useMutation({ mutationFn: (id: string) => post(`/api/staff/appointments/${id}/remind-docs`), onSuccess: () => toast(t('Przypomnienie SMS wysłane.')), onError: (e) => toast(errorMessage(e, t), 'error') });
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    n.set(k, v);
    setParams(n, { replace: true });
  };
  return (
    <div className="stack-lg">
      <PageHead title={t('Skrzynka materiałów')} sub={t('Wizyty dnia według godziny i braków — bez oceny klinicznej.')} />
      <div className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
        <TextField label={t('Dzień')} type="date" value={date} onChange={(e) => set('data', e.target.value)} />
        <Tabs label={t('Filtr')} value={filter} onChange={(v) => set('filtr', v)} tabs={[{ value: 'all', label: t('Wszystkie') }, { value: 'missing', label: t('Brakuje') }]} />
      </div>
      {q.isLoading ? (
        <Skeleton count={4} />
      ) : q.isError ? (
        <QueryError error={q.error} retry={() => void q.refetch()} />
      ) : !q.data!.items.length ? (
        <Empty icon={<Inbox size={28} />} title={filter === 'missing' ? t('Brak wizyt z brakami') : t('Brak wizyt tego dnia')} />
      ) : (
        <div className="card card-flush">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Godzina')}</th>
                  <th>{t('Pacjent')}</th>
                  <th>{t('Materiały')}</th>
                  <th>{t('Kompletność')}</th>
                  <th>{t('Akcje')}</th>
                </tr>
              </thead>
              <tbody>
                {q.data!.items.map((p) => (
                  <tr key={p.appointment.id}>
                    <td className="tabular nowrap">
                      <strong>{fmt.time(p.appointment.start)}</strong>
                      <div className="small muted">{p.appointment.practitionerName}</div>
                    </td>
                    <td>
                      <Link to={`/panel/wizyta/${p.appointment.id}`}>{p.appointment.patientName}</Link>
                      <div className="small">
                        <StatusBadge status={p.appointment.status} /> <SharingBadge prep={p} />
                      </div>
                    </td>
                    <td>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="small">
                        {p.requirements.map((r) => (
                          <li key={r.id} className="row" style={{ gap: 6 }}>
                            {REQ_ICON[r.status]} {r.label}
                            {r.optional && <span className="muted">({t('opcjonalnie')})</span>}
                          </li>
                        ))}
                      </ul>
                      {p.counts.toConfirm > 0 && <span className="small" style={{ color: 'var(--warning)' }}>{t('odczyt do potwierdzenia: {n}', { n: p.counts.toConfirm })}</span>}
                    </td>
                    <td>
                      <CompletenessBar prep={p} />
                    </td>
                    <td>
                      <div className="btn-row">
                        {/* przycisk zaproszenia zostaje po wysłaniu — okno z kodem QR nie znika, gdy wiersz zmieni stan */}
                        {p.sharing !== 'shared' && <InviteButton appointmentId={p.appointment.id} size="sm" />}
                        {(p.sharing === 'invited' || p.sharing === 'shared') && p.status !== 'ready' && (
                          <Button size="sm" variant="secondary" icon={<BellRing size={16} />} loading={remind.isPending && remind.variables === p.appointment.id} onClick={() => remind.mutate(p.appointment.id)}>
                            {t('Przypomnij')}
                          </Button>
                        )}
                        <Link className="btn sm" to={`/panel/wizyta/${p.appointment.id}`}>
                          <Stethoscope size={16} /> {t('Otwórz')}
                        </Link>
                      </div>
                      {p.lastReminderAt && <div className="small muted">{t('przypomnienie: {d}', { d: fmt.dateTime(p.lastReminderAt) })}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

type VisitTab = 'materialy' | 'raport' | 'scribe';

/** Przestrzeń wizyty: materiały (D1/D2), raport faktów (D3), Scribe i karta „Po wizycie” (D5). */
export function VisitPage() {
  const { id = '' } = useParams();
  const { t, fmt } = useI18n();
  const { me } = useSession();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as VisitTab) ?? 'materialy';
  const clinician = hasRole(me, 'practitioner');
  const q = useQuery({ queryKey: ['prep', id], queryFn: () => get<{ prep: VisitPrep; intake: IntakeView[]; invites: InviteView[] }>(`/api/staff/appointments/${id}/prep`) });
  if (q.isLoading) return <Skeleton count={3} />;
  if (q.isError) return <QueryError error={q.error} retry={() => void q.refetch()} />;
  const { prep } = q.data!;
  const a = prep.appointment;
  return (
    <div className="stack-lg">
      <PageHead
        back={{ to: '/panel/skrzynka', label: t('Skrzynka materiałów') }}
        title={a.patientName ?? ''}
        sub={
          <span>
            {fmt.dateTime(a.start)} · {a.serviceName} · {a.practitionerName}
          </span>
        }
        action={<CompletenessBar prep={prep} />}
      />
      <Tabs
        label={t('Sekcje wizyty')}
        value={tab}
        onChange={(v) => setParams({ tab: v }, { replace: true })}
        tabs={[
          { value: 'materialy', label: t('Materiały') },
          ...(clinician ? [{ value: 'raport' as VisitTab, label: t('Raport faktów') }, { value: 'scribe' as VisitTab, label: t('Scribe i karta') }] : []),
        ]}
      />
      {tab === 'materialy' && <MaterialsTab data={q.data!} clinician={clinician} />}
      {tab === 'raport' && clinician && <FactsReportView patientId={a.patientId ?? ''} appointmentId={a.id} />}
      {tab === 'scribe' && clinician && <ScribePanel patientId={a.patientId ?? ''} appointmentId={a.id} />}
    </div>
  );
}

function MaterialsTab({ data, clinician }: { data: { prep: VisitPrep; intake: IntakeView[]; invites: InviteView[] }; clinician: boolean }) {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const { prep } = data;
  const item = useQuery({ queryKey: ['staff-intake', open], queryFn: () => get<IntakeView>(`/api/staff/intake/${open}`), enabled: !!open });
  const confirm = useMutation({
    mutationFn: (v: { items?: FieldAction[]; submit: boolean }) => post<IntakeView>(`/api/staff/intake/${open}/confirm`, v),
    onSuccess: (v) => {
      qc.setQueryData(['staff-intake', open], v);
      void qc.invalidateQueries({ queryKey: ['prep'] });
    },
  });
  const remind = useMutation({ mutationFn: () => post(`/api/staff/appointments/${prep.appointment.id}/remind-docs`) });
  return (
    <div className="stack-lg">
      <Card title={t('Wymagane dokumenty')} action={<SharingBadge prep={prep} />}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="stack">
          {prep.requirements.map((r) => (
            <li key={r.id} className="row" style={{ gap: 8 }}>
              {REQ_ICON[r.status]}
              <span className="grow">
                {r.label} {r.optional && <span className="muted small">({t('opcjonalnie')})</span>}
              </span>
              <span className="small muted">
                {r.status === 'missing' ? t('brak') : r.status === 'to_confirm' ? t('do potwierdzenia') : t('gotowe')}
                {r.clinicRecords > 0 && ` · ${t('wyniki w placówce: {n}', { n: r.clinicRecords })}`}
              </span>
            </li>
          ))}
        </ul>
        <div className="btn-row" style={{ marginTop: 12 }}>
          {(prep.sharing === 'none' || prep.sharing === 'withdrawn') && <InviteButton appointmentId={prep.appointment.id} />}
          {prep.sharing !== 'none' && prep.status !== 'ready' && (
            <Button variant="secondary" icon={<BellRing size={16} />} loading={remind.isPending} onClick={() => remind.mutate()}>
              {t('Przypomnij pacjentowi (SMS)')}
            </Button>
          )}
        </div>
        {remind.isSuccess && <Notice kind="ok">{t('Przypomnienie SMS wysłane.')}</Notice>}
        {remind.isError && <Notice kind="danger">{errorMessage(remind.error, t)}</Notice>}
        {prep.grant && (
          <p className="small muted" style={{ marginTop: 8 }}>
            {prep.grant.status === 'active' ? t('Udostępnienie aktywne do {d}.', { d: fmt.dateTime(prep.grant.expiresAt) }) : t('Udostępnienie nieaktywne — dostęp do materiałów pacjenta wygasł.')}
          </p>
        )}
      </Card>
      <Card title={t('Przesłane przez pacjenta')} className="card-flush">
        {!clinician ? (
          <div style={{ padding: 16 }}>
            <Notice kind="info">{t('Treść materiałów widzi lekarz. Rejestracja widzi tylko stan kompletności.')}</Notice>
          </div>
        ) : data.intake.length === 0 ? (
          <Empty icon={<FileText size={26} />} title={prep.sharing === 'shared' ? t('Pacjent nie przesłał jeszcze dokumentów') : t('Brak aktywnego udostępnienia')} />
        ) : (
          <ul className="list">
            {data.intake.map((i) => (
              <li key={i.id}>
                <button type="button" className="list-item" style={{ width: '100%', textAlign: 'left', background: 'none', border: 0 }} onClick={() => setOpen(i.id)}>
                  <span className="grow">
                    <span className="list-title" style={{ display: 'block' }}>
                      {t(KIND_PL[i.kind] ?? 'Dokument')}
                      {i.laboratory && <span className="muted"> · {i.laboratory}</span>}
                    </span>
                    <span className="list-sub">
                      {i.filename} · {t('przesłano {d}', { d: fmt.dateTime(i.createdAt) })}
                      {i.counts.items > 0 && ` · ${t('pozycji: {n}', { n: i.counts.items })}`}
                    </span>
                  </span>
                  <IntakeStatusBadge item={i} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Modal open={!!open} onClose={() => setOpen(null)} title={t('Materiał od pacjenta')} wide>
        {!item.data ? (
          <Skeleton count={2} />
        ) : (
          <IntakeReview
            item={item.data}
            fileUrl={`/api/staff/intake/${item.data.id}/file`}
            editable={['needs_review', 'submitted', 'unreadable'].includes(item.data.status)}
            busy={confirm.isPending}
            submitLabel={t('Potwierdź i zapisz w rekordzie')}
            onReview={(items) => confirm.mutate({ items, submit: false })}
            onSubmit={() => confirm.mutate({ submit: true })}
          />
        )}
        {confirm.isError && <Notice kind="danger">{errorMessage(confirm.error, t)}</Notice>}
      </Modal>
    </div>
  );
}

function trustLabel(code: string, t: (s: string) => string): string {
  const map: Record<string, string> = {
    'patient-confirmed': 'potwierdził pacjent',
    'clinician-confirmed': 'potwierdził personel',
    'machine-unconfirmed': 'odczyt maszynowy, niepotwierdzony',
    manual: 'wpis ręczny',
    clinic: 'placówka',
  };
  return t(map[code] ?? code);
}

function FactTable({ rows, unconfirmed, fileBase }: { rows: FactRow[]; unconfirmed?: boolean; fileBase: string }) {
  const { t, fmt } = useI18n();
  let group = '';
  return (
    <div className="stack">
      {rows.map((r) => {
        const head = r.group !== group ? ((group = r.group), <h3 key={`g-${r.key}`} style={{ margin: '12px 0 0' }}>{t(r.group)}</h3>) : null;
        const numeric = r.points.filter((p) => p.valueNum !== undefined).slice().reverse();
        return (
          <div key={r.key}>
            {head}
            <div className="card" style={{ padding: 12 }}>
              <div className="row-between">
                <strong>
                  {r.name} {r.loinc && <span className="small muted">LOINC {r.loinc}</span>}
                </strong>
                {unconfirmed && <Badge kind="warn">{t('odczyt maszynowy, niepotwierdzony')}</Badge>}
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('Data')}</th>
                      <th>{t('Wynik')}</th>
                      <th>{t('Zakres z dokumentu')}</th>
                      <th>{t('Oznaczenie lab.')}</th>
                      <th>{t('Źródło')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.points.map((p, i) => (
                      <tr key={i}>
                        <td className="nowrap">{fmt.date(p.date)}</td>
                        <td className="tabular nowrap">
                          <strong>{p.value}</strong> {p.unit}
                        </td>
                        <td>{p.range ?? '—'}</td>
                        <td>{p.labFlag ?? ''}</td>
                        <td className="small">
                          {p.source.binaryId ? (
                            <a href={p.source.kind === 'intake' ? `/api/staff/intake/${p.source.intakeId}/file` : `${fileBase}/${p.source.binaryId}`} target="_blank" rel="noreferrer" title={p.source.text}>
                              {p.source.label}
                              {p.source.line ? ` · ${t('w. {n}', { n: p.source.line })}` : ''}
                            </a>
                          ) : (
                            p.source.label
                          )}
                          <div className="muted">{trustLabel(p.trust, t)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {r.chart && !unconfirmed && numeric.length >= 2 && (
                <TrendChart dates={numeric.map((p) => p.date)} series={[{ key: r.key, label: r.name, color: 'var(--chart-line)', values: numeric.map((p) => p.valueNum) }]} unit={numeric[0].unit ?? ''} height={160} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** D3 — raport faktów: braki na górze, potwierdzone wyniki ze źródłami, odczyty niepotwierdzone osobno, PDF. */
export function FactsReportView({ patientId, appointmentId }: { patientId: string; appointmentId?: string }) {
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['facts', patientId, appointmentId], queryFn: () => get<FactsReport>(`/api/staff/patients/${patientId}/facts${qs({ appointmentId })}`) });
  if (q.isLoading) return <Skeleton count={4} />;
  if (q.isError) return <QueryError error={q.error} retry={() => void q.refetch()} />;
  const r = q.data!;
  return (
    <div className="stack-lg">
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <p className="small muted" style={{ margin: 0 }}>
          {t('Fakty i źródła. Zakres referencyjny i oznaczenia wyłącznie z dokumentów laboratoriów. Raport niczego nie ocenia.')}
          <br />
          {t('Układ: {l} · szablon {v} · {d}', { l: r.layout, v: r.templateVersion, d: fmt.dateTime(r.generatedAt) })}
        </p>
        <div className="btn-row">
          <Button variant="secondary" size="sm" icon={<RefreshCw size={16} />} onClick={() => void q.refetch()}>
            {t('Odśwież')}
          </Button>
          <a className="btn sm" href={`/api/staff/patients/${patientId}/facts.pdf${qs({ appointmentId })}`}>
            <Download size={16} /> {t('PDF do systemu kliniki')}
          </a>
        </div>
      </div>
      {r.missing.length > 0 && (
        <Notice kind="warn" title={t('Braki przed wizytą')}>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {r.missing.map((m, i) => (
              <li key={i}>
                {m.label} — {m.status === 'missing' ? t('brak') : t('do potwierdzenia')}
              </li>
            ))}
          </ul>
        </Notice>
      )}
      {!r.sharing.vaultIncluded && <Notice kind="info">{t('Brak aktywnego udostępnienia — raport zawiera tylko dane wprowadzone przez placówkę.')}</Notice>}
      <Card title={t('Wyniki potwierdzone')}>{r.results.length ? <FactTable rows={r.results} fileBase="/api/staff/files" /> : <Empty title={t('Brak potwierdzonych wyników')} />}</Card>
      {r.unconfirmed.length > 0 && (
        <Card title={t('Odczyty niepotwierdzone')}>
          <p className="small muted">{t('Odczyt maszynowy, którego nikt nie potwierdził — nie jest faktem. Sprawdź w oryginale.')}</p>
          <FactTable rows={r.unconfirmed} unconfirmed fileBase="/api/staff/files" />
        </Card>
      )}
      {r.documents.length > 0 && (
        <Card title={t('Dokumenty')}>
          <div className="stack">
            {r.documents.map((d) => (
              <details key={d.ref} className="card" style={{ padding: 12 }}>
                <summary className="row-between" style={{ cursor: 'pointer' }}>
                  <span>
                    <strong>{d.title}</strong> <span className="muted small">{fmt.date(d.date)} · {d.source === 'patient' ? t('od pacjenta') : t('placówka')}</span>
                  </span>
                  {d.binaryId && (
                    <a className="btn ghost sm" href={`/api/staff/files/${d.binaryId}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                      <FileText size={14} /> {t('Oryginał')}
                    </a>
                  )}
                </summary>
                {d.accessCode && <p className="small">{t('Kod dostępu z dokumentu')}: <strong className="mono">{d.accessCode}</strong></p>}
                {d.sections.map((s, i) => (
                  <div key={i} className="small" style={{ marginTop: 6 }}>
                    <strong>{s.title}:</strong> <span style={{ whiteSpace: 'pre-wrap' }}>{s.text}</span>
                  </div>
                ))}
              </details>
            ))}
          </div>
        </Card>
      )}
      {(r.surveys ?? []).length > 0 && (
        <Card title={t('Ankiety zdrowotne pacjenta')}>
          <p className="small muted">{t('Odpowiedzi pacjenta, przepisane bez zmian i bez oceny.')}</p>
          <div className="stack">
            {r.surveys!.map((sv) => (
              <details key={sv.ref} className="card" style={{ padding: 12 }}>
                <summary style={{ cursor: 'pointer' }}>
                  <strong>{t(sv.title)}</strong> <span className="muted small">{fmt.date(sv.authored)}</span>
                </summary>
                <dl className="answers-review" style={{ marginTop: 8 }}>
                  {sv.answers.map((a, i) => (
                    <div key={i}>
                      <dt>{a.question}</dt>
                      <dd>{a.answer}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/** D1 — pacjenci, którzy udostępnili dane klinice, z datą wygaśnięcia. */
export function SharedPatientsPage() {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const q = useQuery({ queryKey: ['shared-patients'], queryFn: () => get<{ items: { grant: GrantView; patientId: string; patientName: string; birthDate?: string }[] }>('/api/staff/shared-patients') });
  const end = useMutation({ mutationFn: (id: string) => post(`/api/staff/grants/${id}/end`), onSuccess: () => void qc.invalidateQueries({ queryKey: ['shared-patients'] }) });
  const nav = useNavigate();
  return (
    <div className="stack-lg">
      {dialog}
      <PageHead title={t('Udostępnienia od pacjentów')} sub={t('Kto udostępnił dane klinice, w jakim zakresie i do kiedy. Każdy odczyt trafia do dziennika pacjenta.')} />
      {q.isLoading ? (
        <Skeleton />
      ) : q.isError ? (
        <QueryError error={q.error} />
      ) : !q.data!.items.length ? (
        <Empty title={t('Brak udostępnień')} />
      ) : (
        <div className="card card-flush">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Pacjent')}</th>
                  <th>{t('Zakres')}</th>
                  <th>{t('Źródło')}</th>
                  <th>{t('Wygasa')}</th>
                  <th>{t('Stan')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {q.data!.items.map(({ grant: g, patientId, patientName }) => (
                  <tr key={g.id}>
                    <td>{patientName}</td>
                    <td>{t(SCOPE_PL[g.scope.kind])}</td>
                    <td>{g.source === 'invite' ? t('link z zaproszenia') : t('aplikacja pacjenta')}</td>
                    <td className="nowrap">
                      <Clock size={14} aria-hidden /> {fmt.dateTime(g.expiresAt)}
                    </td>
                    <td>{g.status === 'active' ? <Badge kind="ok">{t('aktywne')}</Badge> : g.status === 'revoked' ? <Badge kind="danger">{t('wycofane')}</Badge> : <Badge>{t('wygasło')}</Badge>}</td>
                    <td>
                      <div className="btn-row">
                        {g.status === 'active' && (
                          <>
                            <Button size="sm" variant="secondary" onClick={() => nav(`/panel/raport/${patientId}`)}>
                              {t('Raport faktów')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={async () => {
                                if (await confirm({ title: t('Zakończyć udostępnienie?'), body: t('Klinika straci dostęp do materiałów pacjenta. Przedłużyć udostępnienie może tylko pacjent.'), confirmLabel: t('Zakończ'), danger: true })) end.mutate(g.id);
                              }}
                            >
                              {t('Zakończ')}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export const SCOPE_PL: Record<string, string> = {
  all: 'wszystkie dokumenty i wyniki',
  results: 'wyniki badań',
  documents: 'dokumenty',
  selected: 'wybrane dokumenty',
};

export function FactsPage() {
  const { patientId = '' } = useParams();
  const { t } = useI18n();
  return (
    <div className="stack-lg">
      <PageHead back={{ to: '/panel/udostepnienia', label: t('Udostępnienia od pacjentów') }} title={t('Raport faktów')} />
      <FactsReportView patientId={patientId} />
    </div>
  );
}

export function ScribeIcon() {
  return <Mic size={19} />;
}

export function WarnIcon() {
  return <AlertTriangle size={16} />;
}
