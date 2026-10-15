import { Check, Eye, FileText, Pencil, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../i18n';
import type { IntakeField, IntakeView } from '../mvp-types';
import { Badge, Button, Notice, TextField } from '../ui';
import { SourceSnippet } from './SourceSnippet';

export type FieldAction = { id: string; action: 'confirm' | 'correct' | 'reject'; name?: string; value?: string; unit?: string; rangeText?: string };

export const KIND_PL: Record<string, string> = {
  lab: 'Wyniki badań laboratoryjnych',
  discharge: 'Karta informacyjna (wypis ze szpitala)',
  imaging: 'Opis badania obrazowego',
  referral: 'Skierowanie',
  prescription: 'Recepta',
  certificate: 'Zaświadczenie',
  other: 'Dokument medyczny',
  unknown: 'Dokument',
};

export function IntakeStatusBadge({ item }: { item: Pick<IntakeView, 'status' | 'counts'> }) {
  const { t } = useI18n();
  switch (item.status) {
    case 'processing':
      return <Badge kind="info">{t('Odczytywanie…')}</Badge>;
    case 'needs_review':
      return <Badge kind="warn">{t('Do potwierdzenia')}</Badge>;
    case 'submitted':
      return <Badge kind="warn">{t('Zapisane, {n} pól niepotwierdzonych', { n: item.counts.pending })}</Badge>;
    case 'confirmed':
      return <Badge kind="ok">{t('Gotowe')}</Badge>;
    case 'unreadable':
      return <Badge>{t('Bez odczytu tekstu')}</Badge>;
    default:
      return <Badge kind="danger">{t('Błąd odczytu')}</Badge>;
  }
}

function FieldRow({ f, editable, onAct, source }: { f: IntakeField; editable: boolean; onAct: (a: FieldAction) => void; source?: { fileUrl: string; contentType: string; page: number; box?: [number, number, number, number] } }) {
  const { t } = useI18n();
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState({ value: f.value, unit: f.unitRaw ?? f.unit ?? '', rangeText: f.rangeText ?? '' });
  const uncertain = f.state === 'pending' && f.confidence !== 'high';
  const stateBadge =
    f.state === 'confirmed' ? <Badge kind="ok">{t('potwierdzone')}</Badge> : f.state === 'corrected' ? <Badge kind="ok">{t('poprawione')}</Badge> : f.state === 'rejected' ? <Badge>{t('pominięte')}</Badge> : uncertain ? <Badge kind="warn">{t('sprawdź')}</Badge> : <Badge kind="info">{t('do potwierdzenia')}</Badge>;
  return (
    <li className="obs-item" style={{ background: uncertain ? 'var(--warning-soft)' : undefined, borderRadius: 10, padding: 12, opacity: f.state === 'rejected' ? 0.55 : 1 }}>
      <div className="row-between" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div className="grow">
          <div className="obs-name">
            {f.name} {f.match && f.match.pl !== f.name && <span className="muted small">({f.match.pl})</span>}
          </div>
          <div style={{ fontSize: '1.15rem', fontWeight: 600 }} className="tabular">
            {f.value} <span className="muted" style={{ fontWeight: 400 }}>{f.unitRaw ?? f.unit ?? ''}</span>
            {f.flag && (
              <span className="badge" style={{ marginLeft: 8 }} title={t('Oznaczenie wydrukowane przez laboratorium')}>
                {t('oznaczenie lab.: {f}', { f: f.flag })}
              </span>
            )}
          </div>
          <div className="small muted">
            {f.rangeText ? t('Zakres z dokumentu: {r}', { r: f.rangeText }) : t('Brak zakresu w dokumencie')}
            {f.match && <> · LOINC {f.match.loinc}</>}
          </div>
          <div className="small" style={{ marginTop: 6, fontFamily: 'var(--mono)', background: 'var(--surface-3)', padding: '4px 8px', borderRadius: 6 }} title={t('Wiersz z dokumentu')}>
            <FileText size={12} aria-hidden /> {t('wiersz {n}', { n: f.line + 1 })}: „{f.sourceText}”
          </div>
          {source && <SourceSnippet fileUrl={source.fileUrl} contentType={source.contentType} page={source.page} box={source.box} text={f.sourceText} />}
          {f.issues.length > 0 && f.state === 'pending' && (
            <div className="small" style={{ color: 'var(--warning)', marginTop: 4 }}>
              {f.issues.map((i) => ISSUE_PL[i] ?? i).map((s) => t(s)).join(' · ')}
            </div>
          )}
          {f.original && <div className="small muted">{t('Odczyt maszynowy przed poprawką: {v}', { v: `${f.original.value} ${f.original.unit ?? ''}` })}</div>}
        </div>
        {stateBadge}
      </div>
      {edit && (
        <div className="grid-3" style={{ marginTop: 10 }}>
          <TextField label={t('Wynik')} value={v.value} onChange={(e) => setV({ ...v, value: e.target.value })} />
          <TextField label={t('Jednostka')} value={v.unit} onChange={(e) => setV({ ...v, unit: e.target.value })} />
          <TextField label={t('Zakres z dokumentu')} value={v.rangeText} onChange={(e) => setV({ ...v, rangeText: e.target.value })} />
        </div>
      )}
      {editable && f.state !== 'rejected' && (
        <div className="btn-row" style={{ marginTop: 10 }}>
          {edit ? (
            <>
              <Button size="sm" icon={<Check size={16} />} onClick={() => (onAct({ id: f.id, action: 'correct', value: v.value, unit: v.unit, rangeText: v.rangeText }), setEdit(false))}>
                {t('Zapisz poprawkę')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEdit(false)}>
                {t('Anuluj')}
              </Button>
            </>
          ) : (
            <>
              {f.state === 'pending' && (
                <Button size="sm" icon={<Check size={16} />} onClick={() => onAct({ id: f.id, action: 'confirm' })}>
                  {t('Zgadza się')}
                </Button>
              )}
              <Button size="sm" variant="secondary" icon={<Pencil size={16} />} onClick={() => setEdit(true)}>
                {t('Popraw')}
              </Button>
              {f.state === 'pending' && (
                <Button size="sm" variant="ghost" icon={<X size={16} />} onClick={() => onAct({ id: f.id, action: 'reject' })}>
                  {t('To nie jest wynik')}
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}

const ISSUE_PL: Record<string, string> = {
  not_in_dictionary: 'Nazwa spoza słownika badań',
  name_corrected: 'Nazwa poprawiona automatycznie — sprawdź',
  unit_missing: 'Brak jednostki',
  unit_unexpected: 'Nietypowa jednostka dla tego badania',
  value_not_numeric: 'Wartość nie jest liczbą',
};

/**
 * Ekran potwierdzania odczytu (P3, A2.3): pola z pewnością, wiersz źródłowy z dokumentu, poprawka, pominięcie.
 * Wspólny dla strony pod linkiem, aplikacji pacjenta i panelu lekarza.
 */
export function IntakeReview({
  item,
  fileUrl,
  editable,
  busy,
  submitLabel,
  onReview,
  onSubmit,
}: {
  item: IntakeView;
  fileUrl: string;
  editable: boolean;
  busy?: boolean;
  submitLabel: string;
  onReview: (items: FieldAction[]) => void;
  onSubmit: () => void;
}) {
  const { t, fmt } = useI18n();
  const ex = item.extract;
  const items = ex?.items ?? [];
  const pendingHigh = items.filter((i) => i.state === 'pending' && i.confidence === 'high');
  const ai = ex?.engine.ai;
  return (
    <div className="stack">
      <div className="row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div>
          <strong>{t(KIND_PL[item.kind] ?? 'Dokument')}</strong>
          <div className="small muted">
            {item.laboratory && <>{item.laboratory} · </>}
            {item.collectedAt ? t('data z dokumentu: {d}', { d: fmt.date(item.collectedAt) }) : t('bez daty w dokumencie')}
          </div>
        </div>
        <a className="btn secondary sm" href={fileUrl} target="_blank" rel="noreferrer">
          <Eye size={16} /> {t('Zobacz oryginał')}
        </a>
      </div>
      <Notice kind="info">
        <span className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
          <Sparkles size={16} aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            {ai && !ai.demo ? t('Odczyt maszynowy: program i model AI ({m}). Może zawierać błędy — sprawdź pola na żółto.', { m: ai.model }) : t('Odczyt maszynowy (program). Może zawierać błędy — sprawdź pola na żółto.')}{' '}
            {t('Nic nie jest oceniane: zakres i oznaczenia pochodzą z dokumentu.')}
          </span>
        </span>
      </Notice>
      {item.status === 'unreadable' && <Notice kind="warn">{t('Nie udało się odczytać tekstu z tego pliku. Lekarz zobaczy oryginał.')}</Notice>}
      {ex?.kind === 'lab' && items.length === 0 && <Notice kind="warn">{t('W dokumencie nie rozpoznano wyników badań. Lekarz zobaczy oryginał.')}</Notice>}
      {items.length > 0 && (
        <>
          {editable && pendingHigh.length > 1 && (
            <Button variant="secondary" size="sm" icon={<Check size={16} />} disabled={busy} onClick={() => onReview(pendingHigh.map((i) => ({ id: i.id, action: 'confirm' })))}>
              {t('Potwierdź wszystkie pewne ({n})', { n: pendingHigh.length })}
            </Button>
          )}
          <ul className="obs-list stack" style={{ listStyle: 'none', padding: 0 }}>
            {items.map((f) => (
              <FieldRow
                key={f.id}
                f={f}
                editable={editable && !busy}
                onAct={(a) => onReview([a])}
                source={{ fileUrl, contentType: item.contentType, page: ex?.lines[f.line]?.page ?? f.page, box: ex?.lines[f.line]?.box }}
              />
            ))}
          </ul>
        </>
      )}
      {ex?.doc && (
        <div className="stack">
          {ex.doc.issuer && <div className="small muted">{ex.doc.issuer}</div>}
          {ex.doc.accessCode && (
            <div>
              {t('Kod dostępu z dokumentu')}: <strong className="mono">{ex.doc.accessCode}</strong>
            </div>
          )}
          {ex.doc.sections.map((s, i) => (
            <div key={i} className="card" style={{ padding: 12 }}>
              <strong>{s.title}</strong>
              <p className="small" style={{ whiteSpace: 'pre-wrap', margin: '4px 0 0' }}>
                {s.lines.map((n) => ex.lines[n - 1]?.text ?? '').join('\n')}
              </p>
            </div>
          ))}
          <p className="small muted">{t('Treść sekcji jest skopiowana z dokumentu bez zmian.')}</p>
        </div>
      )}
      {editable && ['needs_review', 'unreadable'].includes(item.status) && (
        <div className="stack">
          {items.some((i) => i.state === 'pending') && <p className="small muted">{t('Pól, których nie potwierdzisz, lekarz zobaczy jako „odczyt maszynowy, niepotwierdzony”.')}</p>}
          <Button block loading={busy} icon={<Check size={18} />} onClick={onSubmit}>
            {submitLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
