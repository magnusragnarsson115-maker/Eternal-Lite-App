import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Camera, FileSignature, PackageSearch, PenLine, Plus, Printer, Search, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { api, get, post, put, qs } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { resolveFileUrl } from '../lib/sourceImage';
import { Badge, Button, Card, Checkbox, Empty, Modal, Notice, PageHead, QueryError, SelectField, Skeleton, Switch, Tabs, TextArea, TextField, useToast } from '../ui';

/**
 * Medycyna estetyczna — ekrany personelu: zabiegi, produkty i partie (z wyszukiwaniem „kto dostał partię”),
 * powikłania, wzory zgód; w karcie pacjenta — zgody, zgoda na wizerunek, karty zabiegów z mapą iniekcji i zdjęciami.
 * Zdjęcia pokazujemy obok siebie bez jakiejkolwiek analizy obrazu.
 */

type Unit = 'j.' | 'ml' | 'szt.' | 'mg';
interface Lot {
  id: string;
  productId: string;
  lot: string;
  expiry: string;
  udi?: string;
  receivedOn?: string;
  active: boolean;
  expired: boolean;
  expiringSoon: boolean;
  used: number;
}
interface Product {
  id: string;
  name: string;
  kind: string;
  category: string;
  manufacturer?: string;
  unit: Unit;
  requiresPhysician: boolean;
  active: boolean;
  lots: Lot[];
}
interface Meta {
  kinds: string[];
  categories: string[];
  units: Unit[];
  angles: string[];
  views: ('przod' | 'lewy' | 'prawy')[];
  seriousness: string[];
  reportTo: string[];
  templates: { id: string; title: string; version: string; approval?: { approvedBy: string; approvedAt: string } }[];
  services: { id: string; name: string; price?: number; vat?: string; requiresPhysician?: boolean; consentTemplate?: string; controlAfterDays?: number; purposeDefault?: 'estetyczny' | 'leczniczy' }[];
}
interface Point {
  x: number;
  y: number;
  view: 'przod' | 'lewy' | 'prawy';
  quantity?: number;
  item?: number;
  label?: string;
}
interface Consent {
  id: string;
  patientId: string;
  templateId: string;
  title: string;
  version: string;
  status: 'do-podpisu' | 'podpisana' | 'wycofana';
  readAt?: string;
  signedOn?: string;
  method?: 'papier' | 'podpis-kwalifikowany';
  documentId?: string;
  recordedBy?: string;
  createdAt: string;
}
export interface Procedure {
  id: string;
  patientId: string;
  patientName: string;
  serviceId?: string;
  serviceName?: string;
  title: string;
  purpose: 'estetyczny' | 'leczniczy';
  indication?: string;
  performer: string;
  performedAt: string;
  items: { productId: string; lotId: string; quantity: number; area: string; productName: string; unit: Unit; lot: string; expiry: string; udi?: string; category: string; manufacturer?: string }[];
  points: Point[];
  notes?: string;
  consent?: Consent;
  photos: { documentId: string; phase: 'przed' | 'po'; angle: string; at: string }[];
  aftercare?: string;
  controlOn?: string;
  nextOn?: string;
  status: 'szkic' | 'podpisana';
  signedAt?: string;
  billing: { price?: number; vat: string; basis: string };
  complications: number;
  clinic?: string;
}

export const KIND_LABEL: Record<string, string> = { toksyna: 'toksyna botulinowa', 'wypelniacz-ha': 'wypełniacz HA', biostymulator: 'stymulator tkankowy', mezoterapia: 'mezoterapia', nici: 'nici', inny: 'inny' };
export const CATEGORY_LABEL: Record<string, string> = { lek: 'produkt leczniczy', 'wyrob-medyczny': 'wyrób medyczny', kosmetyk: 'kosmetyk', inny: 'inny' };
export const ANGLE_LABEL: Record<string, string> = { 'en-face': 'en face', 'lewy-45': 'lewy półprofil', 'prawy-45': 'prawy półprofil', 'lewy-profil': 'lewy profil', 'prawy-profil': 'prawy profil', okolica: 'okolica zabiegu' };
const VIEW_LABEL: Record<string, string> = { przod: 'przód', lewy: 'lewy profil', prawy: 'prawy profil' };
const SERIOUS_LABEL: Record<string, string> = { lagodne: 'łagodne', umiarkowane: 'umiarkowane', ciezkie: 'ciężkie' };
const REPORT_LABEL: Record<string, string> = { urpl: 'URPL', wytworca: 'wytwórca', 'urpl-i-wytworca': 'URPL i wytwórca', 'nie-dotyczy': 'nie dotyczy' };
const CONSENT_STATUS: Record<string, string> = { 'do-podpisu': 'do podpisu', podpisana: 'podpisana', wycofana: 'wycofana' };
const todayIso = () => new Date().toISOString().slice(0, 10);

/** Obraz z API (w podglądzie bez serwera — lokalna kopia nagrania). */
export function ApiImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void resolveFileUrl(src)
      .then((u) => live && setUrl(u))
      .catch(() => live && setUrl(null));
    return () => {
      live = false;
    };
  }, [src]);
  return url ? <img src={url} alt={alt} className={className} loading="lazy" /> : <span className={`img-ph ${className ?? ''}`} aria-label={alt} />;
}

// --- mapa iniekcji --------------------------------------------------------------------------------------------------

function FaceOutline({ view }: { view: Point['view'] }) {
  if (view === 'przod')
    return (
      <g className="face-line">
        <ellipse cx="150" cy="170" rx="92" ry="122" />
        <path d="M70 120 Q150 40 230 120" />
        <path d="M95 128 Q118 116 140 126 M160 126 Q182 116 205 128" />
        <ellipse cx="118" cy="146" rx="17" ry="7" />
        <ellipse cx="182" cy="146" rx="17" ry="7" />
        <path d="M150 150 L142 200 Q150 208 158 200" />
        <path d="M120 236 Q150 226 180 236 Q150 254 120 236 Z" />
        <path d="M100 210 Q112 232 120 236 M200 210 Q188 232 180 236" />
      </g>
    );
  const flip = view === 'prawy';
  return (
    <g className="face-line" transform={flip ? 'translate(300 0) scale(-1 1)' : undefined}>
      <path d="M190 60 Q120 40 100 110 Q96 130 100 140 L84 172 Q80 182 96 186 L98 204 Q92 214 102 220 L100 236 Q104 252 118 256 Q120 280 150 290 Q190 296 210 260 Q240 200 236 140 Q232 80 190 60 Z" />
      <path d="M108 146 Q120 142 130 147" />
      <path d="M104 130 Q118 122 136 128" />
      <path d="M100 236 L112 234" />
      <ellipse cx="200" cy="170" rx="12" ry="22" />
    </g>
  );
}

