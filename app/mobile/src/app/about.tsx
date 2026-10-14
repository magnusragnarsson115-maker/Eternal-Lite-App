import { useQuery } from '@tanstack/react-query';
import * as Application from 'expo-application';
import { Card, Loading, P, Screen } from '../components/ui';
import { get } from '../lib/api';
import { useI18n } from '../lib/i18n';

interface Text {
  version: string;
  title: string;
  paragraphs: string[];
}

/** „Do czego służy aplikacja” (A18.3, A18.1): przeznaczenie, instrukcja w wersji, oznaczenie AI (A19.1) — teksty z serwera. */
export default function AboutScreen() {
  const { t, locale } = useI18n();
  const q = useQuery({ queryKey: ['texts', locale], queryFn: () => get<{ purpose: Text; instructions: Text; ai: Text; securityContact?: string }>(`/api/public/texts?lang=${locale}`) });
  if (!q.data) return <Screen>{<Loading />}</Screen>;
  const block = (x: Text) => (
    <Card title={x.title} key={x.version}>
      {x.paragraphs.map((p, i) => (
        <P key={i}>{p}</P>
      ))}
      <P small muted>
        {x.version}
      </P>
    </Card>
  );
  return (
    <Screen>
      {block(q.data.purpose)}
      {block(q.data.instructions)}
      {block(q.data.ai)}
      <P small muted>
        {t('Wersja aplikacji: {v}', { v: Application.nativeApplicationVersion ?? '—' })}
        {q.data.securityContact ? ` · ${t('Zgłoszenia bezpieczeństwa: {c}', { c: q.data.securityContact })}` : ''}
      </P>
    </Screen>
  );
}
