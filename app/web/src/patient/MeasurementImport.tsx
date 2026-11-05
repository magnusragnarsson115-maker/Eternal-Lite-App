import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileUp } from 'lucide-react';
import { useState } from 'react';
import { post } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { Badge, Button, FullText, Modal, Notice, useToast } from '../ui';

/** Import pomiarów z pliku CSV/JSON/FHIR (A1.6): podgląd każdego wiersza przed zapisem, zapis tylko poprawnych. */

interface ImportRow {
  line: number;
  kind?: string;
  effective?: string;
  systolic?: number;
  diastolic?: number;
  value?: number;
  pulse?: number;
  unit?: string;
  status: 'ok' | 'duplicate' | 'error';
  error?: { code: string; detail?: string };
  warnings: string[];
  raw: string;
}

interface Preview {
  format: 'csv' | 'json' | 'fhir';
  rows: ImportRow[];
  summary: { total: number; ok: number; duplicate: number; error: number; warnings: number };
}

const KIND_LABEL: Record<string, string> = { bp: 'Ciśnienie', heartRate: 'Tętno', weight: 'Waga', height: 'Wzrost', temperature: 'Temperatura', spo2: 'Saturacja', glucose: 'Glukoza' };

const EXAMPLE = `data;rodzaj;wartość;skurczowe;rozkurczowe;tętno;jednostka;uwagi
12.10.2026 08:30;ciśnienie;;128;82;71;mmHg;po przebudzeniu
12.10.2026 08:35;masa ciała;78,4;;;;kg;
12.10.2026 21:10;glukoza;5,6;;;;mmol/L;`;

