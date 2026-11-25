import { Linking } from 'react-native';
import { Card, Notice, Row, Screen, Button } from '../components/ui';
import { CRISIS_NUMBERS, telUrl } from '../lib/crisis';
import { useI18n } from '../lib/i18n';

/** Numery pomocowe (F8.1, F8.4) — dostępne zawsze, także bez logowania i bez internetu; nie do wyłączenia. */
export default function CrisisScreen() {
  const { t, locale } = useI18n();
  return (
    <Screen>
      <Notice kind="danger">{t('Jeśli grozi Ci niebezpieczeństwo albo myślisz o odebraniu sobie życia — zadzwoń teraz. Nie jesteś sam(a).')}</Notice>
      <Card>
        {CRISIS_NUMBERS.map((n) => (
          <Row
            key={n.number}
            title={n.number}
            sub={`${locale === 'pl' ? n.pl : n.en}${n.hours ? ` · ${n.hours}` : ''}`}
            accessibilityLabel={t('Zadzwoń: {n}', { n: `${n.number}, ${locale === 'pl' ? n.pl : n.en}` })}
            right={<Button title={t('Zadzwoń')} variant="ghost" onPress={() => void Linking.openURL(telUrl(n.number))} />}
            onPress={() => void Linking.openURL(telUrl(n.number))}
          />
        ))}
      </Card>
    </Screen>
  );
}
