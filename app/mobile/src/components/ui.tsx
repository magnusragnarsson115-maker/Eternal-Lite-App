import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFontSize } from '../lib/a11y';
import { useI18n } from '../lib/i18n';
import { setActiveProfile, useActiveProfile } from '../lib/profile';
import { radius, space, useColors } from '../lib/theme';

/** Komponenty wspólne: duże pola dotyku (min. 48 pt), etykiety dla czytników ekranu, kolory z tokenów panelu. */

/** Tryb opiekuna (A24.2): pasek z imieniem profilu na każdym ekranie, żeby nie pomylić osób. */
export function ProxyBanner() {
  const c = useColors();
  const fs = useFontSize();
  const { t } = useI18n();
  const profile = useActiveProfile();
  if (!profile) return null;
  return (
    <View accessibilityRole="summary" style={{ borderWidth: 2, borderColor: c.primary, backgroundColor: c.primarySoft, borderRadius: radius, padding: space(3), gap: space(2) }}>
      <Text style={{ color: c.ink, fontSize: fs(16), fontWeight: '700' }}>{t('Działasz w profilu: {name}', { name: profile.name })}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setActiveProfile(undefined);
          router.replace('/');
        }}
        style={{ minHeight: 44, justifyContent: 'center' }}
      >
        <Text style={{ color: c.primary, fontSize: fs(15), fontWeight: '700' }}>{t('Wróć do swojego profilu')}</Text>
      </Pressable>
    </View>
  );
}

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const c = useColors();
  const inner = (
    <View style={{ padding: padded ? space(4) : 0, gap: space(4) }}>
      <ProxyBanner />
      {children}
    </View>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['left', 'right']}>
      {scroll ? <ScrollView contentContainerStyle={{ paddingBottom: space(10) }}>{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

export function H1({ children }: { children: ReactNode }) {
  const c = useColors();
  const fs = useFontSize();
  return (
    <Text accessibilityRole="header" style={{ fontSize: fs(26), fontWeight: '700', color: c.ink }}>
      {children}
    </Text>
  );
}

export function P({ children, muted, small, style }: { children: ReactNode; muted?: boolean; small?: boolean; style?: object }) {
  const c = useColors();
  const fs = useFontSize();
  return <Text style={[{ fontSize: fs(small ? 14 : 16), lineHeight: fs(small ? 20 : 23), color: muted ? c.muted : c.ink2 }, style]}>{children}</Text>;
}

export function Card({ title, children, style }: { title?: string; children: ReactNode; style?: ViewStyle }) {
  const c = useColors();
  const fs = useFontSize();
  return (
    <View style={[{ backgroundColor: c.surface, borderRadius: radius, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, padding: space(4), gap: space(3) }, style]}>
      {title ? (
        <Text accessibilityRole="header" style={{ fontSize: fs(18), fontWeight: '700', color: c.ink }}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({ title, onPress, variant = 'primary', loading, disabled, accessibilityHint }: { title: string; onPress: () => void; variant?: Variant; loading?: boolean; disabled?: boolean; accessibilityHint?: string }) {
  const c = useColors();
  const fs = useFontSize();
  const bg = { primary: c.primary, secondary: c.surface, danger: c.danger, ghost: 'transparent' }[variant];
  const fg = { primary: c.primaryInk, secondary: c.primary, danger: '#fff', ghost: c.primary }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 50,
        borderRadius: radius,
        paddingHorizontal: space(4),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: bg,
        borderWidth: variant === 'secondary' ? 1 : 0,
        borderColor: c.border,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontSize: fs(17), fontWeight: '600' }}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const c = useColors();
  const fs = useFontSize();
  return (
    <View style={{ gap: space(1) }}>
      <Text style={{ color: c.ink2, fontSize: fs(15), fontWeight: '600' }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.muted}
        {...props}
        style={{ minHeight: 50, borderRadius: radius, borderWidth: 1, borderColor: error ? c.danger : c.border, backgroundColor: c.surface, color: c.ink, paddingHorizontal: space(3), fontSize: fs(17) }}
      />
      {error ? <Text style={{ color: c.danger, fontSize: fs(14) }}>{error}</Text> : null}
    </View>
  );
}

export function Notice({ kind = 'info', children }: { kind?: 'info' | 'ok' | 'warn' | 'danger'; children: ReactNode }) {
  const c = useColors();
  const fs = useFontSize();
  const bg = { info: c.primarySoft, ok: c.successSoft, warn: c.warningSoft, danger: c.dangerSoft }[kind];
  const fg = { info: c.ink2, ok: c.success, warn: c.warning, danger: c.danger }[kind];
  return (
    <View accessibilityRole={kind === 'danger' ? 'alert' : undefined} style={{ backgroundColor: bg, borderRadius: radius, padding: space(3) }}>
      <Text style={{ color: fg, fontSize: fs(15), lineHeight: fs(21) }}>{children}</Text>
    </View>
  );
}

export function Row({ title, sub, right, onPress, accessibilityLabel }: { title: string; sub?: string; right?: ReactNode; onPress?: () => void; accessibilityLabel?: string }) {
  const c = useColors();
  const fs = useFontSize();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel ?? [title, sub].filter(Boolean).join(', ')}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3), minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: c.ink, fontSize: fs(16), fontWeight: '600' }}>{title}</Text>
        {sub ? <Text style={{ color: c.muted, fontSize: fs(14) }}>{sub}</Text> : null}
      </View>
      {right ?? (onPress ? <Text style={{ color: c.muted, fontSize: fs(22) }}>›</Text> : null)}
    </Pressable>
  );
}

export function Badge({ children, kind = 'info' }: { children: ReactNode; kind?: 'info' | 'ok' | 'warn' | 'danger' }) {
  const c = useColors();
  const fs = useFontSize();
  const bg = { info: c.primarySoft, ok: c.successSoft, warn: c.warningSoft, danger: c.dangerSoft }[kind];
  const fg = { info: c.ink2, ok: c.success, warn: c.warning, danger: c.danger }[kind];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: fg, fontSize: fs(13), fontWeight: '600' }}>{children}</Text>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  const c = useColors();
  return (
    <View style={{ padding: space(8), alignItems: 'center', gap: space(3) }} accessibilityLiveRegion="polite">
      <ActivityIndicator color={c.primary} size="large" />
      {label ? <Text style={{ color: c.muted }}>{label}</Text> : null}
    </View>
  );
}

export function Empty({ title }: { title: string }) {
  const c = useColors();
  const fs = useFontSize();
  return <Text style={{ color: c.muted, textAlign: 'center', padding: space(6), fontSize: fs(16) }}>{title}</Text>;
}

/** Wybór jednej opcji z kilku (przyciski-etykiety) — duże pola dotyku, stan dla czytnika ekranu. */
export function Chips<T extends string | number>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label?: string }) {
  const c = useColors();
  const fs = useFontSize();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space(2) }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: radius, borderWidth: selected ? 2 : 1, borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primarySoft : c.surface }}
          >
            <Text style={{ color: c.ink, fontSize: fs(15), fontWeight: selected ? '700' : '400' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
