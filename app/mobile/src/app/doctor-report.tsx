import { useState } from 'react';
import { Alert } from 'react-native';
import { Button, Card, Chips, Field, Notice, P, Screen } from '../components/ui';
import { errorMessage } from '../lib/errors';
import { downloadAndSharePdf } from '../lib/files';
import { useI18n } from '../lib/i18n';

/**
 * Dla lekarza i na wyjazd (A4.3/F6.2 SBAR, A24.7 karta PL/EN) — PDF do udostępnienia z telefonu. Część A raportu
 * zawiera tylko dane z aplikacji; ocenia lekarz.
 */
export default function DoctorReportScreen() {
  const { t } = useI18n();
  const [f, setF] = useState({ reason: '', since: '', questions: '' });
  const [days, setDays] = useState(90);
  const [busy, setBusy] = useState<'sbar' | 'travel'>();
  const share = async (kind: 'sbar' | 'travel') => {
    setBusy(kind);
    try {
      if (kind === 'sbar') {
        const q = new URLSearchParams({ reason: f.reason, days: String(days), ...(f.since ? { since: f.since } : {}), ...(f.questions ? { questions: f.questions } : {}) }).toString();
        await downloadAndSharePdf(`/api/me/doctor-report.pdf?${q}`, 'dla-lekarza.pdf', t('Informacje dla lekarza (SBAR)'));
      } else {
        await downloadAndSharePdf('/api/me/travel-card.pdf', 'karta-zdrowia.pdf', t('Karta zdrowia na wyjazd (PL/EN)'));
      }
    } catch (e) {
      Alert.alert(errorMessage(e, t));
    } finally {
      setBusy(undefined);
    }
  };
  return (
    <Screen>
      <P muted>{t('Przygotuj krótką informację dla lekarza (układ SBAR) albo kartę zdrowia po polsku i angielsku. Aplikacja zbiera fakty — oceny dokonuje lekarz.')}</P>
      <Card title={t('Informacje dla lekarza (SBAR)')}>
        <Field label={t('S — Z czym przychodzisz? (Twoimi słowami)')} value={f.reason} onChangeText={(v) => setF({ ...f, reason: v })} multiline maxLength={1000} />
        <Field label={t('Od kiedy? (opcjonalnie)')} value={f.since} onChangeText={(v) => setF({ ...f, since: v })} maxLength={120} />
        <Field label={t('R — Twoje pytania do lekarza (opcjonalnie)')} value={f.questions} onChangeText={(v) => setF({ ...f, questions: v })} multiline maxLength={1500} />
        <P small>{t('Dane z okresu')}</P>
        <Chips label={t('Dane z okresu')} value={days} onChange={setDays} options={[30, 90, 180, 365].map((d) => ({ value: d, label: d === 365 ? t('1 rok') : t('{n} dni', { n: d }) }))} />
        <Notice>{t('W standardzie SBAR litera A to ocena — tej części aplikacja nie robi. Podaje tylko dane: pomiary, wyniki z zakresami z dokumentów i liczby z dzienników.')}</Notice>
        <Button title={t('Pobierz i udostępnij PDF')} loading={busy === 'sbar'} disabled={f.reason.trim().length < 3} onPress={() => void share('sbar')} />
      </Card>
      <Card title={t('Karta zdrowia na wyjazd (PL/EN)')}>
        <P small muted>{t('Po polsku i po angielsku: choroby przewlekłe z ankiety zdrowotnej, uczulenia, leki, szczepienia, dyspozycje zaznaczone do pokazania i osoby do kontaktu. Wydrukuj albo zapisz w telefonie.')}</P>
        <Button title={t('Pobierz i udostępnij PDF')} variant="secondary" loading={busy === 'travel'} onPress={() => void share('travel')} />
      </Card>
    </Screen>
  );
}
