import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Camera, Fingerprint, MessageCircleQuestion, SlidersHorizontal } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { api, get, put, qs } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { fieldLabel, HealthTimeline, ResultDetailModal, SnapshotSections, WhatChangedList, type SnapshotResponse } from '../shared/HealthViews';
import { Badge, Button, Card, Checkbox, Modal, Notice, QueryError, SelectField, Skeleton, TextArea, TextField, useToast } from '../ui';
import { PatientCasesCard } from './WorkspacePage';

const Avatar3D = lazy(() => import('../shared/Avatar3D').then((m) => ({ default: m.Avatar3D })));

interface Correction {
  id: string;
  intakeId: string;
  field: string;
  autoValue?: string;
  correctedValue?: string;
  actorKind: 'patient' | 'clinician';
  actorName?: string;
  at: string;
  sourceText?: string;
}

interface InterviewSummary {
  reason: string[];
  duration?: string;
  symptoms: string[];
  negatives: string[];
  unsure: string[];
  meds: string[];
  conditions: string[];
  allergies: string[];
  risk: string[];
  issues: string[];
  other: { question: string; answer: string }[];
}
interface InterviewView {
  id: string;
  title: string;
  version: string;
  approved: boolean;
  completedAt?: string;
  summary?: InterviewSummary;
  engine?: 'tree' | 'infermedica';
}

function useRegionLabels(): Record<string, string> {
  const { t } = useI18n();
  return {
    head: t('Głowa'),
    neck: t('Szyja'),
    heart: t('Klatka piersiowa'),
    lungs: t('Klatka piersiowa — płuca'),
    liver: t('Brzuch — prawa strona'),
    pancreas: t('Brzuch — lewa strona'),
    kidneys: t('Plecy (okolica nerek)'),
    blood: t('Przedramię / dłoń'),
    arms: t('Ramię'),
    legs: t('Nogi'),
    body: t('Inna okolica'),
  };
}

