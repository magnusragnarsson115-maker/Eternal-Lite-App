import { Tabs } from 'expo-router/js-tabs';
import { Text, type ColorValue } from 'react-native';
import { useI18n } from '../../lib/i18n';
import { useColors } from '../../lib/theme';

/** Dolne menu pacjenta. Ikony tekstowe — bez dodatkowej biblioteki; etykiety czytane przez czytniki ekranu. */
export default function TabsLayout() {
  const { t } = useI18n();
  const c = useColors();
  const icon = (glyph: string) =>
    function TabIcon({ color }: { color: ColorValue }) {
      return (
        <Text style={{ color, fontSize: 18 }} accessibilityElementsHidden importantForAccessibility="no">
          {glyph}
        </Text>
      );
    };
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border, minHeight: 60 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        headerStyle: { backgroundColor: c.surface },
        headerTitleStyle: { color: c.ink },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('Start'), tabBarIcon: icon('⌂') }} />
      <Tabs.Screen name="documents" options={{ title: t('Dokumenty'), tabBarIcon: icon('▤') }} />
      <Tabs.Screen name="cards" options={{ title: t('Karty'), tabBarIcon: icon('✓') }} />
      <Tabs.Screen name="sharing" options={{ title: t('Udostępnianie'), tabBarIcon: icon('⇄') }} />
      <Tabs.Screen name="more" options={{ title: t('Więcej'), tabBarIcon: icon('≡') }} />
    </Tabs>
  );
}