export function FaceMap({ points, onAdd, onRemove, view, setView, readOnly }: { points: Point[]; onAdd?: (p: { x: number; y: number; view: Point['view'] }) => void; onRemove?: (i: number) => void; view: Point['view']; setView: (v: Point['view']) => void; readOnly?: boolean }) {
  const { t } = useI18n();
  const svg = useRef<SVGSVGElement>(null);
  const click = (e: MouseEvent<SVGSVGElement>) => {
    if (readOnly || !onAdd || !svg.current) return;
    const r = svg.current.getBoundingClientRect();
    onAdd({ x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)), view });
  };
  const shown = points.map((p, i) => ({ p, i })).filter(({ p }) => p.view === view);
  return (
    <div className="face-map">
      <div className="segmented" role="group" aria-label={t('Widok mapy')}>
        {(['przod', 'lewy', 'prawy'] as const).map((v) => (
          <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
            {t(VIEW_LABEL[v])} ({points.filter((p) => p.view === v).length})
          </button>
        ))}
      </div>
      <svg ref={svg} viewBox="0 0 300 330" role="img" aria-label={t('Mapa iniekcji — {v}', { v: t(VIEW_LABEL[view]) })} onClick={click} className={readOnly ? '' : 'editable'}>
        <rect width="300" height="330" className="face-bg" />
        <FaceOutline view={view} />
        {shown.map(({ p, i }) => (
          <g key={i} className="face-point">
            <circle cx={p.x * 300} cy={p.y * 330} r="7" />
            <text x={p.x * 300 + 10} y={p.y * 330 + 4}>
              {p.quantity !== undefined ? p.quantity : i + 1}
            </text>
          </g>
        ))}
      </svg>
      {!readOnly && <p className="small muted" style={{ margin: 0 }}>{t('Kliknij miejsce wkłucia na mapie. Ilość i produkt ustawisz na liście punktów.')}</p>}
      {onRemove && points.length > 0 && (
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          {points.map((p, i) => (
            <li key={i}>
              {t(VIEW_LABEL[p.view])} · {p.label ?? t('punkt {n}', { n: i + 1 })}
              {p.quantity !== undefined ? ` · ${p.quantity}` : ''}{' '}
              <button type="button" className="link-btn" onClick={() => onRemove(i)}>
                {t('usuń')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- edytor karty zabiegu -------------------------------------------------------------------------------------------

function ProcedureEditor({ patientId, draft, meta, products, consents, onClose }: { patientId: string; draft?: Procedure; meta: Meta; products: Product[]; consents: Consent[]; onClose: () => void }) {
  const { t, fmt } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [serviceId, setServiceId] = useState(draft?.serviceId ?? '');
  const svc = meta.services.find((s) => s.id === serviceId);
  const [title, setTitle] = useState(draft?.title ?? '');
  const [purpose, setPurpose] = useState<'estetyczny' | 'leczniczy'>(draft?.purpose ?? 'estetyczny');
  const [indication, setIndication] = useState(draft?.indication ?? '');
  const [items, setItems] = useState(draft?.items.map((i) => ({ productId: i.productId, lotId: i.lotId, quantity: String(i.quantity), area: i.area })) ?? [{ productId: '', lotId: '', quantity: '', area: '' }]);
  const [points, setPoints] = useState<Point[]>(draft?.points ?? []);
  const [view, setView] = useState<Point['view']>('przod');
  const [pointQty, setPointQty] = useState('');
  const [consentId, setConsentId] = useState(draft?.consent?.id ?? '');
  const [notes, setNotes] = useState(draft?.notes ?? '');
  const [aftercare, setAftercare] = useState(draft?.aftercare ?? '');
  const [controlOn, setControlOn] = useState(draft?.controlOn ?? '');
  const [nextOn, setNextOn] = useState(draft?.nextOn ?? '');
  const [id, setId] = useState(draft?.id);
  const signed = consents.filter((c) => c.status === 'podpisana');
  const body = () => ({
    serviceId: serviceId || undefined,
    title: title.trim(),
    purpose,
    indication: indication.trim() || undefined,
    items: items.filter((i) => i.productId && i.lotId && Number(i.quantity) > 0).map((i) => ({ productId: i.productId, lotId: i.lotId, quantity: Number(i.quantity), area: i.area.trim() })),
    points: points.map((p) => ({ ...p, quantity: p.quantity })),
    notes: notes.trim() || undefined,
    consentId: consentId || null,
    ...(id ? { aftercare, controlOn: controlOn || null, nextOn: nextOn || null } : aftercare ? { aftercare } : {}),
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['aesthetic-procedures'] });
    void qc.invalidateQueries({ queryKey: ['profile-tasks'] });
  };
  const save = useMutation({
    mutationFn: () => (id ? put<Procedure>(`/api/staff/aesthetic/procedures/${id}`, body()) : post<Procedure>('/api/staff/aesthetic/procedures', { patientId, ...body() })),
    onSuccess: (p) => {
      setId(p.id);
      setAftercare(p.aftercare ?? '');
      setControlOn(p.controlOn ?? '');
      setNextOn(p.nextOn ?? '');
      toast(t('Zapisano szkic karty zabiegu.'));
      refresh();
    },
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  const sign = useMutation({
    mutationFn: async () => {
      await put(`/api/staff/aesthetic/procedures/${id}`, body());
      return post<Procedure>(`/api/staff/aesthetic/procedures/${id}/sign`);
    },
    onSuccess: () => (toast(t('Karta zabiegu podpisana. Pacjent widzi ją w aplikacji razem z zaleceniami.')), refresh(), onClose()),
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  const chooseService = (sid: string) => {
    setServiceId(sid);
    const s = meta.services.find((x) => x.id === sid);
    if (s && !title) setTitle(s.name);
    if (s?.purposeDefault) setPurpose(s.purposeDefault);
  };
  return (
    <Card title={id ? t('Karta zabiegu — szkic') : t('Nowa karta zabiegu')} action={<Button size="sm" variant="ghost" onClick={onClose}>{t('Zamknij')}</Button>}>
      <div className="stack">
        <div className="grid-2">
          <SelectField label={t('Usługa')} value={serviceId} onChange={(e) => chooseService(e.target.value)}>
            <option value="">—</option>
            {meta.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
          <TextField label={t('Zabieg')} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} required />
        </div>
        {svc?.requiresPhysician && <Notice kind="info">{t('Usługa „wykonuje lekarz” — kartę podpisze wyłącznie lekarz albo lekarz dentysta.')}</Notice>}
        <fieldset className="fieldset">
          <legend>{t('Cel zabiegu')}</legend>
          <div className="row">
            <label className="check">
              <input type="radio" name="purpose" checked={purpose === 'estetyczny'} onChange={() => setPurpose('estetyczny')} /> {t('estetyczny')}
            </label>
            <label className="check">
              <input type="radio" name="purpose" checked={purpose === 'leczniczy'} onChange={() => setPurpose('leczniczy')} /> {t('leczniczy')}
            </label>
          </div>
          {purpose === 'leczniczy' && <TextField label={t('Wskazanie (rozpoznanie lekarza)')} value={indication} onChange={(e) => setIndication(e.target.value)} maxLength={500} hint={t('Wymagane przy celu leczniczym — podstawa w dokumentacji, także dla rozliczenia VAT.')} />}
        </fieldset>
        <fieldset className="fieldset">
          <legend>{t('Produkty i partie')}</legend>
          <div className="stack-sm">
            {items.map((it, i) => {
              const prod = products.find((p) => p.id === it.productId);
              return (
                <div key={i} className="proc-item-row">
                  <SelectField label={t('Produkt')} value={it.productId} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, productId: e.target.value, lotId: '' } : x)))}>
                    <option value="">—</option>
                    {products
                      .filter((p) => p.active)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </SelectField>
                  <SelectField label={t('Partia (seria)')} value={it.lotId} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, lotId: e.target.value } : x)))}>
                    <option value="">—</option>
                    {(prod?.lots ?? [])
                      .filter((l) => l.active && !l.expired)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.lot} · {t('ważna do')} {fmt.date(l.expiry)}
                        </option>
                      ))}
                  </SelectField>
                  <TextField label={t('Ilość ({u})', { u: prod?.unit ?? '' })} type="number" min={0} step="0.1" value={it.quantity} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))} />
                  <TextField label={t('Okolica')} value={it.area} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, area: e.target.value } : x)))} maxLength={80} />
                </div>
              );
            })}
            <Button size="sm" variant="ghost" icon={<Plus size={14} />} onClick={() => setItems([...items, { productId: '', lotId: '', quantity: '', area: '' }])}>
              {t('Dodaj produkt')}
            </Button>
          </div>
        </fieldset>
        <fieldset className="fieldset">
          <legend>{t('Mapa iniekcji')}</legend>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <TextField label={t('Ilość w kolejnym punkcie (opcjonalnie)')} type="number" min={0} step="0.1" value={pointQty} onChange={(e) => setPointQty(e.target.value)} />
          </div>
          <FaceMap points={points} view={view} setView={setView} onAdd={(p) => setPoints([...points, { ...p, quantity: pointQty === '' ? undefined : Number(pointQty), item: items.length === 1 ? 0 : undefined }])} onRemove={(i) => setPoints(points.filter((_, j) => j !== i))} />
        </fieldset>
        <SelectField label={t('Zgoda pisemna pacjenta')} value={consentId} onChange={(e) => setConsentId(e.target.value)} hint={signed.length ? undefined : t('Brak podpisanej zgody — przygotuj ją w sekcji „Zgody” powyżej.')}>
          <option value="">—</option>
          {signed.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title} · {c.signedOn ? fmt.date(c.signedOn) : ''}
            </option>
          ))}
        </SelectField>
        <TextArea label={t('Przebieg i uwagi lekarza (pacjent ich nie widzi)')} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} rows={3} />
        {id && (
          <>
            <TextArea label={t('Zalecenia po zabiegu (pacjent widzi je w aplikacji)')} value={aftercare} onChange={(e) => setAftercare(e.target.value)} maxLength={4000} rows={5} />
            <div className="grid-2">
              <TextField label={t('Wizyta kontrolna')} type="date" value={controlOn} onChange={(e) => setControlOn(e.target.value)} />
              <TextField label={t('Możliwy termin kolejnego zabiegu')} type="date" value={nextOn} onChange={(e) => setNextOn(e.target.value)} hint={t('Ustala lekarz; pacjent dostanie ogólne przypomnienie.')} />
            </div>
          </>
        )}
        <div className="btn-row">
          <Button variant="secondary" disabled={!title.trim()} loading={save.isPending} onClick={() => save.mutate()}>
            {id ? t('Zapisz szkic') : t('Zapisz szkic i przejdź dalej')}
          </Button>
          {id && (
            <Button icon={<PenLine size={15} />} loading={sign.isPending} onClick={() => sign.mutate()}>
              {t('Podpisz kartę zabiegu')}
            </Button>
          )}
        </div>
        <p className="small muted" style={{ margin: 0 }}>{t('Przy podpisie Eternal sprawdza: zawód lekarza (jeśli wymagany), ważność partii, podpisaną zgodę pisemną i wskazanie przy celu leczniczym. Podpisanej karty nie można zmienić.')}</p>
      </div>
    </Card>
  );
}

