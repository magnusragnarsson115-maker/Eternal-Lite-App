import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Card, Empty, Loading, Notice, P, Row, Screen, Badge, Button } from '../../components/ui';
import { get, upload } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useI18n } from '../../lib/i18n';
import { KIND_PL, STATUS_PL } from '../../lib/labels';
import type { DocumentItem, IntakeView } from '../../lib/types';

/**
 * Dokumenty i wyniki (P3): zdjęcie aparatem albo PDF → odczyt → potwierdzenie przez pacjenta.
 * Zdjęcie nie zostaje w galerii aplikacji — plik wysyłany jest od razu na serwer, telefon nie przechowuje kopii.
 */
export default function DocumentsScreen() {
  const { t, date } = useI18n();
  const qc = useQueryClient();
  const [error, setError] = useState<string>();
  const intake = useQuery({ queryKey: ['intake'], queryFn: () => get<{ items: IntakeView[] }>('/api/me/intake') });
  const docs = useQuery({ queryKey: ['documents'], queryFn: () => get<{ items: DocumentItem[] }>('/api/me/documents') });

  const send = useMutation({
    mutationFn: (f: { uri: string; name: string; type: string }) => upload<IntakeView>('/api/me/intake', f),
    onSuccess: (v) => {
      void qc.invalidateQueries({ queryKey: ['intake'] });
      router.push(`/intake/${v.id}`);
    },
    onError: (e) => setError(errorMessage(e, t)),
  });

  const fromCamera = async () => {
    setError(undefined);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return setError(t('Brak dostępu do aparatu. Zezwól na aparat w ustawieniach telefonu.'));
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8, exif: false });
    const a = r.assets?.[0];
    if (!r.canceled && a) send.mutate({ uri: a.uri, name: a.fileName ?? 'dokument.jpg', type: a.mimeType ?? 'image/jpeg' });
  };
  const fromLibrary = async () => {
    setError(undefined);
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, exif: false });
    const a = r.assets?.[0];
    if (!r.canceled && a) send.mutate({ uri: a.uri, name: a.fileName ?? 'dokument.jpg', type: a.mimeType ?? 'image/jpeg' });
  };
  const fromFiles = async () => {
    setError(undefined);
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true });
    const a = r.assets?.[0];
    if (!r.canceled && a) send.mutate({ uri: a.uri, name: a.name, type: a.mimeType ?? 'application/pdf' });
  };

  const pending = intake.data?.items.filter((i) => ['processing', 'needs_review', 'unreadable', 'failed'].includes(i.status)) ?? [];
  return (
    <Screen>
      <Card title={t('Dodaj dokument')}>
        <P small muted>
          {t('Najlepiej działają PDF-y z portalu laboratorium. Zdjęcie: cała strona, równo, bez cienia.')}
        </P>
        <Button title={t('Zrób zdjęcie dokumentu')} loading={send.isPending} onPress={() => void fromCamera()} />
        <Button title={t('Wybierz zdjęcie z galerii')} variant="secondary" disabled={send.isPending} onPress={() => void fromLibrary()} />
        <Button title={t('Wybierz plik PDF')} variant="secondary" disabled={send.isPending} onPress={() => void fromFiles()} />
        {error ? <Notice kind="danger">{error}</Notice> : null}
      </Card>

      {pending.length > 0 ? (
        <Card title={t('Do sprawdzenia')}>
          {pending.map((i) => (
            <Row key={i.id} title={i.filename ?? t('Dokument')} sub={`${t(KIND_PL[i.kind] ?? 'Dokument')} · ${date(i.createdAt)}`} right={<Badge kind={i.status === 'needs_review' ? 'warn' : 'info'}>{t(STATUS_PL[i.status] ?? i.status)}</Badge>} onPress={() => router.push(`/intake/${i.id}`)} />
          ))}
        </Card>
      ) : null}

      <Button title={t('Oś czasu wyników')} variant="secondary" onPress={() => router.push('/timeline')} />

      <Card title={t('Moje dokumenty')}>
        {docs.isLoading ? (
          <Loading />
        ) : !docs.data?.items.length ? (
          <Empty title={t('Nie dodano jeszcze dokumentów')} />
        ) : (
          docs.data.items.map((d) => <Row key={d.id} title={d.title || t(KIND_PL[d.kind] ?? 'Dokument')} sub={[t(KIND_PL[d.kind] ?? 'Dokument'), date(d.date)].filter(Boolean).join(' · ')} />)
        )}
      </Card>
    </Screen>
  );
}
