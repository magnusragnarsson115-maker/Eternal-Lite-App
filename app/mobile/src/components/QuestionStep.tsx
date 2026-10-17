import { Pressable, Text, View } from 'react-native';
import { useFontSize } from '../lib/a11y';
import { useI18n } from '../lib/i18n';
import { radius, space, useColors } from '../lib/theme';
import { Field, P } from './ui';

/**
 * Jedno pytanie FHIR Questionnaire (ankiety A12.3): tak/nie, wybór pojedynczy i wielokrotny, tekst, liczba, data.
 * Odpowiedzi nie są oceniane — komponent tylko je zbiera. Duże pola dotyku (≥ 48 pt), role dostępności.
 */

export type AnswerValue = string | number | boolean | string[] | null;
export type Answers = Record<string, AnswerValue>;

export interface QItem {
  linkId: string;
  type: string;
  text?: string;
  required?: boolean;
  repeats?: boolean;
  answerOption?: { valueCoding?: { code?: string; display?: string }; valueString?: string }[];
  enableWhen?: { question: string; operator: string; answerBoolean?: boolean; answerString?: string; answerCoding?: { code?: string } }[];
  enableBehavior?: 'all' | 'any';
  item?: QItem[];
}

export function enabled(item: QItem, answers: Answers): boolean {
  if (!item.enableWhen?.length) return true;
  const res = item.enableWhen.map((c) => {
    const a = answers[c.question];
    const expected = c.answerBoolean ?? c.answerString ?? c.answerCoding?.code;
    if (c.operator === 'exists') return (a !== undefined && a !== null && a !== '') === c.answerBoolean;
    if (c.operator === '=') return Array.isArray(a) ? a.includes(String(expected)) : a === expected;
    if (c.operator === '!=') return a !== expected;
    return true;
  });
  return item.enableBehavior === 'any' ? res.some(Boolean) : res.every(Boolean);
}

export const isEmpty = (v: AnswerValue | undefined) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

const code = (o: NonNullable<QItem['answerOption']>[number]) => o.valueCoding?.code ?? o.valueString ?? '';

export function answerText(item: QItem, answers: Answers, t: (s: string) => string): string {
  const v = answers[item.linkId];
  if (isEmpty(v)) return '';
  if (typeof v === 'boolean') return v ? t('Tak') : t('Nie');
  const label = (c: string) => t(item.answerOption?.find((o) => code(o) === c)?.valueCoding?.display ?? c);
  if (Array.isArray(v)) return v.map(label).join(', ');
  return item.type === 'choice' ? label(String(v)) : String(v);
}

function Option({ label, selected, multi, onPress }: { label: string; selected: boolean; multi?: boolean; onPress: () => void }) {
  const c = useColors();
  const fs = useFontSize();
  return (
    <Pressable
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={multi ? { checked: selected } : { selected }}
      onPress={onPress}
      style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: space(3), paddingHorizontal: space(3), paddingVertical: space(2), borderRadius: radius, borderWidth: selected ? 2 : 1, borderColor: selected ? c.primary : c.border, backgroundColor: selected ? c.primarySoft : c.surface }}
    >
      <View style={{ width: 22, height: 22, borderRadius: multi ? 5 : 11, borderWidth: 2, borderColor: selected ? c.primary : c.muted, alignItems: 'center', justifyContent: 'center' }}>
        {selected ? <View style={{ width: 12, height: 12, borderRadius: multi ? 2 : 6, backgroundColor: c.primary }} /> : null}
      </View>
      <Text style={{ flex: 1, color: c.ink, fontSize: fs(16), fontWeight: selected ? '700' : '400' }}>{label}</Text>
    </Pressable>
  );
}

export function QuestionStep({ item, answers, set }: { item: QItem; answers: Answers; set: (k: string, v: AnswerValue) => void }) {
  const { t } = useI18n();
  const c = useColors();
  const fs = useFontSize();
  const v = answers[item.linkId];
  const title = (
    <Text accessibilityRole="header" style={{ color: c.ink, fontSize: fs(19), fontWeight: '700', lineHeight: fs(26) }}>
      {t(item.text ?? '')}
      {item.required ? ' *' : ''}
    </Text>
  );
  switch (item.type) {
    case 'display':
      return <P muted>{t(item.text ?? '')}</P>;
    case 'group':
      return (
        <View style={{ gap: space(4) }}>
          {title}
          {(item.item ?? []).filter((i) => enabled(i, answers)).map((i) => (
            <QuestionStep key={i.linkId} item={i} answers={answers} set={set} />
          ))}
        </View>
      );
    case 'boolean':
      return (
        <View style={{ gap: space(2) }} accessibilityRole="radiogroup">
          {title}
          <Option label={t('Tak')} selected={v === true} onPress={() => set(item.linkId, true)} />
          <Option label={t('Nie')} selected={v === false} onPress={() => set(item.linkId, false)} />
        </View>
      );
    case 'choice': {
      const list = Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : [];
      return (
        <View style={{ gap: space(2) }} accessibilityRole={item.repeats ? undefined : 'radiogroup'}>
          {title}
          {item.repeats ? <P small muted>{t('Możesz zaznaczyć kilka odpowiedzi.')}</P> : null}
          {(item.answerOption ?? []).map((o) => {
            const k = code(o);
            const selected = item.repeats ? list.includes(k) : v === k;
            return (
              <Option
                key={k}
                multi={item.repeats}
                label={t(o.valueCoding?.display ?? o.valueString ?? '')}
                selected={selected}
                onPress={() => (item.repeats ? set(item.linkId, selected ? list.filter((x) => x !== k) : [...list, k]) : set(item.linkId, k))}
              />
            );
          })}
        </View>
      );
    }
    case 'integer':
    case 'decimal':
      return (
        <View style={{ gap: space(2) }}>
          {title}
          <Field label={t('Odpowiedź')} keyboardType={item.type === 'integer' ? 'number-pad' : 'decimal-pad'} value={v === null || v === undefined ? '' : String(v)} onChangeText={(x) => set(item.linkId, x === '' ? null : Number(x.replace(',', '.')))} />
        </View>
      );
    case 'date':
      return (
        <View style={{ gap: space(2) }}>
          {title}
          <Field label={t('Data (RRRR-MM-DD)')} value={typeof v === 'string' ? v : ''} onChangeText={(x) => set(item.linkId, x)} placeholder="2026-10-15" />
        </View>
      );
    default:
      return (
        <View style={{ gap: space(2) }}>
          {title}
          <Field
            label={t('Odpowiedź')}
            value={typeof v === 'string' ? v : ''}
            onChangeText={(x) => set(item.linkId, x)}
            multiline={item.type === 'text'}
            maxLength={item.type === 'text' ? 2000 : 300}
            numberOfLines={item.type === 'text' ? 4 : 1}
          />
        </View>
      );
  }
}