// --- karta zabiegu (podgląd) ----------------------------------------------------------------------------------------

function PhotoUpload({ procedureId, angles, onDone }: { procedureId: string; angles: string[]; onDone: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<'przed' | 'po'>('przed');
  const [angle, setAngle] = useState('en-face');
  const send = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.set('phase', phase);
      fd.set('angle', angle);
      fd.set('file', file!);
      return api(`/api/staff/aesthetic/procedures/${procedureId}/photos`, { method: 'POST', form: fd });
    },
    onSuccess: () => (setFile(null), onDone()),
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  return (
    <div className="photo-upload">
      <SelectField label={t('Kiedy')} value={phase} onChange={(e) => setPhase(e.target.value as 'przed' | 'po')}>
        <option value="przed">{t('przed zabiegiem')}</option>
        <option value="po">{t('po zabiegu')}</option>
      </SelectField>
      <SelectField label={t('Ujęcie')} value={angle} onChange={(e) => setAngle(e.target.value)}>
        {angles.map((a) => (
          <option key={a} value={a}>
            {t(ANGLE_LABEL[a] ?? a)}
          </option>
        ))}
      </SelectField>
      <label className="field">
        <span className="label">{t('Zdjęcie (JPG lub PNG)')}</span>
        <input type="file" accept="image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <Button size="sm" icon={<Camera size={15} />} disabled={!file} loading={send.isPending} onClick={() => send.mutate()}>
        {t('Dodaj zdjęcie')}
      </Button>
    </div>
  );
}

export function PhotoCompare({ photos, srcOf }: { photos: Procedure['photos']; srcOf: (docId: string) => string }) {
  const { t } = useI18n();
  const angles = [...new Set(photos.map((p) => p.angle))];
  if (!photos.length) return <p className="small muted" style={{ margin: 0 }}>{t('Brak zdjęć.')}</p>;
  return (
    <div className="photo-compare">
      {angles.map((a) => {
        const before = photos.filter((p) => p.angle === a && p.phase === 'przed').at(-1);
        const after = photos.filter((p) => p.angle === a && p.phase === 'po').at(-1);
        return (
          <figure key={a}>
            <figcaption className="small">{t(ANGLE_LABEL[a] ?? a)}</figcaption>
            <div className="pair">
              <div>
                {before ? <ApiImage src={srcOf(before.documentId)} alt={t('przed zabiegiem — {a}', { a: t(ANGLE_LABEL[a] ?? a) })} /> : <span className="img-ph" />}
                <span className="small muted">{t('przed')}</span>
              </div>
              <div>
                {after ? <ApiImage src={srcOf(after.documentId)} alt={t('po zabiegu — {a}', { a: t(ANGLE_LABEL[a] ?? a) })} /> : <span className="img-ph" />}
                <span className="small muted">{t('po')}</span>
              </div>
            </div>
          </figure>
        );
      })}
    </div>
  );
}