function DisplayFilterForm({ onSaved }: { onSaved: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const q = useQuery({ queryKey: ['display-filter'], queryFn: () => get<{ bpSystolic?: number; bpDiastolic?: number; glucose?: number }>('/api/staff/display-filter') });
  const [v, setV] = useState<{ s?: string; d?: string; g?: string } | null>(null);
  const cur = v ?? { s: q.data?.bpSystolic?.toString() ?? '', d: q.data?.bpDiastolic?.toString() ?? '', g: q.data?.glucose?.toString() ?? '' };
  const num = (x?: string) => (x && x.trim() ? Number(x) : undefined);
  const save = useMutation({
    mutationFn: () => put('/api/staff/display-filter', { bpSystolic: num(cur.s), bpDiastolic: num(cur.d), glucose: num(cur.g) }),
    onSuccess: () => {
      toast(t('Zapisano Twój filtr wyświetlania.'));
      onSaved();
    },
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  return (
    <details className="filter-box">
      <summary>
        <SlidersHorizontal size={14} aria-hidden /> {t('Twój filtr wyświetlania pomiarów')}
      </summary>
      <p className="small muted">{t('Wpisz wartości, od których chcesz widzieć pomiary wyróżnione w zestawieniu. To Twoje ustawienie — aplikacja nie ma własnych progów i nie wysyła alarmów.')}</p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <TextField label={t('Ciśnienie skurczowe ≥')} inputMode="numeric" value={cur.s} onChange={(e) => setV({ ...cur, s: e.target.value })} style={{ width: 110 }} />
        <TextField label={t('rozkurczowe ≥')} inputMode="numeric" value={cur.d} onChange={(e) => setV({ ...cur, d: e.target.value })} style={{ width: 110 }} />
        <TextField label={t('Glukoza ≥ (mg/dL)')} inputMode="numeric" value={cur.g} onChange={(e) => setV({ ...cur, g: e.target.value })} style={{ width: 130 }} />
        <Button size="sm" variant="secondary" loading={save.isPending} onClick={() => save.mutate()}>
          {t('Zapisz')}
        </Button>
      </div>
    </details>
  );
}

function PhotoModal({ patientId, open, onClose }: { patientId: string; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const regions = useRegionLabels();
  const [file, setFile] = useState<File | null>(null);
  const [region, setRegion] = useState('arms');
  const [note, setNote] = useState('');
  const [consent, setConsent] = useState(false);
  const send = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.set('region', region);
      fd.set('note', note);
      fd.set('consent', consent ? 'true' : 'false');
      fd.set('file', file!);
      return api(`/api/staff/patients/${patientId}/photos`, { method: 'POST', form: fd });
    },
    onSuccess: () => {
      toast(t('Zapisano zdjęcie w dokumentacji.'));
      void qc.invalidateQueries({ queryKey: ['snapshot', patientId] });
      setFile(null);
      setNote('');
      setConsent(false);
      onClose();
    },
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Dokumentacja fotograficzna')}
      footer={
        <Button disabled={!file || !consent} loading={send.isPending} onClick={() => send.mutate()}>
          {t('Zapisz w dokumentacji')}
        </Button>
      }
    >
      <div className="stack">
        <Notice kind="info">{t('Zdjęcie trafia do dokumentacji jako obraz — aplikacja go nie analizuje (ocena zmian skórnych to wyrób medyczny i system AI wysokiego ryzyka). Ocenę opisuje lekarz w notatce.')}</Notice>
        <label className="field">
          <span className="label">{t('Zdjęcie (JPG lub PNG, do 10 MB)')}</span>
          <input type="file" accept="image/jpeg,image/png" capture="environment" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </label>
        <SelectField label={t('Okolica ciała')} value={region} onChange={(e) => setRegion(e.target.value)}>
          {Object.entries(regions).map(([r, label]) => (
            <option key={r} value={r}>
              {label}
            </option>
          ))}
        </SelectField>
        <TextArea label={t('Opis (opcjonalnie)')} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} />
        <Checkbox label={t('Pacjent zgodził się na wykonanie i zapisanie zdjęcia')} checked={consent} onChange={(e) => setConsent(e.target.checked)} />
      </div>
    </Modal>
  );
}

function InterviewsCard({ patientId }: { patientId: string }) {
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['staff-interviews', patientId], queryFn: () => get<{ items: InterviewView[] }>(`/api/staff/patients/${patientId}/interviews`), retry: false });
  if (q.isError || !q.data?.items.length) return null;
  const s = q.data.items[0];
  const line = (label: string, v: string[] | string | undefined) =>
    v && (Array.isArray(v) ? v.length : true) ? (
      <div className="iv-line">
        <span className="small muted">{label}</span>
        <span>{Array.isArray(v) ? v.join('; ') : v}</span>
      </div>
    ) : null;
  return (
    <Card title={t('Wywiad przed wizytą — podsumowanie')} action={<MessageCircleQuestion size={18} aria-hidden />}>
      <p className="small muted">
        {s.title} · {s.completedAt ? fmt.dateTime(s.completedAt) : ''} {!s.approved && <Badge>{t('drzewo pytań: projekt')}</Badge>}
      </p>
      {s.summary && (
        <div className="iv-summary">
          {line(t('Powód wizyty'), s.summary.reason)}
          {line(t('Od kiedy'), s.summary.duration)}
          {line(t('Objawy zgłoszone'), s.summary.symptoms)}
          {line(t('Objawy, którym pacjent zaprzeczył'), s.summary.negatives)}
          {line(t('„Nie wiem” — do wyjaśnienia'), s.summary.unsure)}
          {line(t('Leki'), s.summary.meds)}
          {line(t('Choroby'), s.summary.conditions)}
          {line(t('Uczulenia'), s.summary.allergies)}
          {line(t('Czynniki ryzyka podane przez pacjenta'), s.summary.risk)}
          {line(t('Do omówienia'), s.summary.issues)}
          {s.summary.other.map((o, i) => (
            <div className="iv-line" key={i}>
              <span className="small muted">{o.question}</span>
              <span>{o.answer}</span>
            </div>
          ))}
        </div>
      )}
      <p className="small muted">{t('Przepisane odpowiedzi pacjenta — bez punktacji i bez oceny.')}</p>
    </Card>
  );
}

function CorrectionsCard({ patientId }: { patientId: string }) {
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['corrections', patientId], queryFn: () => get<{ items: Correction[] }>(`/api/staff/patients/${patientId}/corrections`) });
  if (!q.data?.items.length) return null;
  return (
    <Card title={t('Poprawki odczytu dokumentów')}>
      <ul className="plain stack-sm">
        {q.data.items.slice(0, 12).map((c) => (
          <li key={c.id} className="small">
            <Badge kind="info">{t('poprawione')}</Badge> {fieldLabel(c.field, t)}: <span className="mono">{c.autoValue ?? '—'}</span> → <span className="mono">{c.correctedValue ?? '—'}</span> ·{' '}
            {c.actorName ?? (c.actorKind === 'patient' ? t('pacjent') : t('personel'))} · <span className="muted">{fmt.dateTime(c.at)}</span>
            {c.sourceText && <div className="mono muted">„{c.sourceText}”</div>}
          </li>
        ))}
      </ul>
      <p className="small muted">{t('Każda poprawka: odczyt automatyczny → poprawka → kto → kiedy. Zanonimizowane poprawki zasilają słownik mapowania.')}</p>
    </Card>
  );
}

