import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { get, post, put, qs } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { Badge, Button, Card, Combobox, Empty, Notice, QueryError, SelectField, Skeleton, TextArea, TextField, useToast } from '../ui';

/**
 * Rozpoznania z kodem ICD-10 (A12.6): lekarz wybiera kod ze słownika i zapisuje rozpoznanie (FHIR Condition).
 * Aplikacja nie podpowiada rozpoznań na podstawie danych pacjenta — słownik tylko wyszukuje po nazwie lub kodzie.
 */

interface CodeHit {
  code: string;
  display: string;
  displayPl?: string;
  system: string;
  source: 'local' | 'nlm' | 'who';
}

interface Diagnosis {
  id: string;
  code: string;
  display: string;
  system: string;
  status: 'active' | 'resolved' | 'inactive';
  onset?: string;
  recordedDate?: string;
  recorder?: string;
  note?: string;
}

const STATUS_LABEL: Record<Diagnosis['status'], string> = { active: 'aktywne', resolved: 'ustąpiło', inactive: 'nieaktywne' };
const CM = 'http://hl7.org/fhir/sid/icd-10-cm';

export function DiagnosesPanel({ patientId }: { patientId: string }) {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['diagnoses', patientId], queryFn: () => get<{ items: Diagnosis[]; dictionary: 'imported' | 'common' }>(`/api/staff/patients/${patientId}/diagnoses`) });
  const [pick, setPick] = useState<CodeHit | null>(null);
  const [f, setF] = useState({ onset: '', note: '' });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['diagnoses', patientId] });
  const add = useMutation({
    mutationFn: () => post(`/api/staff/patients/${patientId}/diagnoses`, { code: pick!.code, display: pick!.displayPl ?? pick!.display, system: pick!.system, onset: f.onset || undefined, note: f.note || undefined }),
    onSuccess: () => {
      refresh();
      setPick(null);
      setF({ onset: '', note: '' });
      toast(t('Rozpoznanie zapisane.'));
    },
  });
  const status = useMutation({ mutationFn: (v: { id: string; status: string }) => put(`/api/staff/diagnoses/${v.id}`, { status: v.status }), onSuccess: refresh });
  const search = async (term: string, signal: AbortSignal) => (await get<{ hits: CodeHit[] }>(`/api/staff/diagnosis-codes${qs({ q: term })}`, signal)).hits;
  return (
    <div className="stack">
      {q.isLoading && <Skeleton count={2} />}
      {q.isError && <QueryError error={q.error} />}
      {q.data && !q.data.items.length && <Empty title={t('Brak zapisanych rozpoznań')} />}
      {!!q.data?.items.length && (
        <div className="card card-flush">
          <ul className="list">
            {q.data.items.map((d) => (
              <li key={d.id} className="list-item">
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>
                    <span className="mono">{d.code}</span> {d.display} {d.system === CM && <Badge kind="warn">ICD-10-CM</Badge>}
                  </span>
                  <span className="list-sub">
                    {[d.onset && t('od {d}', { d: fmt.date(d.onset) }), d.recorder, d.recordedDate && fmt.date(d.recordedDate), d.note].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <SelectField label={t('Stan')} value={d.status} onChange={(e) => status.mutate({ id: d.id, status: e.target.value })}>
                  {(Object.keys(STATUS_LABEL) as Diagnosis['status'][]).map((s) => (
                    <option key={s} value={s}>
                      {t(STATUS_LABEL[s])}
                    </option>
                  ))}
                </SelectField>
                <Button size="sm" variant="ghost" onClick={() => status.mutate({ id: d.id, status: 'entered-in-error' })}>
                  {t('Wpis błędny')}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Card title={t('Dodaj rozpoznanie')}>
        <div className="stack">
          <Combobox<CodeHit>
            label={t('Kod ICD-10 albo nazwa')}
            placeholder={t('np. I10, nadciśnienie, astma')}
            search={search}
            render={(h) => (
              <span>
                <span className="mono">{h.code}</span> {h.displayPl ?? h.display} {h.source === 'nlm' && <span className="small muted">· ICD-10-CM (USA)</span>}
              </span>
            )}
            onSelect={setPick}
            hint={q.data?.dictionary === 'imported' ? t('Pełny słownik ICD-10 z importu.') : t('Lista najczęstszych rozpoznań — pełny słownik po imporcie przez administratora.')}
          />
          {pick && (
            <Notice kind={pick.source === 'nlm' ? 'warn' : 'info'} title={`${pick.code} ${pick.displayPl ?? pick.display}`}>
              {pick.source === 'nlm' ? t('Kod z amerykańskiej wersji ICD-10-CM — sprawdź zgodność z polskim wydaniem ICD-10 przed zapisem.') : t('Kod ze słownika ICD-10.')}
            </Notice>
          )}
          <div className="grid-2">
            <TextField label={t('Od kiedy (opcjonalnie)')} type="date" value={f.onset} onChange={(e) => setF({ ...f, onset: e.target.value })} />
          </div>
          <TextArea label={t('Uwagi (opcjonalnie)')} rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          {add.isError && <Notice kind="danger">{errorMessage(add.error, t)}</Notice>}
          <Button disabled={!pick} loading={add.isPending} onClick={() => add.mutate()} style={{ alignSelf: 'flex-start' }}>
            {t('Zapisz rozpoznanie')}
          </Button>
        </div>
      </Card>
    </div>
  );
}
