import { useQuery } from '@tanstack/react-query';
import { Download, FileJson, Plane } from 'lucide-react';
import { useState } from 'react';
import { get, withProfile } from '../api';
import { useI18n } from '../i18n';
import { Card, Empty, FullText, Notice, PageHead, QueryError, SelectField, Skeleton, TextArea, TextField } from '../ui';

/**
 * Dla lekarza i na wyjazd: raport SBAR przygotowany przez pacjenta (A4.3, F6.2), ten sam raport jako dokument FHIR
 * (A4.4) i dwujęzyczna karta zdrowia PL/EN (A24.7). Część A zawiera wyłącznie dane — ocenia lekarz.
 */

interface TravelCard {
  name: string;
  birthDate?: string;
  conditions: { pl: string; en: string }[];
  allergies?: string;
  medications: string[];
  vaccinations: string[];
  notes?: string;
  directives: { pl: string; en: string }[];
  contacts: { name: string; phone: string; relation?: string }[];
}

interface DoctorReportPreview {
  s: { reason: string; since?: string };
  b: { surveys: { title: string }[]; medications: { name: string }[]; vaccinations: unknown[]; familyHistory: unknown[] };
  a: { measurements: unknown[]; labs: unknown[]; journal: { kind: string; count: number }[] };
  r: { questions?: string };
}

function TravelCardSection() {
  const { t, fmt } = useI18n();
  const q = useQuery({ queryKey: ['travel-card'], queryFn: () => get<TravelCard>('/api/me/travel-card') });
  if (q.isLoading) return <Skeleton count={2} />;
  if (q.isError) return <QueryError error={q.error} />;
  const c = q.data!;
  return (
    <Card
      title={t('Karta zdrowia na wyjazd (PL/EN)')}
      action={
        <a className="btn sm" href={withProfile('/api/me/travel-card.pdf')} download>
          <Plane size={16} aria-hidden /> {t('Pobierz PDF')}
        </a>
      }
    >
      <p className="small muted" style={{ marginTop: 0 }}>
        {t('Po polsku i po angielsku: choroby przewlekłe z ankiety zdrowotnej, uczulenia, leki, szczepienia, dyspozycje zaznaczone do pokazania i osoby do kontaktu. Wydrukuj albo zapisz w telefonie.')}
      </p>
      <dl className="kv">
        <dt>{t('Osoba')}</dt>
        <dd>
          {c.name}
          {c.birthDate ? `, ${fmt.date(c.birthDate)}` : ''}
        </dd>
        <dt>{t('Choroby przewlekłe')}</dt>
        <dd>{c.conditions.length ? c.conditions.map((x) => x.pl).join(', ') : '—'}</dd>
        <dt>{t('Uczulenia na leki')}</dt>
        <dd>{c.allergies === undefined ? t('nie podano — wypełnij ankietę zdrowotną') : c.allergies || t('brak')}</dd>
        <dt>{t('Leki')}</dt>
        <dd>{c.medications.length ? c.medications.join('; ') : '—'}</dd>
        <dt>{t('Szczepienia')}</dt>
        <dd>{c.vaccinations.length ? c.vaccinations.join('; ') : '—'}</dd>
        <dt>{t('Dyspozycje')}</dt>
        <dd>{c.directives.length ? c.directives.map((d) => d.pl).join('; ') : '—'}</dd>
        <dt>{t('Osoby do kontaktu')}</dt>
        <dd>{c.contacts.length ? c.contacts.map((x) => `${x.name} ${x.phone}`).join('; ') : '—'}</dd>
      </dl>
    </Card>
  );
}