/** Badania obrazowe pacjenta w licencjonowanej przeglądarce 3D placówki (np. certyfikowanej do anatomii z CT/MR) — uruchomienie linkiem. */
function Imaging3DLink({ patientId }: { patientId: string }) {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ['imaging-viewer', patientId], queryFn: () => get<{ configured: boolean; url?: string; name?: string }>(`/api/staff/patients/${patientId}/imaging-viewer`), retry: false });
  if (!q.data?.configured || !q.data.url) return null;
  return (
    <a className="btn secondary sm" href={q.data.url} target="_blank" rel="noreferrer">
      <Box size={16} aria-hidden /> {t('Anatomia 3D z badań ({n})', { n: q.data.name ?? t('przeglądarka placówki') })}
    </a>
  );
}

export function SnapshotPanel({ patientId, patientName }: { patientId: string; patientName: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [region, setRegion] = useState<string | undefined>();
  const [detail, setDetail] = useState<string | null>(null);
  const [photo, setPhoto] = useState(false);
  const q = useQuery({ queryKey: ['snapshot', patientId], queryFn: () => get<SnapshotResponse>(`/api/staff/patients/${patientId}/snapshot`) });
  if (q.isLoading) return <Skeleton count={3} height={120} />;
  if (q.isError) return <QueryError error={q.error} retry={() => void q.refetch()} />;
  const { snapshot: s, avatar, whatChanged } = q.data!;
  const reg = region ? avatar.regions.find((r) => r.key === region) : undefined;
  return (
    <div className="stack-lg">
      <div className="snap-head">
        <div>
          <div className="eternal-id">
            <Fingerprint size={16} aria-hidden /> <span className="mono">{s.patient.eternalId}</span>
          </div>
          <div className="small muted">
            {s.patient.age !== undefined ? t('{n} lat', { n: s.patient.age }) : ''} {s.patient.gender === 'female' ? t('kobieta') : s.patient.gender === 'male' ? t('mężczyzna') : ''}
          </div>
        </div>
        <div className="btn-row">
          <Imaging3DLink patientId={patientId} />
          <Button size="sm" variant="secondary" icon={<Camera size={16} />} onClick={() => setPhoto(true)}>
            {t('Zdjęcie do dokumentacji')}
          </Button>
        </div>
      </div>
      {s.alerts.length > 0 && (
        <ul className="org-alerts" aria-label={t('Informacje organizacyjne')}>
          {s.alerts.map((a, i) => (
            <li key={i} data-kind={a.kind}>
              {t(a.text)}
            </li>
          ))}
        </ul>
      )}
      <div className="snap-top">
        <Card title={t('Avatar danych')} className="avatar-card">
          <Suspense fallback={<Skeleton count={1} height={300} />}>
            <Avatar3D data={avatar} selected={region} onSelect={(k) => setRegion((x) => (x === k ? undefined : k))} />
          </Suspense>
          {reg && (
            <div className="region-detail">
              <strong>{t(reg.label)}</strong> · {t('{n} danych', { n: reg.count })}
              <div className="small muted">{reg.topics.join(', ')}</div>
            </div>
          )}
        </Card>
        <Card title={t('Co się zmieniło')}>
          <WhatChangedList wc={whatChanged} extra={<DisplayFilterForm onSaved={() => void qc.invalidateQueries({ queryKey: ['snapshot', patientId] })} />} />
        </Card>
      </div>
      <div className="snap-cols">
        <Card title={t('Medical Snapshot')} className="snap-card">
          <SnapshotSections s={s} onResult={(key) => setDetail(`/api/staff/patients/${patientId}/snapshot/result${qs({ key })}`)} />
        </Card>
        <div className="stack">
          <InterviewsCard patientId={patientId} />
          <PatientCasesCard patientId={patientId} patientName={patientName} />
          <CorrectionsCard patientId={patientId} />
        </div>
      </div>
      <ResultDetailModal url={detail} fileBase="/api/staff/files" onClose={() => setDetail(null)} />
      <PhotoModal patientId={patientId} open={photo} onClose={() => setPhoto(false)} />
    </div>
  );
}

export function TimelinePanel({ patientId }: { patientId: string }) {
  const { t } = useI18n();
  return (
    <Card title={t('Oś czasu zdrowia')}>
      <HealthTimeline url={`/api/staff/patients/${patientId}/health-timeline`} />
    </Card>
  );
}
