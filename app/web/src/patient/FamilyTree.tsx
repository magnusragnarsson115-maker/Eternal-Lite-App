import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Dna, Trash2, UserRound } from 'lucide-react';
import { useRef, useState } from 'react';
import { api, del, get } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { Button, Card, Checkbox, Empty, Notice, QueryError, Skeleton, TextField, formatBytes, useToast } from '../ui';

/**
 * Drzewo zdrowia rodziny (D4.8, F16.3) — ten sam wywiad rodzinny (A20.9) ułożony w pokolenia. Bez kolorów
 * „ryzyka” i bez wyliczeń: to tylko inny widok faktów wpisanych przez pacjenta.
 * Plik surowych danych genetycznych (F16.2) — przechowanie bez odczytu treści.
 */

export interface FamilyEntry {
  id: string;
  relationship: string;
  relationshipLabel: string;
  conditions: { code?: string; text: string; onsetAge?: number }[];
  deceased?: boolean;
  deceasedAge?: number;
}

const ROWS: { title: string; groups: { label?: string; codes: string[] }[] }[] = [
  { title: 'Dziadkowie', groups: [{ label: 'ze strony matki', codes: ['MGRMTH', 'MGRFTH'] }, { label: 'ze strony ojca', codes: ['PGRMTH', 'PGRFTH'] }] },
  { title: 'Rodzice i ich rodzeństwo', groups: [{ codes: ['MTH', 'FTH'] }, { label: 'ciotki i wujkowie', codes: ['AUNT', 'UNCLE'] }] },
  { title: 'Ty i rodzeństwo', groups: [{ codes: ['SELF', 'SIS', 'BRO'] }] },
  { title: 'Dzieci', groups: [{ codes: ['DAU', 'SON'] }] },
];

function Person({ label, entry }: { label: string; entry?: FamilyEntry }) {
  const { t } = useI18n();
  return (
    <div className={`ftree-person${entry ? '' : ' empty'}`}>
      <span className="ftree-name">
        <UserRound size={14} aria-hidden /> {t(label)}
      </span>
      {entry?.conditions.map((c, i) => (
        <span key={i} className="ftree-cond">
          {t(c.text)}
          {c.onsetAge !== undefined ? ` · ${t('od {n} r.ż.', { n: c.onsetAge })}` : ''}
        </span>
      ))}
      {entry?.deceased && <span className="ftree-cond muted">{entry.deceasedAge !== undefined ? t('zmarł(a) w wieku {n} lat', { n: entry.deceasedAge }) : t('nie żyje')}</span>}
    </div>
  );
}

