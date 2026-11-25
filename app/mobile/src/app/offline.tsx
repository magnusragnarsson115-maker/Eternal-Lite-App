import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Linking } from 'react-native';
import { Button, Card, Notice, P, Row, Screen } from '../components/ui';
import { get } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { clearOffline, readOffline, saveOffline, type OfflinePack } from '../lib/offline';
import { useSession } from '../lib/session';

const DAY: Record<number, string> = { 1: 'pon.', 2: 'wt.', 3: 'śr.', 4: 'czw.', 5: 'pt.', 6: 'sob.', 7: 'niedz.' };

/** Kopia bez internetu (A5.12): karta ratunkowa, leki z godzinami, wizyty i telefon placówki — w pamięci telefonu. */
export default function OfflineScreen() {
  const { t, date, dateTime } = useI18n();
  const { me } = useSession();
  const [stored, setStored] = useState(readOffline);
  const mine = stored && me?.user && stored.userId === me.user.id ? stored : undefined;
  const save = useMutation({
    mutationFn: () => get<OfflinePack>('/api/me/offline-pack'),
    onSuccess: (pack) => {
      if (!me?.user) return;
      saveOffline(me.user.id, pack);
      setStored(readOffline());
    },
  });
  const p = mine?.pack;
  return (
    <Screen>
      <P muted>{t('Karta ratunkowa, leki z godzinami, najbliższe wizyty i telefon do placówki — w pamięci tego telefonu, także bez internetu. Kopia znika po wylogowaniu. Numery alarmowe działają zawsze.')}</P>
      <Card>
        {mine ? <Notice kind="ok">{t('Kopia zapisana {d}', { d: dateTime(mine.savedAt) })}</Notice> : <Notice kind="info">{t('Na tym urządzeniu nie ma kopii.')}</Notice>}
        <Button title={mine ? t('Odśwież kopię') : t('Zapisz kopię na tym urządzeniu')} loading={save.isPending} onPress={() => save.mutate()} />
        {mine ? (
          <Button
            title={t('Usuń kopię')}
            variant="ghost"
            onPress={() => {
              clearOffline();
              setStored(undefined);
            }}
          />
        ) : null}
        {save.isError ? <Notice kind="danger">{errorMessage(save.error, t)}</Notice> : null}
      </Card>
      {p ? (
        <>
          <Card title={t('Karta ratunkowa')}>
            <Row title={p.card.name || '—'} sub={p.card.birthDate ? date(p.card.birthDate) : undefined} />
            {p.card.notes ? <Row title={t('Ważne informacje')} sub={p.card.notes} /> : null}
            {p.card.medications.length ? <Row title={t('Leki')} sub={p.card.medications.join('; ')} /> : null}
            {p.card.contacts.map((c) => (
              <Row key={`${c.name}-${c.phone}`} title={`${c.name}${c.relation ? ` · ${c.relation}` : ''}`} sub={c.phone} right={<Button title={t('Zadzwoń')} variant="ghost" onPress={() => void Linking.openURL(`tel:${c.phone.replace(/\s/g, '')}`)} />} />
            ))}
            <P muted small>{t(p.card.disclaimer)}</P>
          </Card>
          <Card title={t('Leki i godziny przypomnień')}>
            {p.medications.map((m) => (
              <Row key={m.name} title={m.name} sub={m.dosage} />
            ))}
            {p.reminders.map((r) => (
              <Row key={`${r.label}-${r.times.join()}`} title={r.label} sub={`${r.times.join(', ')} · ${r.days.length < 7 ? r.days.map((d) => t(DAY[d] ?? String(d))).join(', ') : t('codziennie')}`} />
            ))}
            {!p.medications.length && !p.reminders.length ? <P muted>{t('Brak zapisanych leków.')}</P> : null}
          </Card>
          <Card title={t('Najbliższe wizyty')}>
            {p.appointments.map((a) => (
              <Row key={a.start} title={`${dateTime(a.start)} · ${a.service ?? t('Wizyta')}`} sub={[a.practitioner, a.tele ? t('wizyta wideo') : a.place].filter(Boolean).join(' · ')} />
            ))}
            {!p.appointments.length ? <P muted>{t('Brak zaplanowanych wizyt w ciągu 60 dni.')}</P> : null}
          </Card>
          <Card title={p.clinic.name}>
            {p.clinic.phone ? <Row title={p.clinic.phone} right={<Button title={t('Zadzwoń')} variant="ghost" onPress={() => void Linking.openURL(`tel:${p.clinic.phone!.replace(/\s/g, '')}`)} />} /> : null}
            {p.clinic.address ? <Row title={p.clinic.address} /> : null}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
