import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Camera, FileText, FileUp, HeartPulse, History, LifeBuoy, Phone, Plus, Share2, ShieldCheck, Siren, Trash2, X } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { del, get, post, put, withProfile } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { AccessLogList, CardContent } from '../shared/LinkShared';
import { uploadFile } from '../lib/upload';
import type { AccessEntry, CardView, GrantView, IntakeView, PublicTexts } from '../mvp-types';
import { TestExplanation } from '../shared/Explanations';
import { IntakeReview, IntakeStatusBadge, KIND_PL, type FieldAction } from '../shared/IntakeReview';
import { ReportIncidentCard } from '../shared/AccountCards';
import { useSession } from '../session';
import { Badge, Button, Card, Checkbox, Empty, FullText, Modal, Notice, PageHead, QueryError, SelectField, Skeleton, Switch, TextArea, TextField, useConfirm, useToast } from '../ui';
import { TrendChart } from '../ui/TrendChart';

// --- P3: dokumenty i odczyt w aplikacji -------------------------------------------------------------

interface DocItem {
  id: string;
  ref: string;
  kind: string;
  kindLabel: string;
  title: string;
  date?: string;
  binaryId?: string;
  contentType?: string;
}

export function DocumentsPage() {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [kind, setKind] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const cam = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const docs = useQuery({ queryKey: ['my-docs'], queryFn: () => get<{ items: DocItem[] }>('/api/me/documents') });
  const intake = useQuery({ queryKey: ['my-intake'], queryFn: () => get<{ items: IntakeView[] }>('/api/me/intake'), refetchInterval: (q) => (q.state.data?.items.some((i) => i.status === 'processing') ? 2000 : false) });
  const item = useQuery({ queryKey: ['my-intake-item', open], queryFn: () => get<IntakeView>(`/api/me/intake/${open}`), enabled: !!open, refetchInterval: (q) => (q.state.data?.status === 'processing' ? 1500 : false) });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['my-intake'] });
    void qc.invalidateQueries({ queryKey: ['my-docs'] });
    void qc.invalidateQueries({ queryKey: ['timeline'] });
  };
  const upload = useMutation({ mutationFn: (f: File) => uploadFile<IntakeView>('/api/me/intake', f, f.name, kind ? { kind } : {}), onSuccess: (v) => (refresh(), setOpen(v.id)) });
  const review = useMutation({ mutationFn: (items: FieldAction[]) => post<IntakeView>(`/api/me/intake/${open}/review`, { items }), onSuccess: (v) => qc.setQueryData(['my-intake-item', open], v) });
  const submit = useMutation({ mutationFn: () => post<IntakeView>(`/api/me/intake/${open}/submit`), onSuccess: () => (setOpen(null), refresh(), toast(t('Zapisano w Twoich dokumentach.'))) });
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) upload.mutate(f);
  };
  const pending = intake.data?.items.filter((i) => ['processing', 'needs_review', 'unreadable', 'failed'].includes(i.status)) ?? [];
  return (
    <div className="stack-lg">
      <PageHead title={t('Moje dokumenty')} sub={t('Wyniki, wypisy, recepty i zaświadczenia z różnych miejsc — w jednym miejscu, pod Twoją kontrolą.')} action={<Link className="btn secondary" to="/os-czasu"><History size={18} /> {t('Oś czasu wyników')}</Link>} />
      <Card title={t('Dodaj dokument')}>
        <div className="stack">
          <SelectField label={t('Co dodajesz?')} value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">{t('Nie wiem — rozpoznaj automatycznie')}</option>
            {['lab', 'discharge', 'imaging', 'referral', 'prescription', 'certificate', 'other'].map((k) => (
              <option key={k} value={k}>
                {t(KIND_PL[k])}
              </option>
            ))}
          </SelectField>
          <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
          <input ref={file} type="file" accept="application/pdf,image/jpeg,image/png" hidden onChange={onFile} />
          <div className="grid-2">
            <Button icon={<Camera size={18} />} loading={upload.isPending} onClick={() => cam.current?.click()}>
              {t('Zrób zdjęcie')}
            </Button>
            <Button variant="secondary" icon={<FileUp size={18} />} loading={upload.isPending} onClick={() => file.current?.click()}>
              {t('Wybierz plik (PDF, JPG, PNG)')}
            </Button>
          </div>
          {upload.isError && <Notice kind="danger">{errorMessage(upload.error, t)}</Notice>}
        </div>
      </Card>
      {pending.length > 0 && (
        <Card title={t('Do sprawdzenia')} className="card-flush">
          <ul className="list">
            {pending.map((i) => (
              <li key={i.id}>
                <button type="button" className="list-item" style={{ width: '100%', background: 'none', border: 0, textAlign: 'left' }} onClick={() => setOpen(i.id)}>
                  <span className="grow">
                    <span className="list-title" style={{ display: 'block' }}>
                      {i.filename}
                    </span>
                    <span className="list-sub">{fmt.dateTime(i.createdAt)}</span>
                  </span>
                  <IntakeStatusBadge item={i} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card title={t('Zapisane dokumenty')} className="card-flush">
        {docs.isLoading ? (
          <Skeleton />
        ) : !docs.data?.items.length ? (
          <Empty icon={<FileText size={28} />} title={t('Nie masz jeszcze dokumentów')} />
        ) : (
          <ul className="list">
            {docs.data.items.map((d) => (
              <li key={d.id}>
                <Link to={`/dokumenty/${d.id}`} className="list-item">
                  <span className="list-icon">
                    <FileText size={20} />
                  </span>
                  <span className="grow">
                    <span className="list-title" style={{ display: 'block' }}>
                      {t(KIND_PL[d.kind] ?? d.kindLabel)}
                    </span>
                    <span className="list-sub">
                      {d.title} {d.date && `· ${fmt.date(d.date)}`}
                    </span>
                  </span>
                  <span aria-hidden>›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Modal open={!!open} onClose={() => setOpen(null)} title={t('Sprawdź odczyt')} wide>
        {!item.data || item.data.status === 'processing' ? (
          <Skeleton count={2} />
        ) : (
          <IntakeReview item={item.data} fileUrl={withProfile(`/api/me/intake/${item.data.id}/file`)} editable busy={review.isPending || submit.isPending} submitLabel={t('Zapisz w moich dokumentach')} onReview={(x) => review.mutate(x)} onSubmit={() => submit.mutate()} />
        )}
        {(review.isError || submit.isError) && <Notice kind="danger">{errorMessage(review.error ?? submit.error, t)}</Notice>}
      </Modal>
    </div>
  );
}

interface ProvView {
  at?: string;
  activity?: string;
  agents: { role?: string; who?: string }[];
  reason?: string;
}

function ProvenanceList({ items }: { items: ProvView[] }) {
  const { t, fmt } = useI18n();
  return (
    <ul className="small" style={{ paddingLeft: 18 }}>
      {items.map((p, i) => (
        <li key={i}>
          {fmt.dateTime(p.at)} — {p.activity}: {p.agents.map((a) => a.who).filter(Boolean).join(', ')}
          {p.reason && <span className="muted"> ({t('powód')}: {p.reason})</span>}
        </li>
      ))}
    </ul>
  );
}

export function DocumentDetailPage() {
  const { id = '' } = useParams();
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['my-doc', id], queryFn: () => get<{ id: string; title?: string; date?: string; text?: string; binaryId?: string; accessCode?: string; reportId?: string; provenance: ProvView[] }>(`/api/me/documents/${id}`) });
  if (q.isLoading) return <Skeleton />;
  if (q.isError) return <QueryError error={q.error} />;
  const d = q.data!;
  return (
    <div className="stack-lg">
      <PageHead back={{ to: '/dokumenty', label: t('Moje dokumenty') }} title={d.title ?? t('Dokument')} sub={d.date ? fmt.date(d.date) : undefined} />
      <div className="btn-row">
        {d.binaryId && (
          <a className="btn secondary" href={withProfile(`/api/me/documents/${id}/file`)} target="_blank" rel="noreferrer">
            <FileText size={16} /> {t('Oryginał')}
          </a>
        )}
        <Link className="btn secondary" to={`/udostepnianie?dokument=${id}`}>
          <Share2 size={16} /> {t('Udostępnij lekarzowi')}
        </Link>
        {d.reportId && (
          <Link className="btn secondary" to="/os-czasu">
            <History size={16} /> {t('Wyniki na osi czasu')}
          </Link>
        )}
      </div>
      {d.accessCode && <Notice kind="info">{t('Kod dostępu z dokumentu')}: <strong className="mono">{d.accessCode}</strong></Notice>}
      {d.text && (
        <Card title={t('Treść (kopia z odczytu)')}>
          <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{d.text.replace(/^== (.+) ==$/gm, '— $1 —')}</p>
        </Card>
      )}
      <Card title={t('Pochodzenie')}>
        <ProvenanceList items={d.provenance} />
      </Card>
    </div>
  );
}

// --- A2.5: oś czasu wyników z wersjami ---------------------------------------------------------------

interface TimelineItem {
  id: string;
  name: string;
  loinc?: string;
  date: string;
  value: string;
  valueNum?: number;
  unit?: string;
  range?: string;
  labFlag?: string;
  status: string;
  trust?: string;
  version?: string;
  documentId?: string;
  source: 'patient' | 'clinic';
}

const TRUST_PL: Record<string, string> = {
  'patient-confirmed': 'potwierdzone przez Ciebie',
  'clinician-confirmed': 'potwierdzone przez lekarza',
  'machine-unconfirmed': 'odczyt maszynowy, niepotwierdzony',
  manual: 'wpis ręczny',
  clinic: 'od placówki',
};

export function TimelinePage() {
  const { t, fmt } = useI18n();
  const [versions, setVersions] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['timeline'], queryFn: () => get<{ items: TimelineItem[] }>('/api/me/timeline') });
  const v = useQuery({ queryKey: ['obs-versions', versions], queryFn: () => get<{ versions: { version?: string; at?: string; status: string; value: string; unit?: string; reason?: string; trust?: string }[]; provenance: ProvView[] }>(`/api/me/observations/${versions}/versions`), enabled: !!versions });
  if (q.isLoading) return <Skeleton count={4} />;
  if (q.isError) return <QueryError error={q.error} />;
  const groups = new Map<string, TimelineItem[]>();
  for (const it of q.data!.items) {
    const k = it.loinc ?? it.name.toLowerCase();
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }
  return (
    <div className="stack-lg">
      <PageHead back={{ to: '/dokumenty', label: t('Moje dokumenty') }} title={t('Oś czasu wyników')} sub={t('Wartości, jednostki, zakresy i oznaczenia z dokumentów. Aplikacja nie ocenia wyników.')} />
      {groups.size === 0 && <Empty title={t('Brak wyników')} />}
      {[...groups.entries()].map(([k, items]) => {
        const numeric = items.filter((i) => i.valueNum !== undefined).slice().reverse();
        const units = new Set(numeric.map((i) => i.unit));
        return (
          <Card key={k} title={items[0].name}>
            {numeric.length >= 2 && units.size === 1 && <TrendChart dates={numeric.map((i) => i.date)} series={[{ key: k, label: items[0].name, color: 'var(--chart-line)', values: numeric.map((i) => i.valueNum) }]} unit={numeric[0].unit ?? ''} height={160} />}
            <TestExplanation loinc={items[0].loinc} unit={items[0].unit} />
            <ul className="list">
              {items.map((i) => (
                <li key={i.id} className="list-item">
                  <span className="grow">
                    <span className="list-title tabular" style={{ display: 'block' }}>
                      {i.value} {i.unit} {i.labFlag && <Badge>{t('oznaczenie lab.: {f}', { f: i.labFlag })}</Badge>}
                    </span>
                    <span className="list-sub">
                      {fmt.date(i.date)} · {i.range ? t('zakres z dokumentu: {r}', { r: i.range }) : t('bez zakresu w dokumencie')} · {t(TRUST_PL[i.trust ?? ''] ?? '')}
                    </span>
                  </span>
                  {i.documentId && (
                    <Link className="btn ghost sm" to={`/dokumenty/${i.documentId}`}>
                      {t('Dokument')}
                    </Link>
                  )}
                  <Button size="sm" variant="ghost" icon={<History size={14} />} onClick={() => setVersions(i.id)}>
                    {t('Wersje')}
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
      <Modal open={!!versions} onClose={() => setVersions(null)} title={t('Historia wersji wartości')}>
        {!v.data ? (
          <Skeleton count={2} />
        ) : (
          <div className="stack">
            <ul className="list">
              {v.data.versions.map((x) => (
                <li key={x.version} className="list-item">
                  <span className="grow">
                    <span className="list-title" style={{ display: 'block' }}>
                      {x.value} {x.unit}
                    </span>
                    <span className="list-sub">
                      {t('wersja {v}', { v: x.version ?? '' })} · {fmt.dateTime(x.at)} {x.reason && `· ${x.reason}`}
                    </span>
                  </span>
                  <Badge>{x.status}</Badge>
                </li>
              ))}
            </ul>
            <strong>{t('Pochodzenie')}</strong>
            <ProvenanceList items={v.data.provenance} />
          </div>
        )}
      </Modal>
    </div>
  );
}

// --- P2: udostępnianie na czas i „kto oglądał” ------------------------------------------------------

const SCOPE_PL: Record<string, string> = { all: 'wszystkie dokumenty i wyniki', results: 'wyniki badań', documents: 'dokumenty', selected: 'wybrane dokumenty' };
const PURPOSE_PL: Record<string, string> = { visit: 'wizyta', consultation: 'konsultacja', 'second-opinion': 'druga opinia', other: 'inny cel' };

export function SharingPage() {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [params] = useSearchParams();
  const preselect = params.get('dokument');
  const [creating, setCreating] = useState(!!preselect);
  const grants = useQuery({ queryKey: ['grants'], queryFn: () => get<{ items: GrantView[] }>('/api/me/grants') });
  const log = useQuery({ queryKey: ['access-log'], queryFn: () => get<{ items: AccessEntry[] }>('/api/me/access-log') });
  const revoke = useMutation({
    mutationFn: (id: string) => del(`/api/me/grants/${id}`),
    onSuccess: () => {
      toast(t('Udostępnienie wycofane — dostęp wygasł natychmiast.'));
      void qc.invalidateQueries({ queryKey: ['grants'] });
    },
  });
  const active = grants.data?.items.filter((g) => g.status === 'active') ?? [];
  const past = grants.data?.items.filter((g) => g.status !== 'active') ?? [];
  const row = (g: GrantView) => (
    <li key={g.id} className="list-item">
      <span className="grow">
        <span className="list-title" style={{ display: 'block' }}>
          {g.recipient}
        </span>
        <span className="list-sub">
          {t(SCOPE_PL[g.scope.kind])} · {t(PURPOSE_PL[g.purpose])} · {g.status === 'active' ? t('do {d}', { d: fmt.dateTime(g.expiresAt) }) : g.status === 'revoked' ? t('wycofane {d}', { d: fmt.dateTime(g.revokedAt) }) : t('wygasło {d}', { d: fmt.dateTime(g.expiresAt) })}
        </span>
      </span>
      {g.status === 'active' && (
        <Button
          size="sm"
          variant="danger-outline"
          onClick={async () => {
            if (await confirm({ title: t('Wycofać udostępnienie?'), body: t('{r} natychmiast straci dostęp.', { r: g.recipient }), confirmLabel: t('Wycofaj'), danger: true })) revoke.mutate(g.id);
          }}
        >
          {t('Wycofaj')}
        </Button>
      )}
    </li>
  );
  return (
    <div className="stack-lg">
      {dialog}
      <PageHead title={t('Komu udostępniam')} sub={t('Zakres × odbiorca × czas. Wycofanie działa natychmiast. Każdy odczyt widzisz w dzienniku.')} action={<Button icon={<Plus size={18} />} onClick={() => setCreating(true)}>{t('Udostępnij')}</Button>} />
      {creating && <NewGrantCard preselect={preselect ?? undefined} onDone={() => (setCreating(false), void qc.invalidateQueries({ queryKey: ['grants'] }))} />}
      <Card title={t('Aktywne udostępnienia')} className="card-flush">
        {active.length ? <ul className="list">{active.map(row)}</ul> : <Empty icon={<ShieldCheck size={26} />} title={t('Nikomu nie udostępniasz danych')} />}
      </Card>
      {past.length > 0 && (
        <Card title={t('Zakończone')} className="card-flush">
          <ul className="list">{past.map(row)}</ul>
        </Card>
      )}
      <Card title={t('Kto oglądał moje dane')} className="card-flush">
        {log.isLoading ? <Skeleton /> : <AccessLogList items={(log.data?.items ?? []).filter((e) => e.role !== 'patient').slice(0, 100)} />}
      </Card>
    </div>
  );
}

function NewGrantCard({ preselect, onDone }: { preselect?: string; onDone: () => void }) {
  const { t, fmt } = useI18n();
  const [f, setF] = useState({ orgId: '', practitionerId: '', scope: preselect ? 'selected' : 'all', purpose: 'consultation', days: '7', refs: preselect ? [`DocumentReference/${preselect}`] : ([] as string[]) });
  const clinics = useQuery({ queryKey: ['dir-clinics'], queryFn: () => get<{ items: { id: string; name: string }[] }>('/api/directory/clinics') });
  const docs = useQuery({ queryKey: ['my-docs'], queryFn: () => get<{ items: DocItem[] }>('/api/me/documents') });
  const doctors = useQuery({ queryKey: ['dir-doctors', f.orgId], queryFn: () => get<{ items: { id: string; name: string }[] }>(`/api/directory/clinics/${f.orgId}/practitioners`), enabled: !!f.orgId });
  const create = useMutation({
    mutationFn: () =>
      post('/api/me/grants', {
        orgId: f.orgId,
        practitionerId: f.practitionerId || undefined,
        scope: f.scope === 'selected' ? { kind: 'selected', refs: f.refs } : { kind: f.scope },
        purpose: f.purpose,
        days: Number(f.days),
      }),
    onSuccess: onDone,
  });
  return (
    <Card title={t('Nowe udostępnienie')} action={<Button variant="ghost" size="sm" icon={<X size={16} />} aria-label={t('Zamknij')} onClick={onDone} />}>
      <div className="stack">
        <div className="grid-2">
          <SelectField label={t('Placówka')} value={f.orgId} onChange={(e) => setF({ ...f, orgId: e.target.value, practitionerId: '' })}>
            <option value="">—</option>
            {clinics.data?.items.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <SelectField label={t('Lekarz (opcjonalnie — inaczej cała placówka)')} value={f.practitionerId} onChange={(e) => setF({ ...f, practitionerId: e.target.value })}>
            <option value="">{t('cała placówka')}</option>
            {doctors.data?.items.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </SelectField>
          <SelectField label={t('Zakres')} value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })}>
            {Object.entries(SCOPE_PL).map(([k, v]) => (
              <option key={k} value={k}>
                {t(v)}
              </option>
            ))}
          </SelectField>
          <SelectField label={t('Na jak długo')} value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })}>
            <option value="1">{t('1 dzień')}</option>
            <option value="7">{t('7 dni')}</option>
            <option value="30">{t('30 dni')}</option>
            <option value="90">{t('90 dni')}</option>
          </SelectField>
          <SelectField label={t('Cel')} value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })}>
            {Object.entries(PURPOSE_PL).map(([k, v]) => (
              <option key={k} value={k}>
                {t(v)}
              </option>
            ))}
          </SelectField>
        </div>
        {f.scope === 'selected' && (
          <div className="stack" style={{ gap: 4 }}>
            {docs.data?.items.map((d) => (
              <Checkbox
                key={d.id}
                label={`${t(KIND_PL[d.kind] ?? d.kindLabel)} — ${d.title}${d.date ? ` (${fmt.date(d.date)})` : ''}`}
                checked={f.refs.includes(d.ref)}
                onChange={(e) => setF({ ...f, refs: e.target.checked ? [...f.refs, d.ref] : f.refs.filter((r) => r !== d.ref) })}
              />
            ))}
          </div>
        )}
        <p className="small muted"><FullText text="Podstawą udostępnienia jest Twoja wyraźna zgoda; zapisujemy datę i zakres. Możesz ją wycofać w każdej chwili." /></p>
        {create.isError && <Notice kind="danger">{errorMessage(create.error, t)}</Notice>}
        <Button icon={<Share2 size={18} />} disabled={!f.orgId || (f.scope === 'selected' && !f.refs.length)} loading={create.isPending} onClick={() => create.mutate()}>
          {t('Udostępnij')}
        </Button>
      </div>
    </Card>
  );
}

// --- karty „Po wizycie” w aplikacji (MVP) -------------------------------------------------------------

export function CardsPage() {
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['cards'], queryFn: () => get<{ items: CardView[] }>('/api/me/cards') });
  return (
    <div className="stack-lg">
      <PageHead title={t('Karty „Po wizycie”')} sub={t('Co zrobiono, co dalej i kiedy wrócić — zatwierdzone przez lekarza.')} />
      {q.isLoading ? (
        <Skeleton />
      ) : !q.data?.items.length ? (
        <Empty title={t('Nie masz jeszcze kart po wizycie')} />
      ) : (
        <div className="card card-flush">
          <ul className="list">
            {q.data.items.map((c) => (
              <li key={c.id}>
                <Link to={`/karty/${c.id}`} className="list-item">
                  <span className="grow">
                    <span className="list-title" style={{ display: 'block' }}>
                      {c.clinic}
                    </span>
                    <span className="list-sub">
                      {c.doctor} · {fmt.dateTime(c.date)}
                    </span>
                  </span>
                  <span aria-hidden>›</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function CardDetailPage() {
  const { id = '' } = useParams();
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const [share, setShare] = useState({ days: '7', phone: '', label: '' });
  const [link, setLink] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['card', id], queryFn: () => get<CardView & { shares: { id: string; label?: string; expiresAt: string; status: string; firstOpenedAt?: string }[] }>(`/api/me/cards/${id}`) });
  const create = useMutation({ mutationFn: () => post<{ url: string }>(`/api/me/cards/${id}/share`, { days: Number(share.days), phone: share.phone || undefined, label: share.label || undefined }), onSuccess: (r) => (setLink(r.url), void qc.invalidateQueries({ queryKey: ['card', id] })) });
  const revoke = useMutation({ mutationFn: (sid: string) => del(`/api/me/cards/${id}/shares/${sid}`), onSuccess: () => void qc.invalidateQueries({ queryKey: ['card', id] }) });
  if (q.isLoading) return <Skeleton />;
  if (q.isError) return <QueryError error={q.error} />;
  return (
    <div className="stack-lg">
      <Link to="/karty" className="back-link">
        ← {t('Karty „Po wizycie”')}
      </Link>
      <CardContent card={q.data!} pdfUrl={`/api/me/cards/${id}/pdf`} />
      <Card title={t('Udostępnij osobie bliskiej')}>
        <div className="stack">
          <p className="small muted">{t('Osoba bliska zobaczy tylko tę kartę, przez wybrany czas. Możesz odwołać link.')}</p>
          <div className="grid-3">
            <TextField label={t('Dla kogo (opis)')} value={share.label} onChange={(e) => setShare({ ...share, label: e.target.value })} />
            <TextField label={t('Telefon (SMS z linkiem, opcjonalnie)')} inputMode="tel" value={share.phone} onChange={(e) => setShare({ ...share, phone: e.target.value })} />
            <SelectField label={t('Na jak długo')} value={share.days} onChange={(e) => setShare({ ...share, days: e.target.value })}>
              <option value="1">{t('1 dzień')}</option>
              <option value="7">{t('7 dni')}</option>
              <option value="30">{t('30 dni')}</option>
            </SelectField>
          </div>
          {link && (
            <Notice kind="ok">
              <span className="mono small" style={{ wordBreak: 'break-all' }}>
                {link}
              </span>
            </Notice>
          )}
          <Button icon={<Share2 size={16} />} loading={create.isPending} onClick={() => create.mutate()}>
            {t('Utwórz link')}
          </Button>
          {q.data!.shares.length > 0 && (
            <ul className="list">
              {q.data!.shares.map((s) => (
                <li key={s.id} className="list-item">
                  <span className="grow">
                    {s.label ?? t('link')} · {t('do {d}', { d: fmt.dateTime(s.expiresAt) })} {s.firstOpenedAt && <span className="muted small">· {t('otwarty')}</span>}
                  </span>
                  {s.status === 'active' ? (
                    <Button size="sm" variant="ghost" onClick={() => revoke.mutate(s.id)}>
                      {t('Odwołaj')}
                    </Button>
                  ) : (
                    <Badge>{s.status}</Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

// --- P14: pomoc, numery kryzysowe, przeznaczenie, instrukcja -----------------------------------------------

export function CrisisNumbers({ compact }: { compact?: boolean }) {
  const { t, locale } = useI18n();
  const q = useQuery({ queryKey: ['public-texts', locale], queryFn: () => get<PublicTexts>(`/api/public/texts?lang=${locale}`), staleTime: 3_600_000 });
  return (
    <Card title={t('Pomoc w nagłej sytuacji')}>
      <div className="stack" style={{ gap: 8 }}>
        {(q.data?.crisis ?? [{ number: '112', label: t('Numer alarmowy'), hours: '24/7' }, { number: '116 123', label: t('Kryzysowy telefon zaufania') }]).slice(0, compact ? 2 : 10).map((c) => (
          <a key={c.number} className={`btn ${c.number === '112' ? 'danger' : 'secondary'} block`} href={`tel:${c.number.replace(/\s/g, '')}`} style={{ justifyContent: 'flex-start' }}>
            <Phone size={18} /> <strong className="tabular">{c.number}</strong> <span className="small">{c.label}</span> {c.hours && <span className="small muted">({c.hours})</span>}
          </a>
        ))}
      </div>
    </Card>
  );
}

function TextCard({ text }: { text?: { title: string; paragraphs: string[]; version: string } }) {
  if (!text) return null;
  return (
    <Card title={text.title}>
      <div className="stack" style={{ gap: 6 }}>
        {text.paragraphs.map((p, i) => (
          <p key={i} style={{ margin: 0 }}>
            {p}
          </p>
        ))}
        <span className="small muted">{text.version}</span>
      </div>
    </Card>
  );
}

export function HelpPage() {
  const { t, locale } = useI18n();
  const q = useQuery({ queryKey: ['public-texts', locale], queryFn: () => get<PublicTexts>(`/api/public/texts?lang=${locale}`) });
  return (
    <div className="stack-lg">
      <PageHead title={t('Pomoc')} />
      <CrisisNumbers />
      <Link to="/bezpieczenstwo" className="btn danger-outline block">
        <Siren size={18} /> {t('SOS i karta ratunkowa')}
      </Link>
      <TextCard text={q.data?.purpose} />
      <TextCard text={q.data?.instructions} />
      <TextCard text={q.data?.ai} />
      <Link to="/jak-dziala-ai" className="btn secondary block">
        {t('Jak działa AI w aplikacji — karty zastosowań')}
      </Link>
      <ReportIncidentCard />
      {q.data?.securityContact && <p className="small muted">{t('Zgłoszenia podatności bezpieczeństwa: {c}', { c: q.data.securityContact })}</p>}
      <p className="small muted">{t('Wersja aplikacji: {v}', { v: q.data?.version.app ?? '' })}</p>
    </div>
  );
}

// --- P14: SOS, osoby bliskie, karta ratunkowa ----------------------------------------------------------

export function SafetyPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const q = useQuery({
    queryKey: ['emergency'],
    queryFn: () => get<{ contacts: { id: string; name: string; phone: string; relation?: string }[]; info: { notes: string; includeMedications: boolean }; card: { medications: string[] } }>('/api/me/emergency'),
  });
  const [c, setC] = useState({ name: '', phone: '', relation: '' });
  const [info, setInfo] = useState<{ notes: string; includeMedications: boolean } | null>(null);
  const add = useMutation({ mutationFn: () => post('/api/me/emergency/contacts', c), onSuccess: () => (setC({ name: '', phone: '', relation: '' }), void qc.invalidateQueries({ queryKey: ['emergency'] })) });
  const remove = useMutation({ mutationFn: (id: string) => del(`/api/me/emergency/contacts/${id}`), onSuccess: () => void qc.invalidateQueries({ queryKey: ['emergency'] }) });
  const saveInfo = useMutation({ mutationFn: () => put('/api/me/emergency/info', info), onSuccess: () => (toast(t('Zapisano kartę ratunkową.')), void qc.invalidateQueries({ queryKey: ['emergency'] })) });
  const sos = useMutation({
    mutationFn: async () => {
      const pos = await new Promise<GeolocationPosition | null>((res) => (navigator.geolocation ? navigator.geolocation.getCurrentPosition(res, () => res(null), { timeout: 5000 }) : res(null)));
      return post<{ notified: number }>('/api/me/sos', pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : {});
    },
    onSuccess: (r) => toast(t('Powiadomiono osoby bliskie: {n}.', { n: r.notified })),
  });
  if (q.isLoading) return <Skeleton />;
  const data = q.data!;
  const i = info ?? data.info;
  return (
    <div className="stack-lg">
      {dialog}
      <PageHead title={t('SOS i karta ratunkowa')} sub=<FullText text="W nagłym zagrożeniu najpierw dzwoń 112. Przycisk SOS dodatkowo powiadamia osoby bliskie SMS-em." /> />
      <a className="btn danger block" href="tel:112" style={{ fontSize: '1.2rem', minHeight: 64 }} onClick={() => data.contacts.length && sos.mutate()}>
        <Siren size={24} /> {t('SOS — dzwoń 112 i powiadom bliskich')}
      </a>
      <Button
        variant="secondary"
        block
        icon={<HeartPulse size={18} />}
        loading={sos.isPending}
        disabled={!data.contacts.length}
        onClick={async () => {
          if (await confirm({ title: t('Powiadomić osoby bliskie?'), body: t('Wyślemy SMS z prośbą o kontakt i linkiem do karty ratunkowej (ważny 24 h).'), confirmLabel: t('Wyślij'), danger: true })) sos.mutate();
        }}
      >
        {t('Tylko powiadom osoby bliskie')}
      </Button>
      <Card title={t('Osoby bliskie (najwyżej 5)')} className="card-flush">
        <ul className="list">
          {data.contacts.map((x) => (
            <li key={x.id} className="list-item">
              <span className="grow">
                <span className="list-title" style={{ display: 'block' }}>
                  {x.name} {x.relation && <span className="muted">({x.relation})</span>}
                </span>
                <span className="list-sub">{x.phone}</span>
              </span>
              <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} aria-label={t('Usuń')} onClick={() => remove.mutate(x.id)} />
            </li>
          ))}
        </ul>
        <div className="grid-3" style={{ padding: 16 }}>
          <TextField label={t('Imię i nazwisko')} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
          <TextField label={t('Telefon')} inputMode="tel" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} />
          <TextField label={t('Relacja (opcjonalnie)')} value={c.relation} onChange={(e) => setC({ ...c, relation: e.target.value })} />
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <Button size="sm" icon={<Plus size={14} />} disabled={c.name.length < 2 || c.phone.length < 9} loading={add.isPending} onClick={() => add.mutate()}>
            {t('Dodaj osobę')}
          </Button>
          {add.isError && <Notice kind="danger">{errorMessage(add.error, t)}</Notice>}
        </div>
      </Card>
      <Card title={t('Karta ratunkowa')}>
        <div className="stack">
          <TextArea label={t('Informacje dla ratowników (np. alergie, choroby przewlekłe) — wpisujesz sam(a)')} rows={4} value={i.notes} onChange={(e) => setInfo({ ...i, notes: e.target.value })} />
          <Checkbox label={t('Dołącz listę moich leków ({n})', { n: data.card.medications.length })} checked={i.includeMedications} onChange={(e) => setInfo({ ...i, includeMedications: e.target.checked })} />
          <Button loading={saveInfo.isPending} disabled={!info} onClick={() => saveInfo.mutate()}>
            {t('Zapisz')}
          </Button>
          <p className="small muted">{t('Każde otwarcie karty z linku SOS jest zapisywane w Twoim dzienniku dostępu.')}</p>
        </div>
      </Card>
      <CrisisNumbers compact />
    </div>
  );
}

// --- P8: preferencje powiadomień i godziny ciszy ------------------------------------------------------

const KIND_LABEL: Record<string, string> = {
  'appointment-reminder': 'Przypomnienia o wizytach',
  'docs-request': 'Prośby placówki o dokumenty',
  'after-visit-card': 'Karta „Po wizycie”',
  'record-shared': 'Nowe wyniki i dokumenty od placówki',
  message: 'Wiadomości',
  'med-reminder': 'Przypomnienia o lekach',
  'lab-flags': 'Oznaczenia laboratorium w moich dokumentach',
};

export function NotificationPrefsCard() {
  const { t } = useI18n();
  const toast = useToast();
  const q = useQuery({ queryKey: ['notify-prefs'], queryFn: () => get<{ prefs: { disabled: string[]; quiet: { enabled: boolean; from: string; to: string } }; kinds: string[] }>('/api/me/notification-prefs') });
  const [p, setP] = useState<{ disabled: string[]; quiet: { enabled: boolean; from: string; to: string } } | null>(null);
  const save = useMutation({ mutationFn: () => put('/api/me/notification-prefs', p), onSuccess: () => toast(t('Zapisano ustawienia powiadomień.')) });
  if (!q.data) return <Skeleton count={2} />;
  const v = p ?? q.data.prefs;
  return (
    <Card title={t('Ustawienia powiadomień')}>
      <div className="stack">
        <p className="small muted"><FullText text="Kolejność: powiadomienie w aplikacji → e-mail → SMS. Treść poza aplikacją nigdy nie zawiera danych o zdrowiu." /></p>
        {q.data.kinds.map((k) => (
          <div key={k} className="row-between">
            <span>{t(KIND_LABEL[k] ?? k)}</span>
            <Switch label={t(KIND_LABEL[k] ?? k)} checked={!v.disabled.includes(k)} onChange={(on) => setP({ ...v, disabled: on ? v.disabled.filter((x) => x !== k) : [...v.disabled, k] })} />
          </div>
        ))}
        <div className="row-between">
          <span>{t('Godziny ciszy')}</span>
          <Switch label={t('Godziny ciszy')} checked={v.quiet.enabled} onChange={(on) => setP({ ...v, quiet: { ...v.quiet, enabled: on } })} />
        </div>
        {v.quiet.enabled && (
          <div className="grid-2">
            <TextField label={t('Od')} type="time" value={v.quiet.from} onChange={(e) => setP({ ...v, quiet: { ...v.quiet, from: e.target.value } })} />
            <TextField label={t('Do')} type="time" value={v.quiet.to} onChange={(e) => setP({ ...v, quiet: { ...v.quiet, to: e.target.value } })} />
          </div>
        )}
        <p className="small muted">{t('Przypomnienia o lekach i powiadomienia bezpieczeństwa przychodzą także w godzinach ciszy.')}</p>
        <Button disabled={!p} loading={save.isPending} onClick={() => save.mutate()}>
          {t('Zapisz')}
        </Button>
      </div>
    </Card>
  );
}

// --- przypomnienia o lekach -----------------------------------------------------------------------------

export function MedRemindersCard({ medications }: { medications: { id: string; name: string }[] }) {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['med-schedules'], queryFn: () => get<{ items: { id: string; label: string; times: string[]; active: boolean; createdBy: string }[]; log: { id: string; label: string; dueAt: string; status: string }[] }>('/api/me/med-schedules') });
  const [f, setF] = useState({ medicationId: '', times: '08:00' });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['med-schedules'] });
  const add = useMutation({ mutationFn: () => post('/api/me/med-schedules', { medicationId: f.medicationId || undefined, label: f.medicationId ? undefined : t('Lek'), times: f.times.split(',').map((x) => x.trim()) }), onSuccess: refresh });
  const toggle = useMutation({ mutationFn: (v: { id: string; active: boolean }) => put(`/api/me/med-schedules/${v.id}`, { active: v.active }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => del(`/api/me/med-schedules/${id}`), onSuccess: refresh });
  const confirmIntake = useMutation({ mutationFn: (v: { id: string; status: 'taken' | 'skipped' }) => post(`/api/me/med-intake/${v.id}`, { status: v.status }), onSuccess: refresh });
  const due = q.data?.log.filter((l) => l.status === 'due') ?? [];
  return (
    <Card title={t('Przypomnienia o lekach')}>
      <div className="stack">
        <p className="small muted">{t('Ustawiasz godziny przypomnień; aplikacja nie ustala dawek i nie sprawdza interakcji.')}</p>
        {due.map((d) => (
          <div key={d.id} className="row-between notice warn" style={{ padding: 10 }}>
            <span>
              <Bell size={16} aria-hidden /> {d.label} · {fmt.time(d.dueAt)}
            </span>
            <span className="btn-row">
              <Button size="sm" onClick={() => confirmIntake.mutate({ id: d.id, status: 'taken' })}>
                {t('Przyjęty')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => confirmIntake.mutate({ id: d.id, status: 'skipped' })}>
                {t('Pominięty')}
              </Button>
            </span>
          </div>
        ))}
        <ul className="list">
          {q.data?.items.map((s) => (
            <li key={s.id} className="list-item">
              <span className="grow">
                <span className="list-title" style={{ display: 'block' }}>
                  {s.label}
                </span>
                <span className="list-sub">
                  {s.times.join(', ')} {s.createdBy === 'clinic' && `· ${t('zaproponowane przez lekarza')}`}
                </span>
              </span>
              <Switch label={s.label} checked={s.active} onChange={(v) => toggle.mutate({ id: s.id, active: v })} />
              <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} aria-label={t('Usuń')} onClick={() => remove.mutate(s.id)} />
            </li>
          ))}
        </ul>
        <div className="grid-2">
          <SelectField label={t('Lek z listy')} value={f.medicationId} onChange={(e) => setF({ ...f, medicationId: e.target.value })}>
            <option value="">—</option>
            {medications.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </SelectField>
          <TextField label={t('Godziny (np. 08:00, 20:00)')} value={f.times} onChange={(e) => setF({ ...f, times: e.target.value })} />
        </div>
        {add.isError && <Notice kind="danger">{errorMessage(add.error, t)}</Notice>}
        <Button size="sm" icon={<Plus size={14} />} disabled={!f.medicationId} loading={add.isPending} onClick={() => add.mutate()}>
          {t('Dodaj przypomnienie')}
        </Button>
      </div>
    </Card>
  );
}

// --- A1.4: korekta wpisu ręcznego z historią -------------------------------------------------------------

export function MeasurementHistoryButton({ m }: { m: { id: string; kind: string; value?: number; systolic?: number; diastolic?: number; unit: string; corrected?: boolean } }) {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ value: String(m.value ?? ''), systolic: String(m.systolic ?? ''), diastolic: String(m.diastolic ?? ''), reason: '' });
  const v = useQuery({ queryKey: ['obs-versions', m.id], queryFn: () => get<{ versions: { version?: string; at?: string; value: string; unit?: string; reason?: string }[] }>(`/api/me/observations/${m.id}/versions`), enabled: open });
  const correct = useMutation({
    mutationFn: () => post(`/api/me/measurements/${m.id}/correct`, m.kind === 'bp' ? { systolic: Number(f.systolic), diastolic: Number(f.diastolic), reason: f.reason } : { value: Number(f.value.replace(',', '.')), reason: f.reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['measurements'] });
      void v.refetch();
      setF({ ...f, reason: '' });
    },
  });
  return (
    <>
      <Button variant="ghost" size="sm" icon={<History size={16} />} aria-label={t('Historia i korekta')} onClick={() => setOpen(true)}>
        {m.corrected ? t('poprawiony') : undefined}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t('Historia i korekta pomiaru')}>
        <div className="stack">
          <ul className="list">
            {v.data?.versions.map((x) => (
              <li key={x.version} className="list-item">
                <span className="grow">
                  {x.value} {x.unit} <span className="small muted">· {fmt.dateTime(x.at)}</span>
                </span>
                {x.reason && <span className="small">{x.reason}</span>}
              </li>
            ))}
          </ul>
          {m.kind === 'bp' ? (
            <div className="grid-2">
              <TextField label={t('Skurczowe')} inputMode="numeric" value={f.systolic} onChange={(e) => setF({ ...f, systolic: e.target.value })} />
              <TextField label={t('Rozkurczowe')} inputMode="numeric" value={f.diastolic} onChange={(e) => setF({ ...f, diastolic: e.target.value })} />
            </div>
          ) : (
            <TextField label={t('Poprawna wartość ({u})', { u: m.unit })} inputMode="decimal" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
          )}
          <TextField label={t('Powód korekty')} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          {correct.isError && <Notice kind="danger">{errorMessage(correct.error, t)}</Notice>}
          <Button disabled={f.reason.trim().length < 3} loading={correct.isPending} onClick={() => correct.mutate()}>
            {t('Zapisz korektę')}
          </Button>
          <p className="small muted">{t('Poprzednia wartość zostaje w historii.')}</p>
        </div>
      </Modal>
    </>
  );
}

// --- A18.12: usunięcie danych z potwierdzeniem --------------------------------------------------------------

export function DeleteDataCard() {
  const { t } = useI18n();
  const { setMe } = useSession();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ confirm: '', password: '' });
  const [done, setDone] = useState<{ id: string; steps: { key: string; label: string; status: string; count?: number; detail: string }[]; backupsGoneBy: string } | null>(null);
  const run = useMutation({
    mutationFn: () => post<{ confirmation: NonNullable<typeof done> }>('/api/me/delete-data', { confirm: f.confirm, password: f.password || undefined }),
    onSuccess: (r) => setDone(r.confirmation),
  });
  const STATUS: Record<string, string> = { deleted: 'usunięte', kept: 'zostaje', scheduled: 'zaplanowane', 'not-stored': 'nie przechowujemy' };
  return (
    <>
      <div className="row-between">
        <span className="grow">
          <strong>{t('Usuń moje dane')}</strong>
          <span className="small muted" style={{ display: 'block' }}>
            <FullText text="Usuwamy Twoje dokumenty, wpisy i konto. Dokumentacja w placówkach zostaje (20 lat). Otrzymasz potwierdzenie: co usunięto, co zostaje i kiedy znikną kopie." />
          </span>
        </span>
        <Button variant="danger-outline" icon={<Trash2 size={18} />} onClick={() => setOpen(true)}>
          {t('Usuń dane')}
        </Button>
      </div>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          if (done) {
            setMe({ authenticated: false });
            nav('/logowanie', { replace: true });
          }
        }}
        title={done ? t('Potwierdzenie usunięcia danych') : t('Usunięcie danych')}
        wide={!!done}
      >
        {done ? (
          <div className="stack">
            <p className="small muted">{t('Numer potwierdzenia: {id}', { id: done.id })}</p>
            <table className="table">
              <tbody>
                {done.steps.map((s) => (
                  <tr key={s.key}>
                    <td>{s.label}</td>
                    <td className="nowrap">
                      <Badge kind={s.status === 'deleted' ? 'ok' : s.status === 'kept' ? undefined : 'info'}>{t(STATUS[s.status] ?? s.status)}</Badge> {s.count !== undefined && s.count}
                    </td>
                    <td className="small muted">{s.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <form method="post" action="/api/deletion/confirmation.pdf" onSubmit={(e) => {
              e.preventDefault();
              void fetch('/api/deletion/confirmation.pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: done.id }) })
                .then((r) => r.blob())
                .then((b) => {
                  const u = URL.createObjectURL(b);
                  const a = document.createElement('a');
                  a.href = u;
                  a.download = 'potwierdzenie-usuniecia.pdf';
                  a.click();
                  URL.revokeObjectURL(u);
                });
            }}>
              <Button type="submit" variant="secondary">
                {t('Pobierz potwierdzenie (PDF)')}
              </Button>
            </form>
          </div>
        ) : (
          <div className="stack">
            <Notice kind="warn">{t('Operacji nie można cofnąć. Pobierz wcześniej kopię danych, jeśli jej potrzebujesz.')}</Notice>
            <TextField label={t('Hasło')} type="password" autoComplete="current-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
            <TextField label={t('Wpisz USUŃ, aby potwierdzić')} value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value.toUpperCase() })} />
            {run.isError && <Notice kind="danger">{errorMessage(run.error, t)}</Notice>}
            <Button variant="danger" disabled={f.confirm !== 'USUŃ'} loading={run.isPending} onClick={() => run.mutate()}>
              {t('Usuń trwale')}
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}

export function HelpLink({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  return (
    <Link to="/pomoc" className="btn ghost sm">
      <LifeBuoy size={16} /> {children ?? t('Pomoc')}
    </Link>
  );
}

/** F8.1 — panel kryzysowy (nie do wyłączenia): numery pomocy po wykryciu słów kryzysowych w wiadomości. */
export function CrisisModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Modal open={open} onClose={onClose} title={t('Jeśli jest Ci bardzo trudno — nie zostawaj z tym sam(a)')}>
      <div className="stack">
        <p><FullText text="Wiadomość do placówki może zostać przeczytana dopiero za kilka dni. Jeśli myślisz o zrobieniu sobie krzywdy, zadzwoń teraz:" /></p>
        <CrisisNumbers />
      </div>
    </Modal>
  );
}