export function FamilyTree({ items, labels }: { items: FamilyEntry[]; labels: Record<string, string> }) {
  const { t } = useI18n();
  const by = (code: string) => items.filter((f) => f.relationship === code);
  const ext = by('EXT');
  return (
    <Card title={t('Drzewo zdrowia rodziny')}>
      <div className="ftree" role="list" aria-label={t('Drzewo zdrowia rodziny')}>
        {ROWS.map((row) => (
          <div key={row.title} className="ftree-row" role="listitem">
            <span className="ftree-gen">{t(row.title)}</span>
            <div className="ftree-groups">
              {row.groups.map((g, gi) => (
                <div key={gi} className="ftree-group">
                  {g.label && <span className="ftree-glabel">{t(g.label)}</span>}
                  <div className="ftree-people">
                    {g.codes.flatMap((code) => {
                      if (code === 'SELF') return [<Person key="self" label="Ty" entry={{ id: 'self', relationship: 'SELF', relationshipLabel: 'Ty', conditions: [] }} />];
                      const list = by(code);
                      // rodziców i dziadków pokazujemy zawsze (puste miejsce = brak wpisu); rodzeństwo, dzieci i dalszych — tylko wpisanych
                      if (!list.length) return ['MTH', 'FTH', 'MGRMTH', 'MGRFTH', 'PGRMTH', 'PGRFTH'].includes(code) ? [<Person key={code} label={labels[code] ?? code} />] : [];
                      return list.map((e) => <Person key={e.id} label={labels[code] ?? e.relationshipLabel} entry={e} />);
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {ext.length > 0 && (
        <div className="ftree-people" style={{ marginTop: 12 }}>
          {ext.map((e) => (
            <Person key={e.id} label={labels.EXT ?? 'inny krewny'} entry={e} />
          ))}
        </div>
      )}
      <p className="small muted" style={{ marginBottom: 0 }}>{t('To widok tych samych wpisów co lista powyżej. Aplikacja nie ocenia ryzyka dziedziczenia — o tym rozmawia się z lekarzem.')}</p>
    </Card>
  );
}

interface GenomicFile {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  sha256: string;
  provider?: string;
  uploadedAt: string;
}

export function GenomicFilesCard() {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const q = useQuery({ queryKey: ['genomic-files'], queryFn: () => get<{ items: GenomicFile[]; notice: string }>('/api/me/genomic-files') });
  const [f, setF] = useState({ provider: '', confirmed: false, file: null as File | null });
  const upload = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append('provider', f.provider);
      form.append('confirmed', String(f.confirmed));
      form.append('file', f.file!);
      return api('/api/me/genomic-files', { method: 'POST', form });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['genomic-files'] });
      setF({ provider: '', confirmed: false, file: null });
      if (input.current) input.current.value = '';
      toast(t('Plik zapisany.'));
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => del(`/api/me/genomic-files/${id}`), onSuccess: () => void qc.invalidateQueries({ queryKey: ['genomic-files'] }) });
  return (
    <Card title={t('Surowe dane genetyczne (plik od dostawcy testu)')}>
      <div className="stack">
        <Notice kind="info">{t('Aplikacja tylko przechowuje ten plik. Nie odczytuje go i nie interpretuje wyników — o znaczeniu wariantów genetycznych rozmawia się z lekarzem genetykiem albo w poradni genetycznej.')}</Notice>
        <p className="small muted" style={{ margin: 0 }}>
          {t('Dane genetyczne są szczególnie chronione. Plik nie trafia do udostępnień, raportów ani kopii offline; pobrać i usunąć możesz go tylko Ty. Format: ZIP, GZ albo tekst, do 15 MB.')}
        </p>
        {q.isLoading && <Skeleton count={1} />}
        {q.isError && <QueryError error={q.error} />}
        {q.data && !q.data.items.length && <Empty icon={<Dna size={32} />} title={t('Brak zapisanych plików')} />}
        <ul className="list">
          {q.data?.items.map((g) => (
            <li key={g.id} className="list-item">
              <span className="grow">
                <span className="list-title" style={{ display: 'block' }}>{g.filename}</span>
                <span className="list-sub">{[g.provider, formatBytes(g.size), fmt.date(g.uploadedAt)].filter(Boolean).join(' · ')}</span>
                <span className="list-sub mono" style={{ display: 'block' }} title={t('Suma kontrolna SHA-256 — pozwala sprawdzić, że plik się nie zmienił')}>
                  SHA-256 {g.sha256.slice(0, 16)}…
                </span>
              </span>
              <a className="btn secondary sm" href={`/api/me/genomic-files/${g.id}/file`}>
                <Download size={14} aria-hidden /> {t('Pobierz')}
              </a>
              <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} aria-label={t('Usuń')} onClick={() => remove.mutate(g.id)} />
            </li>
          ))}
        </ul>
        <div className="grid-2">
          <TextField label={t('Dostawca testu (opcjonalnie)')} maxLength={60} value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} />
          <label className="field">
            <span className="label">{t('Plik')}</span>
            <input ref={input} type="file" accept=".zip,.gz,.txt,.csv,.tsv,text/plain,application/zip,application/gzip" onChange={(e) => setF({ ...f, file: e.target.files?.[0] ?? null })} />
          </label>
        </div>
        <Checkbox checked={f.confirmed} onChange={(e) => setF({ ...f, confirmed: e.target.checked })} label={t('Rozumiem, że aplikacja tylko przechowuje plik i niczego z niego nie odczytuje.')} />
        {upload.isError && <Notice kind="danger">{errorMessage(upload.error, t)}</Notice>}
        <Button loading={upload.isPending} disabled={!f.file || !f.confirmed} onClick={() => upload.mutate()} style={{ alignSelf: 'flex-start' }}>
          {t('Zapisz plik')}
        </Button>
      </div>
    </Card>
  );
}
