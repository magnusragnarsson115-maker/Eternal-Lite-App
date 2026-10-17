import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, Card, Field, Notice, P, Row, Screen } from '../components/ui';
import { post } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { useI18n } from '../lib/i18n';
import { wipe } from '../lib/secure';
import { useSession } from '../lib/session';

interface Confirmation {
  id: string;
  steps: { key: string; label: string; status: string; count?: number; detail: string }[];
  backupsGoneBy: string;
}

const STATUS_PL: Record<string, string> = { deleted: 'usunięte', kept: 'zostaje', scheduled: 'zaplanowane', 'not-stored': 'nie przechowujemy' };

/** Usunięcie danych z potwierdzeniem (A18.12): co usunięto, co musi zostać (dokumentacja placówek, dziennik) i kiedy znikną kopie. */
export default function DeleteDataScreen() {
  const { t, date } = useI18n();
  const { logout } = useSession();
  const [f, setF] = useState({ confirm: '', password: '' });
  const [done, setDone] = useState<Confirmation>();
  const run = useMutation({
    mutationFn: () => post<{ confirmation: Confirmation }>('/api/me/delete-data', { confirm: f.confirm, password: f.password || undefined }),
    onSuccess: async (r) => {
      setDone(r.confirmation);
      await wipe();
    },
  });
  if (done) {
    return (
      <Screen>
        <Notice kind="ok">{t('Dane usunięte. Numer potwierdzenia: {id}', { id: done.id })}</Notice>
        <Card>
          {done.steps.map((s) => (
            <Row key={s.key} title={s.label} sub={`${t(STATUS_PL[s.status] ?? s.status)}${s.count !== undefined ? ` (${s.count})` : ''} · ${s.detail}`} />
          ))}
        </Card>
        <P muted>{t('Kopie zapasowe znikną najpóźniej {d}.', { d: date(done.backupsGoneBy) })}</P>
        <Button title={t('Zakończ')} onPress={() => void logout()} />
      </Screen>
    );
  }
  return (
    <Screen>
      <Notice kind="warn">{t('Usuniemy Twoje konto, dokumenty dodane przez Ciebie, udostępnienia i ustawienia. Dokumentacja prowadzona przez placówki zostaje u nich (obowiązek prawny) — dostaniesz potwierdzenie, co dokładnie zostało.')}</Notice>
      <Card>
        <Field label={t('Wpisz USUŃ, aby potwierdzić')} value={f.confirm} onChangeText={(v) => setF({ ...f, confirm: v })} autoCapitalize="characters" />
        <Field label={t('Hasło')} value={f.password} onChangeText={(v) => setF({ ...f, password: v })} secureTextEntry autoComplete="current-password" />
        {run.isError ? <Notice kind="danger">{errorMessage(run.error, t)}</Notice> : null}
        <Button title={t('Usuń moje dane')} variant="danger" disabled={f.confirm !== 'USUŃ'} loading={run.isPending} onPress={() => run.mutate()} />
      </Card>
    </Screen>
  );
}