function ComplicationModal({ procedure, meta, open, onClose }: { procedure: Procedure; meta: Meta; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState({ noticedOn: todayIso(), description: '', seriousness: 'lagodne', actions: '', reportTo: 'nie-dotyczy' });
  const save = useMutation({
    mutationFn: () => post('/api/staff/aesthetic/complications', { procedureId: procedure.id, ...f, actions: f.actions || undefined }),
    onSuccess: () => {
      toast(t('Zapisano powikłanie.'));
      void qc.invalidateQueries({ queryKey: ['aesthetic-procedures'] });
      void qc.invalidateQueries({ queryKey: ['aesthetic-complications'] });
      void qc.invalidateQueries({ queryKey: ['profile-tasks'] });
      onClose();
    },
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  return (
    <Modal open={open} onClose={onClose} title={t('Powikłanie po zabiegu')} footer={<Button disabled={!f.description.trim()} loading={save.isPending} onClick={() => save.mutate()}>{t('Zapisz')}</Button>}>
      <div className="stack">
        <p className="small muted" style={{ margin: 0 }}>
          {procedure.title} · {procedure.items.map((i) => `${i.productName} (${i.lot})`).join(', ')}
        </p>
        <div className="grid-2">
          <TextField label={t('Zauważono')} type="date" value={f.noticedOn} max={todayIso()} onChange={(e) => setF({ ...f, noticedOn: e.target.value })} />
          <SelectField label={t('Nasilenie (ocena lekarza)')} value={f.seriousness} onChange={(e) => setF({ ...f, seriousness: e.target.value })}>
            {meta.seriousness.map((s) => (
              <option key={s} value={s}>
                {t(SERIOUS_LABEL[s] ?? s)}
              </option>
            ))}
          </SelectField>
        </div>
        <TextArea label={t('Opis')} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={4000} rows={3} />
        <TextArea label={t('Postępowanie')} value={f.actions} onChange={(e) => setF({ ...f, actions: e.target.value })} maxLength={2000} rows={2} />
        <SelectField label={t('Zgłoszenie')} value={f.reportTo} onChange={(e) => setF({ ...f, reportTo: e.target.value })}>
          {meta.reportTo.map((r) => (
            <option key={r} value={r}>
              {t(REPORT_LABEL[r] ?? r)}
            </option>
          ))}
        </SelectField>
      </div>
    </Modal>
  );
}

function ProcedureCard({ p, meta, products, consents, patientId }: { p: Procedure; meta: Meta; products: Product[]; consents: Consent[]; patientId: string }) {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const [view, setView] = useState<Point['view']>('przod');
  const [edit, setEdit] = useState(false);
  const [complication, setComplication] = useState(false);
  if (edit && p.status === 'szkic') return <ProcedureEditor patientId={patientId} draft={p} meta={meta} products={products} consents={consents} onClose={() => setEdit(false)} />;
  return (
    <Card
      title={<h3 style={{ margin: 0 }}>{p.title}</h3>}
      action={p.status === 'podpisana' ? <Badge kind="ok">{t('podpisana')}</Badge> : <Badge kind="warn">{t('szkic')}</Badge>}
    >
      <div className="stack-sm">
        <p className="small muted" style={{ margin: 0 }}>
          {fmt.dateTime(p.performedAt)} · {p.performer} · {t('cel')}: {t(p.purpose)}
          {p.indication ? ` (${p.indication})` : ''}
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>{t('Produkt')}</th>
              <th>{t('Partia')}</th>
              <th className="num">{t('Ilość')}</th>
              <th>{t('Okolica')}</th>
            </tr>
          </thead>
          <tbody>
            {p.items.map((i, k) => (
              <tr key={k}>
                <td>
                  {i.productName}
                  <span className="small muted" style={{ display: 'block' }}>
                    {t(CATEGORY_LABEL[i.category] ?? i.category)}
                    {i.manufacturer ? ` · ${i.manufacturer}` : ''}
                  </span>
                </td>
                <td>
                  {i.lot}
                  <span className="small muted" style={{ display: 'block' }}>
                    {t('ważna do')} {fmt.date(i.expiry)}
                  </span>
                </td>
                <td className="num">
                  {i.quantity} {i.unit}
                </td>
                <td>{i.area}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="proc-grid">
          <FaceMap points={p.points} view={view} setView={setView} readOnly />
          <div className="stack-sm">
            <PhotoCompare photos={p.photos} srcOf={(d) => `/api/staff/aesthetic/procedures/${p.id}/photos/${d}`} />
            <PhotoUpload procedureId={p.id} angles={meta.angles} onDone={() => void qc.invalidateQueries({ queryKey: ['aesthetic-procedures'] })} />
          </div>
        </div>
        {p.consent && (
          <p className="small" style={{ margin: 0 }}>
            <ShieldCheck size={14} aria-hidden /> {p.consent.title} · {t(CONSENT_STATUS[p.consent.status])} {p.consent.signedOn ? fmt.date(p.consent.signedOn) : ''}
          </p>
        )}
        {p.aftercare && (
          <details className="explain">
            <summary>{t('Zalecenia po zabiegu')}</summary>
            <ul className="small">
              {p.aftercare.split('\n').map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </details>
        )}
        <p className="small" style={{ margin: 0 }}>
          {p.controlOn ? `${t('Kontrola')}: ${fmt.date(p.controlOn)}` : ''}
          {p.nextOn ? ` · ${t('Kolejny zabieg')}: ${fmt.date(p.nextOn)}` : ''}
          {` · ${t('Rozliczenie')}: ${p.billing.price !== undefined ? fmt.money(p.billing.price) : '—'}, VAT ${p.billing.vat === 'zw' ? t('zw.') : `${p.billing.vat}%`}`}
        </p>
        <p className="small muted" style={{ margin: 0 }}>{t(p.billing.basis)}</p>
        <div className="btn-row">
          {p.status === 'szkic' ? (
            <Button size="sm" onClick={() => setEdit(true)}>
              {t('Edytuj i podpisz')}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" icon={<AlertTriangle size={15} />} onClick={() => setComplication(true)}>
              {t('Zgłoś powikłanie')}
            </Button>
          )}
          {p.complications > 0 && <Badge kind="warn">{t('powikłania: {n}', { n: p.complications })}</Badge>}
        </div>
      </div>
      <ComplicationModal procedure={p} meta={meta} open={complication} onClose={() => setComplication(false)} />
    </Card>
  );
}

// --- zgody pacjenta -------------------------------------------------------------------------------------------------

function ConsentsCard({ patientId, meta, consents, image }: { patientId: string; meta: Meta; consents: Consent[]; image: { documentation: boolean; marketing: boolean; texts: { documentation: string; marketing: string } } }) {
  const { t, fmt } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const [template, setTemplate] = useState('');
  const [signing, setSigning] = useState<Consent | null>(null);
  const [signedOn, setSignedOn] = useState(todayIso());
  const [method, setMethod] = useState<'papier' | 'podpis-kwalifikowany'>('papier');
  const [scan, setScan] = useState<File | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['procedure-consents', patientId] });
  const request = useMutation({ mutationFn: () => post(`/api/staff/patients/${patientId}/procedure-consents`, { templateId: template }), onSuccess: () => (setTemplate(''), refresh()), onError: (e) => toast(errorMessage(e, t), 'error') });
  const sign = useMutation({
    mutationFn: () => {
      if (scan) {
        const fd = new FormData();
        fd.set('signedOn', signedOn);
        fd.set('method', method);
        fd.set('file', scan);
        return api(`/api/staff/aesthetic/consents/${signing!.id}/signed`, { method: 'POST', form: fd });
      }
      return post(`/api/staff/aesthetic/consents/${signing!.id}/signed`, { signedOn, method });
    },
    onSuccess: () => (setSigning(null), setScan(null), refresh(), void qc.invalidateQueries({ queryKey: ['profile-tasks'] })),
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  const withdraw = useMutation({ mutationFn: (id: string) => post(`/api/staff/aesthetic/consents/${id}/withdraw`), onSuccess: refresh });
  const img = useMutation({ mutationFn: (patch: { documentation?: boolean; marketing?: boolean }) => put(`/api/staff/patients/${patientId}/image-consent`, patch), onSuccess: refresh });
  const approved = meta.templates.filter((x) => x.approval);
  return (
    <Card title={t('Zgody')}>
      <div className="stack">
        <div className="stack-sm">
          <div className="row" style={{ gap: 10 }}>
            <Switch checked={image.documentation} onChange={(v) => img.mutate({ documentation: v })} label={t('Zgoda na dokumentację fotograficzną')} />
            <strong className="small">{t('Zgoda na dokumentację fotograficzną')}</strong>
          </div>
          <p className="small muted" style={{ margin: 0 }}>{t(image.texts.documentation)}</p>
          <p className="small" style={{ margin: 0 }}>
            {t('Zgoda na wykorzystanie zdjęć w materiałach placówki')}: <strong>{image.marketing ? t('tak') : t('nie')}</strong> <span className="muted">{t('(zmienia ją pacjent w aplikacji)')}</span>
          </p>
        </div>
        <ul className="list" style={{ border: '1px solid var(--border)', borderRadius: 10 }}>
          {consents.map((c) => (
            <li key={c.id} className="list-item" style={{ flexWrap: 'wrap' }}>
              <span className="grow">
                <span className="list-title" style={{ display: 'block' }}>
                  {c.title}
                </span>
                <span className="list-sub">
                  {t(CONSENT_STATUS[c.status])}
                  {c.signedOn ? ` · ${fmt.date(c.signedOn)} · ${c.method === 'papier' ? t('podpis odręczny') : t('podpis kwalifikowany')}` : ''}
                  {c.readAt ? ` · ${t('pacjent przeczytał w aplikacji')}` : ''}
                </span>
              </span>
              {c.status === 'do-podpisu' && (
                <span className="btn-row">
                  <a className="btn secondary sm" href={`/api/staff/aesthetic/consents/${c.id}/print`} target="_blank" rel="noreferrer">
                    <Printer size={14} aria-hidden /> {t('Drukuj do podpisu')}
                  </a>
                  <Button size="sm" icon={<FileSignature size={14} />} onClick={() => setSigning(c)}>
                    {t('Podpisana')}
                  </Button>
                </span>
              )}
              {c.status !== 'wycofana' && (
                <Button size="sm" variant="ghost" onClick={() => withdraw.mutate(c.id)}>
                  {t('Wycofaj')}
                </Button>
              )}
            </li>
          ))}
          {!consents.length && <li className="list-item small muted">{t('Brak zgód na zabiegi.')}</li>}
        </ul>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <SelectField label={t('Przygotuj zgodę według wzoru')} value={template} onChange={(e) => setTemplate(e.target.value)} hint={approved.length ? undefined : t('Najpierw lekarz zatwierdza wzory (Zabiegi → Wzory zgód).')}>
            <option value="">—</option>
            {approved.map((x) => (
              <option key={x.id} value={x.id}>
                {x.title}
              </option>
            ))}
          </SelectField>
          <Button size="sm" disabled={!template} loading={request.isPending} onClick={() => request.mutate()}>
            {t('Przygotuj')}
          </Button>
        </div>
        <p className="small muted" style={{ margin: 0 }}>{t('Zgoda na zabieg o podwyższonym ryzyku wymaga formy pisemnej: wydruk podpisany odręcznie (skan w dokumentacji) albo kwalifikowany podpis elektroniczny. Pacjent może wcześniej przeczytać treść w aplikacji.')}</p>
      </div>
      <Modal open={!!signing} onClose={() => setSigning(null)} title={t('Zgoda podpisana')} footer={<Button loading={sign.isPending} onClick={() => sign.mutate()}>{t('Zapisz')}</Button>}>
        <div className="stack">
          <div className="grid-2">
            <TextField label={t('Data podpisu')} type="date" value={signedOn} max={todayIso()} onChange={(e) => setSignedOn(e.target.value)} />
            <SelectField label={t('Sposób podpisu')} value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
              <option value="papier">{t('podpis odręczny na wydruku')}</option>
              <option value="podpis-kwalifikowany">{t('kwalifikowany podpis elektroniczny')}</option>
            </SelectField>
          </div>
          <label className="field">
            <span className="label">{t('Skan podpisanej zgody (PDF, JPG, PNG) — zalecany')}</span>
            <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setScan(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      </Modal>
    </Card>
  );
}

/** Rejestracja: zgody i zgoda na zdjęcia bez dostępu do kart zabiegów (treść kliniczna — lekarz). */
export function AestheticConsentsPanel({ patientId }: { patientId: string }) {
  const meta = useQuery({ queryKey: ['aesthetic-meta'], queryFn: () => get<Meta>('/api/staff/aesthetic/meta') });
  const consents = useQuery({ queryKey: ['procedure-consents', patientId], queryFn: () => get<{ items: Consent[]; image: { documentation: boolean; marketing: boolean; texts: { documentation: string; marketing: string } } }>(`/api/staff/patients/${patientId}/procedure-consents`) });
  if (meta.isLoading || consents.isLoading) return <Skeleton />;
  if (meta.isError) return <QueryError error={meta.error} />;
  if (consents.isError) return <QueryError error={consents.error} />;
  return <ConsentsCard patientId={patientId} meta={meta.data!} consents={consents.data!.items} image={consents.data!.image} />;
}

// --- karta pacjenta: zakładka „Zabiegi” -----------------------------------------------------------------------------

export function AestheticPatientPanel({ patientId }: { patientId: string }) {
  const { t } = useI18n();
  const meta = useQuery({ queryKey: ['aesthetic-meta'], queryFn: () => get<Meta>('/api/staff/aesthetic/meta') });
  const products = useQuery({ queryKey: ['aesthetic-products'], queryFn: () => get<{ items: Product[] }>('/api/staff/aesthetic/products') });
  const consents = useQuery({ queryKey: ['procedure-consents', patientId], queryFn: () => get<{ items: Consent[]; image: { documentation: boolean; marketing: boolean; texts: { documentation: string; marketing: string } } }>(`/api/staff/patients/${patientId}/procedure-consents`) });
  const procs = useQuery({ queryKey: ['aesthetic-procedures', patientId], queryFn: () => get<{ items: Procedure[] }>(`/api/staff/aesthetic/procedures${qs({ patientId })}`) });
  const [creating, setCreating] = useState(false);
  if (meta.isLoading || products.isLoading || consents.isLoading || procs.isLoading) return <Skeleton />;
  if (meta.isError) return <QueryError error={meta.error} />;
  const m = meta.data!;
  return (
    <div className="stack">
      <ConsentsCard patientId={patientId} meta={m} consents={consents.data?.items ?? []} image={consents.data!.image} />
      {creating ? (
        <ProcedureEditor patientId={patientId} meta={m} products={products.data?.items ?? []} consents={consents.data?.items ?? []} onClose={() => setCreating(false)} />
      ) : (
        <div className="btn-row">
          <Button icon={<Plus size={15} />} onClick={() => setCreating(true)}>
            {t('Nowa karta zabiegu')}
          </Button>
        </div>
      )}
      {(procs.data?.items ?? []).map((p) => (
        <ProcedureCard key={p.id} p={p} meta={m} products={products.data?.items ?? []} consents={consents.data?.items ?? []} patientId={patientId} />
      ))}
      {!procs.data?.items.length && !creating && <Empty title={t('Brak kart zabiegów')}>{t('Karta zabiegu zapisuje produkt, numer serii, ilość, mapę iniekcji, zgodę i zdjęcia.')}</Empty>}
    </div>
  );
}

// --- panel: zabiegi, produkty, powikłania, wzory zgód ---------------------------------------------------------------

function ProductsTab() {
  const { t, fmt } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const meta = useQuery({ queryKey: ['aesthetic-meta'], queryFn: () => get<Meta>('/api/staff/aesthetic/meta') });
  const q = useQuery({ queryKey: ['aesthetic-products'], queryFn: () => get<{ items: Product[] }>('/api/staff/aesthetic/products') });
  const [np, setNp] = useState({ name: '', kind: 'toksyna', category: 'lek', manufacturer: '', unit: 'j.' as Unit });
  const [lotFor, setLotFor] = useState<Product | null>(null);
  const [lot, setLot] = useState({ lot: '', expiry: '', udi: '' });
  const [recall, setRecall] = useState<string | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ['aesthetic-products'] });
  const add = useMutation({ mutationFn: () => post('/api/staff/aesthetic/products', { ...np, manufacturer: np.manufacturer || undefined }), onSuccess: () => (setNp({ ...np, name: '', manufacturer: '' }), refresh()), onError: (e) => toast(errorMessage(e, t), 'error') });
  const addLot = useMutation({ mutationFn: () => post(`/api/staff/aesthetic/products/${lotFor!.id}/lots`, { lot: lot.lot, expiry: lot.expiry, udi: lot.udi || undefined }), onSuccess: () => (setLotFor(null), setLot({ lot: '', expiry: '', udi: '' }), refresh()), onError: (e) => toast(errorMessage(e, t), 'error') });
  const lotActive = useMutation({ mutationFn: (v: { id: string; active: boolean }) => put(`/api/staff/aesthetic/lots/${v.id}`, { active: v.active }), onSuccess: refresh });
  const recallQ = useQuery({
    queryKey: ['lot-recall', recall],
    queryFn: () => get<{ product: { name: string; manufacturer?: string }; lot: Lot; patients: { patientId: string; name: string; phone?: string; email?: string; procedures: { id: string; performedAt: string; title: string }[] }[] }>(`/api/staff/aesthetic/lots/${recall}/recall`),
    enabled: !!recall,
  });
  if (q.isLoading || meta.isLoading) return <Skeleton />;
  if (q.isError) return <QueryError error={q.error} />;
  return (
    <div className="stack">
      {q.data!.items.map((p) => (
        <Card key={p.id} title={<h3 style={{ margin: 0 }}>{p.name}</h3>} action={<Badge kind={p.requiresPhysician ? 'info' : undefined}>{p.requiresPhysician ? t('podaje lekarz') : t('bez wymogu lekarza')}</Badge>}>
          <p className="small muted" style={{ marginTop: 0 }}>
            {t(KIND_LABEL[p.kind] ?? p.kind)} · {t(CATEGORY_LABEL[p.category] ?? p.category)} {p.manufacturer ? `· ${p.manufacturer}` : ''} · {t('jednostka')}: {p.unit}
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Partia (seria)')}</th>
                  <th>{t('Ważna do')}</th>
                  <th>UDI</th>
                  <th className="num">{t('Użyta w zabiegach')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {p.lots.map((l) => (
                  <tr key={l.id}>
                    <td>
                      {l.lot} {!l.active && <Badge>{t('wycofana z użycia')}</Badge>}
                    </td>
                    <td>
                      {fmt.date(l.expiry)} {l.expired ? <Badge kind="danger">{t('po terminie')}</Badge> : l.expiringSoon ? <Badge kind="warn">{t('krótka data')}</Badge> : null}
                    </td>
                    <td className="small">{l.udi ?? '—'}</td>
                    <td className="num">{l.used}</td>
                    <td>
                      <span className="btn-row" style={{ flexWrap: 'nowrap' }}>
                        <Button size="sm" variant="ghost" icon={<Search size={14} />} onClick={() => setRecall(l.id)}>
                          {t('Kto dostał')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => lotActive.mutate({ id: l.id, active: !l.active })}>
                          {l.active ? t('Wycofaj z użycia') : t('Przywróć')}
                        </Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setLotFor(p)}>
            {t('Przyjmij partię')}
          </Button>
        </Card>
      ))}
      <Card title={t('Nowy produkt')}>
        <div className="grid-3">
          <TextField label={t('Nazwa handlowa')} value={np.name} onChange={(e) => setNp({ ...np, name: e.target.value })} maxLength={120} />
          <SelectField label={t('Rodzaj')} value={np.kind} onChange={(e) => setNp({ ...np, kind: e.target.value })}>
            {meta.data!.kinds.map((k) => (
              <option key={k} value={k}>
                {t(KIND_LABEL[k] ?? k)}
              </option>
            ))}
          </SelectField>
          <SelectField label={t('Kategoria prawna')} value={np.category} onChange={(e) => setNp({ ...np, category: e.target.value })}>
            {meta.data!.categories.map((k) => (
              <option key={k} value={k}>
                {t(CATEGORY_LABEL[k] ?? k)}
              </option>
            ))}
          </SelectField>
          <TextField label={t('Producent')} value={np.manufacturer} onChange={(e) => setNp({ ...np, manufacturer: e.target.value })} maxLength={120} />
          <SelectField label={t('Jednostka')} value={np.unit} onChange={(e) => setNp({ ...np, unit: e.target.value as Unit })}>
            {meta.data!.units.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="btn-row" style={{ marginTop: 8 }}>
          <Button size="sm" disabled={!np.name.trim()} loading={add.isPending} onClick={() => add.mutate()}>
            {t('Dodaj produkt')}
          </Button>
        </div>
      </Card>
      <Modal open={!!lotFor} onClose={() => setLotFor(null)} title={t('Przyjęcie partii — {p}', { p: lotFor?.name ?? '' })} footer={<Button disabled={!lot.lot.trim() || !lot.expiry} loading={addLot.isPending} onClick={() => addLot.mutate()}>{t('Zapisz partię')}</Button>}>
        <div className="stack">
          <div className="grid-2">
            <TextField label={t('Numer serii (LOT)')} value={lot.lot} onChange={(e) => setLot({ ...lot, lot: e.target.value })} maxLength={60} />
            <TextField label={t('Data ważności')} type="date" value={lot.expiry} onChange={(e) => setLot({ ...lot, expiry: e.target.value })} />
          </div>
          <TextField label={t('UDI (jeśli jest na opakowaniu)')} value={lot.udi} onChange={(e) => setLot({ ...lot, udi: e.target.value })} maxLength={120} />
        </div>
      </Modal>
      <Modal open={!!recall} onClose={() => setRecall(null)} title={t('Kto dostał produkt z tej partii')} wide>
        {recallQ.isLoading ? (
          <Skeleton />
        ) : recallQ.data ? (
          <div className="stack">
            <p className="small" style={{ margin: 0 }}>
              <PackageSearch size={14} aria-hidden /> {recallQ.data.product.name} · {t('partia')} {recallQ.data.lot.lot} · {t('ważna do')} {fmt.date(recallQ.data.lot.expiry)}
            </p>
            <Notice kind="info">{t('Lista do kontaktu przy komunikacie bezpieczeństwa producenta lub URPL. Odczyt jest zapisany w dzienniku dostępu.')}</Notice>
            {!recallQ.data.patients.length ? (
              <Empty title={t('Partia nie została użyta w podpisanych kartach zabiegów')} />
            ) : (
              <ul className="list">
                {recallQ.data.patients.map((pt) => (
                  <li key={pt.patientId} className="list-item" style={{ flexWrap: 'wrap' }}>
                    <span className="grow">
                      <Link to={`/panel/pacjenci/${pt.patientId}?tab=zabiegi`} className="list-title">
                        {pt.name}
                      </Link>
                      <span className="list-sub" style={{ display: 'block' }}>
                        {[pt.phone, pt.email].filter(Boolean).join(' · ') || t('brak kontaktu')} · {pt.procedures.map((x) => `${x.title} (${fmt.date(x.performedAt)})`).join(', ')}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <QueryError error={recallQ.error} />
        )}
      </Modal>
    </div>
  );
}

interface Complication {
  id: string;
  procedureId: string;
  procedureTitle: string;
  patientId: string;
  patientName: string;
  noticedOn: string;
  description: string;
  seriousness: string;
  actions?: string;
  reportTo: string;
  reportedOn?: string;
  reportRef?: string;
  status: 'otwarte' | 'zamkniete';
  lots: { product: string; lot: string }[];
}

function ComplicationsTab() {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['aesthetic-complications'], queryFn: () => get<{ items: Complication[] }>('/api/staff/aesthetic/complications') });
  const [report, setReport] = useState<string | null>(null);
  const rep = useQuery({ queryKey: ['complication-report', report], queryFn: () => get<Record<string, unknown>>(`/api/staff/aesthetic/complications/${report}/report`), enabled: !!report });
  const upd = useMutation({ mutationFn: (v: { id: string; patch: Record<string, unknown> }) => put(`/api/staff/aesthetic/complications/${v.id}`, v.patch), onSuccess: () => (void qc.invalidateQueries({ queryKey: ['aesthetic-complications'] }), void qc.invalidateQueries({ queryKey: ['profile-tasks'] })) });
  if (q.isLoading) return <Skeleton />;
  if (q.isError) return <QueryError error={q.error} />;
  return (
    <div className="stack">
      <Notice kind="info">{t('Powikłanie dodajesz w karcie zabiegu pacjenta. Decyzję o zgłoszeniu do URPL lub wytwórcy podejmuje lekarz — Eternal przygotowuje dane do formularza.')}</Notice>
      {!q.data!.items.length ? (
        <Empty title={t('Brak zapisanych powikłań')} />
      ) : (
        q.data!.items.map((c) => (
          <Card key={c.id} title={<h3 style={{ margin: 0 }}>{c.procedureTitle}</h3>} action={<Badge kind={c.status === 'otwarte' ? 'warn' : 'ok'}>{c.status === 'otwarte' ? t('otwarte') : t('zamknięte')}</Badge>}>
            <p className="small" style={{ marginTop: 0 }}>
              <Link to={`/panel/pacjenci/${c.patientId}?tab=zabiegi`}>{c.patientName}</Link> · {fmt.date(c.noticedOn)} · {t(SERIOUS_LABEL[c.seriousness] ?? c.seriousness)} · {c.lots.map((l) => `${l.product} (${l.lot})`).join(', ')}
            </p>
            <p style={{ margin: '0 0 6px' }}>{c.description}</p>
            {c.actions && <p className="small muted">{c.actions}</p>}
            <p className="small">
              {t('Zgłoszenie')}: {t(REPORT_LABEL[c.reportTo] ?? c.reportTo)}
              {c.reportedOn ? ` · ${t('zgłoszono')} ${fmt.date(c.reportedOn)}` : ''}
              {c.reportRef ? ` · ${c.reportRef}` : ''}
            </p>
            <div className="btn-row">
              <Button size="sm" variant="secondary" onClick={() => setReport(c.id)}>
                {t('Dane do zgłoszenia')}
              </Button>
              {!c.reportedOn && c.reportTo !== 'nie-dotyczy' && (
                <Button size="sm" variant="ghost" onClick={() => upd.mutate({ id: c.id, patch: { reportedOn: todayIso() } })}>
                  {t('Oznacz jako zgłoszone dziś')}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => upd.mutate({ id: c.id, patch: { status: c.status === 'otwarte' ? 'zamkniete' : 'otwarte' } })}>
                {c.status === 'otwarte' ? t('Zamknij') : t('Otwórz ponownie')}
              </Button>
            </div>
          </Card>
        ))
      )}
      <Modal open={!!report} onClose={() => setReport(null)} title={t('Dane do zgłoszenia')} wide>
        {rep.data ? <pre className="report-pre">{JSON.stringify(rep.data, null, 2)}</pre> : <Skeleton />}
      </Modal>
    </div>
  );
}

interface TemplateView {
  id: string;
  version: string;
  title: string;
  hash: string;
  sections: { heading: string; text: string[] }[];
  aftercare: string[];
  approval?: { approvedBy: string; approvedAt: string };
}

function TemplatesTab() {
  const { t, fmt } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['consent-templates'], queryFn: () => get<{ items: TemplateView[] }>('/api/staff/aesthetic/consent-templates') });
  const [who, setWho] = useState('');
  const [agree, setAgree] = useState<string | null>(null);
  const approve = useMutation({
    mutationFn: (id: string) => post(`/api/staff/aesthetic/consent-templates/${id}/approve`, { approvedBy: who }),
    onSuccess: () => (toast(t('Wzór zatwierdzony.')), setAgree(null), void qc.invalidateQueries({ queryKey: ['consent-templates'] }), void qc.invalidateQueries({ queryKey: ['aesthetic-meta'] })),
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  if (q.isLoading) return <Skeleton />;
  if (q.isError) return <QueryError error={q.error} />;
  return (
    <div className="stack">
      <Notice kind="warn" title={t('Wzory do przeglądu')}>
        {t('To ogólne projekty. Lekarz placówki czyta wzór, w razie potrzeby zgłasza zmiany i zatwierdza go imieniem, nazwiskiem i numerem prawa wykonywania zawodu. Zmiana treści wymaga ponownego zatwierdzenia.')}
      </Notice>
      <TextField label={t('Zatwierdzający lekarz (imię, nazwisko, numer PWZ)')} value={who} onChange={(e) => setWho(e.target.value)} maxLength={160} />
      {q.data!.items.map((x) => (
        <Card key={x.id} title={<h3 style={{ margin: 0 }}>{x.title}</h3>} action={x.approval ? <Badge kind="ok">{t('zatwierdzony')}</Badge> : <Badge kind="warn">{t('do zatwierdzenia')}</Badge>}>
          <p className="small muted" style={{ marginTop: 0 }}>
            {x.version} · {t('skrót')} {x.hash}
            {x.approval ? ` · ${x.approval.approvedBy} · ${fmt.dateTime(x.approval.approvedAt)}` : ''}
          </p>
          <details className="explain">
            <summary>{t('Treść wzoru i zalecenia po zabiegu')}</summary>
            {x.sections.map((s) => (
              <div key={s.heading}>
                <h4 className="small" style={{ margin: '8px 0 2px' }}>{s.heading}</h4>
                {s.text.map((l) => (
                  <p key={l} className="small" style={{ margin: '0 0 4px' }}>
                    {l}
                  </p>
                ))}
              </div>
            ))}
            <h4 className="small" style={{ margin: '8px 0 2px' }}>{t('Zalecenia po zabiegu')}</h4>
            <ul className="small">
              {x.aftercare.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </details>
          {!x.approval &&
            (agree === x.id ? (
              <div className="stack-sm">
                <Checkbox label={t('Przeczytałem(-am) wzór i zatwierdzam go do użytku w placówce.')} checked onChange={() => setAgree(null)} />
                <Button size="sm" disabled={who.trim().length < 5} loading={approve.isPending} onClick={() => approve.mutate(x.id)}>
                  {t('Zatwierdź wzór')}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setAgree(x.id)}>
                {t('Zatwierdzam treść…')}
              </Button>
            ))}
        </Card>
      ))}
    </div>
  );
}

function RecentTab() {
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['aesthetic-procedures', 'all'], queryFn: () => get<{ items: Procedure[] }>('/api/staff/aesthetic/procedures') });
  if (q.isLoading) return <Skeleton />;
  if (q.isError) return <QueryError error={q.error} />;
  return (
    <Card className="card-flush" as="section">
      {!q.data!.items.length ? (
        <Empty title={t('Brak kart zabiegów')}>{t('Kartę zabiegu zakładasz w karcie pacjenta, w zakładce „Zabiegi”.')}</Empty>
      ) : (
        <ul className="list">
          {q.data!.items.map((p) => (
            <li key={p.id}>
              <Link to={`/panel/pacjenci/${p.patientId}?tab=zabiegi`} className="list-item">
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>
                    {p.patientName} — {p.title}
                  </span>
                  <span className="list-sub">
                    {fmt.dateTime(p.performedAt)} · {p.performer} · {p.items.map((i) => `${i.productName} ${i.quantity} ${i.unit} (${i.lot})`).join(', ')}
                    {p.controlOn ? ` · ${t('kontrola')} ${fmt.date(p.controlOn)}` : ''}
                  </span>
                </span>
                {p.status === 'szkic' ? <Badge kind="warn">{t('szkic')}</Badge> : <Badge kind="ok">{t('podpisana')}</Badge>}
                {p.complications > 0 && <Badge kind="danger">{t('powikłanie')}</Badge>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function AestheticPage() {
  const { t } = useI18n();
  const [params] = useSearchParams();
  const { key } = useLocation();
  const linked = (['zabiegi', 'produkty', 'powiklania', 'zgody'] as const).find((x) => x === params.get('tab'));
  const [tab, setTab] = useState<'zabiegi' | 'produkty' | 'powiklania' | 'zgody'>(linked ?? 'zabiegi');
  useEffect(() => {
    if (linked) setTab(linked);
  }, [linked, key]);
  return (
    <div className="stack-lg">
      <PageHead title={t('Zabiegi medycyny estetycznej')} sub={t('Karty zabiegów, produkty i partie, powikłania, wzory zgód.')} />
      <Tabs
        label={t('Zabiegi')}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'zabiegi', label: t('Ostatnie zabiegi') },
          { value: 'produkty', label: t('Produkty i partie') },
          { value: 'powiklania', label: t('Powikłania') },
          { value: 'zgody', label: t('Wzory zgód') },
        ]}
      />
      {tab === 'zabiegi' && <RecentTab />}
      {tab === 'produkty' && <ProductsTab />}
      {tab === 'powiklania' && <ComplicationsTab />}
      {tab === 'zgody' && <TemplatesTab />}
    </div>
  );
}