export function DoctorReportPage() {
  const { t } = useI18n();
  const [f, setF] = useState({ reason: '', since: '', questions: '', expectations: '', days: '90' });
  const [submitted, setSubmitted] = useState<typeof f | null>(null);
  const params = submitted
    ? new URLSearchParams(Object.entries(submitted).filter(([, v]) => v !== '') as [string, string][]).toString()
    : '';
  const preview = useQuery({ queryKey: ['doctor-report', params], queryFn: () => get<DoctorReportPreview>(`/api/me/doctor-report?${params}`), enabled: !!submitted });
  return (
    <div className="stack-lg">
      <PageHead
        title={t('Dla lekarza i na wyjazd')}
        sub={t('Przygotuj krótką informację dla lekarza (układ SBAR) albo kartę zdrowia po polsku i angielsku. Aplikacja zbiera fakty — oceny dokonuje lekarz.')}
      />
      <Card title={t('Informacje dla lekarza (SBAR)')}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted({ ...f });
          }}
        >
          <TextArea label={t('S — Z czym przychodzisz? (Twoimi słowami)')} required minLength={3} maxLength={1000} rows={3} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} />
          <div className="grid-2">
            <TextField label={t('Od kiedy? (opcjonalnie)')} maxLength={120} value={f.since} onChange={(e) => setF({ ...f, since: e.target.value })} />
            <SelectField label={t('Dane z okresu')} value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })}>
              <option value="30">{t('30 dni')}</option>
              <option value="90">{t('90 dni')}</option>
              <option value="180">{t('180 dni')}</option>
              <option value="365">{t('1 rok')}</option>
            </SelectField>
          </div>
          <TextArea label={t('R — Twoje pytania do lekarza (opcjonalnie)')} maxLength={1500} rows={3} value={f.questions} onChange={(e) => setF({ ...f, questions: e.target.value })} />
          <TextField label={t('Czego oczekujesz po wizycie? (opcjonalnie)')} maxLength={500} value={f.expectations} onChange={(e) => setF({ ...f, expectations: e.target.value })} />
          <Notice kind="info">
            <FullText text="B (tło) i A (dane) uzupełniamy z aplikacji: ankieta zdrowotna, leki, szczepienia, choroby w rodzinie, ostatnie pomiary, wyniki z zakresami z dokumentów laboratoriów i liczby z dzienników. W standardzie SBAR litera A to ocena — tej części aplikacja nie robi." />
          </Notice>
          <button type="submit" className="btn" disabled={f.reason.trim().length < 3}>
            {t('Przygotuj')}
          </button>
        </form>
      </Card>
      {submitted && (
        <Card title={t('Gotowe do pobrania')}>
          {preview.isLoading && <Skeleton count={2} />}
          {preview.isError && <QueryError error={preview.error} />}
          {preview.data && (
            <div className="stack">
              <ul className="small" style={{ margin: 0 }}>
                <li>{t('Ankiety zdrowotne: {n}', { n: preview.data.b.surveys.length })}</li>
                <li>{t('Leki: {n}', { n: preview.data.b.medications.length })}</li>
                <li>{t('Szczepienia: {n}', { n: preview.data.b.vaccinations.length })}</li>
                <li>{t('Choroby w rodzinie: {n}', { n: preview.data.b.familyHistory.length })}</li>
                <li>{t('Rodzaje pomiarów: {n}', { n: preview.data.a.measurements.length })}</li>
                <li>{t('Wyniki badań z okresu: {n}', { n: preview.data.a.labs.length })}</li>
                <li>{t('Wpisy w dziennikach: {n}', { n: preview.data.a.journal.reduce((s, j) => s + j.count, 0) })}</li>
              </ul>
              {preview.data.b.surveys.length === 0 && <Notice kind="warn">{t('Brakuje ankiety zdrowotnej — lekarz nie zobaczy chorób przewlekłych ani uczuleń. Wypełnij ją w zakładce Ankiety.')}</Notice>}
              <div className="btn-row">
                <a className="btn" href={withProfile(`/api/me/doctor-report.pdf?${params}`)} download>
                  <Download size={18} aria-hidden /> {t('Pobierz PDF')}
                </a>
                <a className="btn secondary" href={withProfile(`/api/me/fhir-bundle?${params}`)} download>
                  <FileJson size={18} aria-hidden /> {t('Pobierz plik FHIR (dla systemu placówki)')}
                </a>
              </div>
              <p className="small muted" style={{ margin: 0 }}>{t('Plik FHIR to ten sam raport w standardzie HL7 FHIR R4 — placówka może go zaimportować do swojego systemu.')}</p>
            </div>
          )}
          {!preview.data && !preview.isLoading && !preview.isError && <Empty title={t('Brak danych')} />}
        </Card>
      )}
      <TravelCardSection />
    </div>
  );
}