export function ImportMeasurementsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; content: string } | null>(null);
  const [readError, setReadError] = useState('');

  const rowMessage = (r: ImportRow): string => {
    const d = r.error?.detail ?? '';
    switch (r.error?.code) {
      case 'kind_unknown':
        return t('Nieznany rodzaj pomiaru. Użyj: ciśnienie, tętno, masa ciała, wzrost, temperatura, saturacja, glukoza.');
      case 'lab_result_row':
        return t('Wynik badania — wyniki dodajesz z dokumentu laboratorium, nie z pliku pomiarów.');
      case 'date_missing':
        return t('Brak daty.');
      case 'date_invalid':
        return t('Nieprawidłowa data. Użyj np. 12.10.2026 08:30 albo 2026-10-12 08:30.');
      case 'date_future':
        return t('Data z przyszłości.');
      case 'value_missing':
        return t('Brak wartości.');
      case 'value_invalid':
        return t('Wartość nie jest liczbą.');
      case 'value_out_of_input_range':
        return t('Wartość poza zakresem możliwym do wprowadzenia ({range}) — sprawdź, czy nie ma literówki.', { range: d });
      case 'unit_missing':
        return t('Brak jednostki — uzupełnij (oczekiwana: {unit}).', { unit: d });
      case 'unit_unexpected':
        return t('Nieobsługiwana jednostka ({unit}).', { unit: d });
      case 'diastolic_not_lower':
        return t('Ciśnienie rozkurczowe musi być niższe niż skurczowe.');
      case 'duplicate_in_file':
        return t('Ten sam pomiar występuje w pliku wcześniej.');
      case 'duplicate_existing':
        return t('Ten pomiar jest już zapisany w Twoich danych.');
      default:
        return '';
    }
  };
  const warningText = (w: string): string =>
    ({
      time_missing: t('Brak godziny — przyjęto 12:00.'),
      unit_converted: t('Przeliczono jednostkę; wartość z pliku jest w uwagach.'),
      conflict: t('Masz już inny odczyt z tej samej minuty — oba zostaną zachowane i oznaczone.'),
    })[w] ?? w;

  const preview = useMutation({ mutationFn: (content: string) => post<Preview>('/api/me/measurements/import/preview', { content, fileName: file?.name }) });
  const commit = useMutation({
    mutationFn: () => post<{ imported: number; duplicate: number; error: number }>('/api/me/measurements/import', { content: file!.content, fileName: file!.name }),
    onSuccess: (r) => {
      toast(t('Zaimportowano pomiarów: {n}. Pominięte duplikaty: {d}.', { n: r.imported, d: r.duplicate }));
      void qc.invalidateQueries({ queryKey: ['measurements'] });
      close();
    },
  });

  const close = () => {
    setFile(null);
    setReadError('');
    preview.reset();
    commit.reset();
    onClose();
  };

  const onFile = async (f: File | undefined) => {
    setReadError('');
    preview.reset();
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      setReadError(t('Plik jest zbyt duży (maks. 2 MB).'));
      return;
    }
    const content = await f.text();
    setFile({ name: f.name, content });
    preview.mutate(content);
  };

  const p = preview.data;
  const shown = p?.rows.slice(0, 300) ?? [];
  const value = (r: ImportRow) => (r.kind === 'bp' ? (r.systolic !== undefined ? `${r.systolic}/${r.diastolic}${r.pulse !== undefined ? ` · ${r.pulse} /min` : ''}` : '') : r.value !== undefined ? fmt.number(r.value) : '');

  return (
    <Modal
      open={open}
      onClose={close}
      wide
      title={t('Import pomiarów z pliku')}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {t('Anuluj')}
          </Button>
          <Button onClick={() => commit.mutate()} loading={commit.isPending} disabled={!p || p.summary.ok === 0}>
            {t('Importuję pomiary ({n})', { n: p?.summary.ok ?? 0 })}
          </Button>
        </>
      }
    >
      <div className="stack">
        <p className="small muted" style={{ margin: 0 }}>
          <FullText text="Plik CSV (np. z Excela lub aplikacji ciśnieniomierza), JSON albo eksport FHIR z Eternal. Najpierw zobaczysz każdy wiersz — zapiszemy tylko poprawne. Ponowny import tego samego pliku nie tworzy kopii." />
        </p>
        <label className="btn secondary" style={{ alignSelf: 'flex-start' }}>
          <FileUp size={18} /> {file ? t('Wybierz inny plik') : t('Wybierz plik')}
          <input type="file" accept=".csv,.json,.txt,text/csv,application/json" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
        {file && <span className="small muted">{file.name}</span>}
        {readError && <Notice kind="danger">{readError}</Notice>}
        {preview.isError && <Notice kind="danger">{errorMessage(preview.error, t)}</Notice>}
        {commit.isError && <Notice kind="danger">{errorMessage(commit.error, t)}</Notice>}

        {!file && (
          <details>
            <summary className="small">{t('Jak przygotować plik CSV')}</summary>
            <p className="small"><FullText text="Pierwszy wiersz to nagłówki. Wymagane kolumny: data, rodzaj, jednostka oraz wartość (dla ciśnienia: skurczowe i rozkurczowe). Separator: średnik albo przecinek. Przykład:" /></p>
            <pre className="small" style={{ overflowX: 'auto' }}>{EXAMPLE}</pre>
          </details>
        )}

        {preview.isPending && <p className="small muted">{t('Sprawdzam plik…')}</p>}
        {p && (
          <>
            <div className="btn-row">
              <Badge kind="ok">{t('Do zapisu: {n}', { n: p.summary.ok })}</Badge>
              {p.summary.duplicate > 0 && <Badge>{t('Duplikaty: {n}', { n: p.summary.duplicate })}</Badge>}
              {p.summary.error > 0 && <Badge kind="danger">{t('Błędy: {n}', { n: p.summary.error })}</Badge>}
              {p.summary.warnings > 0 && <Badge kind="warn">{t('Uwagi: {n}', { n: p.summary.warnings })}</Badge>}
            </div>
            <div className="table-wrap" style={{ maxHeight: 360, overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col" className="num">{t('Wiersz')}</th>
                    <th scope="col">{t('Data')}</th>
                    <th scope="col">{t('Rodzaj')}</th>
                    <th scope="col" className="num">{t('Wartość')}</th>
                    <th scope="col">{t('Stan')}</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.line}>
                      <td className="num">{r.line}</td>
                      <td className="nowrap">{r.effective ? fmt.dateTime(r.effective) : <span className="small muted">{r.raw}</span>}</td>
                      <td>{r.kind ? t(KIND_LABEL[r.kind] ?? r.kind) : '—'}</td>
                      <td className="num">
                        {value(r)} {r.unit}
                      </td>
                      <td>
                        {r.status === 'ok' ? <Badge kind="ok">{t('do zapisu')}</Badge> : r.status === 'duplicate' ? <Badge>{t('pominięty')}</Badge> : <Badge kind="danger">{t('błąd')}</Badge>}
                        {r.error && <div className="small">{rowMessage(r)}</div>}
                        {r.warnings.map((w) => (
                          <div key={w} className="small muted">
                            {warningText(w)}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {p.rows.length > shown.length && <p className="small muted">{t('Pokazano pierwsze {n} wierszy z {total}.', { n: shown.length, total: p.rows.length })}</p>}
            <p className="small muted" style={{ margin: 0 }}>{t('Aplikacja nie ocenia pomiarów — sprawdza tylko format, jednostki i literówki.')}</p>
          </>
        )}
      </div>
    </Modal>
  );
}
