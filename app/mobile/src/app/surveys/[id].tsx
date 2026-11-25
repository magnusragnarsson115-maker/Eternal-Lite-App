import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, findNodeHandle, Pressable, Text, View } from 'react-native';
import { answerText, enabled, isEmpty, QuestionStep, type AnswerValue, type Answers, type QItem } from '../../components/QuestionStep';
import { Button, Card, H1, Loading, Notice, P, Screen } from '../../components/ui';
import { get, post } from '../../lib/api';
import { errorMessage } from '../../lib/errors';
import { useI18n } from '../../lib/i18n';
import { space, useColors } from '../../lib/theme';

interface SurveyData {
  questionnaire: { title?: string; description?: string; item?: QItem[] };
  kind: 'health' | 'product';
  minutes: number;
  answers: Answers;
  lastAuthored?: string;
}

/** Ankieta po jednym pytaniu (A12.3): postęp, pytania wymagane, podsumowanie z „Zmień” przed zapisem. */
export default function SurveyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, date } = useI18n();
  const c = useColors();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['survey', id], queryFn: () => get<SurveyData>(`/api/me/surveys/${id}`) });
  const [answers, setAnswers] = useState<Answers | null>(null);
  const [step, setStep] = useState(0);
  const [missing, setMissing] = useState(false);
  const [done, setDone] = useState<{ question?: string } | null>(null);
  const headRef = useRef<Text>(null);

  const save = useMutation({
    mutationFn: (a: Answers) => post<{ ok: true; question?: string; crisis?: boolean }>(`/api/me/surveys/${id}`, { answers: a, platform: 'mobile' }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['surveys'] });
      if (r.crisis) router.push('/crisis'); // F8.1 — numery pomocy
      setDone({ question: r.question });
    },
  });
  const defer = useMutation({
    mutationFn: () => post(`/api/me/surveys/${id}/defer`, { mode: 'later' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['surveys'] });
      router.back();
    },
  });
  // pytanie do lekarza z ankiety „po wynikach” — wysyłane tylko po wyraźnym wyborze pacjenta
  const send = useMutation({
    mutationFn: (body: string) => post<{ id: string; crisis?: boolean }>('/api/me/threads', { subject: t('Pytanie o wynik badania'), category: 'results', body }),
    onSuccess: (r) => {
      if (r.crisis) router.push('/crisis');
    },
  });

  useEffect(() => {
    const node = headRef.current ? findNodeHandle(headRef.current) : null;
    if (node) AccessibilityInfo.setAccessibilityFocus(node);
  }, [step]);

  if (!q.data) return <Screen>{q.isLoading ? <Loading /> : <Notice kind="danger">{errorMessage(q.error, t)}</Notice>}</Screen>;
  const d = q.data;
  const current = answers ?? d.answers ?? {};
  const set = (k: string, v: AnswerValue) => {
    setMissing(false);
    setAnswers({ ...current, [k]: v });
  };
  const items = d.questionnaire.item ?? [];
  const steps = items.filter((i) => i.type !== 'display' && enabled(i, current));
  const notes = items.filter((i) => i.type === 'display');
  const reviewing = step >= steps.length;
  const progress = steps.length ? Math.min(step, steps.length) / steps.length : 1;

  if (done) {
    return (
      <Screen>
        <H1>{t('Dziękujemy')}</H1>
        <P>{t('Dziękujemy — zapisaliśmy odpowiedzi.')}</P>
        {done.question ? (
          <Card title={t('Wysłać pytanie do placówki?')}>
            <P>{done.question}</P>
            <P small muted>
              {t('Pytanie trafi do placówki jako wiadomość. Odpowiedź może przyjść za kilka dni — w nagłym zagrożeniu dzwoń 112.')}
            </P>
            {send.isSuccess ? (
              <Notice kind="ok">{t('Wysłano. Odpowiedź zobaczysz w wiadomościach w wersji przeglądarkowej.')}</Notice>
            ) : (
              <>
                {send.isError ? <Notice kind="danger">{errorMessage(send.error, t)}</Notice> : null}
                <Button title={t('Wyślij pytanie')} loading={send.isPending} onPress={() => send.mutate(done.question!)} />
              </>
            )}
          </Card>
        ) : null}
        <Button title={t('Wróć do ankiet')} variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <H1>{t(d.questionnaire.title ?? '')}</H1>
      <P muted>{t(d.questionnaire.description ?? '')}</P>
      {d.lastAuthored ? <Notice>{t('Formularz zawiera Twoje odpowiedzi z {d}. Zmień to, co jest nieaktualne.', { d: date(d.lastAuthored) })}</Notice> : null}
      <View style={{ gap: space(1) }}>
        <Text ref={headRef} style={{ color: c.muted }} accessibilityLiveRegion="polite">
          {reviewing ? t('Sprawdź odpowiedzi przed wysłaniem') : t('Pytanie {n} z {m}', { n: step + 1, m: steps.length })}
        </Text>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: steps.length, now: Math.min(step, steps.length) }} style={{ height: 6, borderRadius: 3, backgroundColor: c.surface2, overflow: 'hidden' }}>
          <View style={{ width: `${Math.round(progress * 100)}%`, height: 6, backgroundColor: c.primary }} />
        </View>
      </View>
      <Card>
        {!reviewing && steps[step] ? <QuestionStep item={steps[step]} answers={current} set={set} /> : null}
        {!reviewing && missing ? <Notice kind="warn">{t('To pytanie jest wymagane — odpowiedz, żeby przejść dalej.')}</Notice> : null}
        {reviewing
          ? steps.map((item, i) => (
              <Pressable key={item.linkId} accessibilityRole="button" accessibilityHint={t('Zmień')} onPress={() => setStep(i)} style={{ paddingVertical: space(2), borderBottomWidth: 1, borderBottomColor: c.border }}>
                <Text style={{ color: c.ink2, fontWeight: '600' }}>{t(item.text ?? '')}</Text>
                <Text style={{ color: c.ink }}>{answerText(item, current, t) || t('bez odpowiedzi')}</Text>
                <Text style={{ color: c.primary, fontWeight: '600' }}>{t('Zmień')}</Text>
              </Pressable>
            ))
          : null}
        {reviewing ? notes.map((n) => <P key={n.linkId} small muted>{t(n.text ?? '')}</P>) : null}
      </Card>
      {save.isError ? <Notice kind="danger">{errorMessage(save.error, t)}</Notice> : null}
      {reviewing ? (
        <Button title={t('Zapisz odpowiedzi')} loading={save.isPending} onPress={() => save.mutate(current)} />
      ) : (
        <Button
          title={step === steps.length - 1 ? t('Podsumowanie') : t('Dalej')}
          onPress={() => {
            const item = steps[step];
            if (item?.required && isEmpty(current[item.linkId])) return setMissing(true);
            setStep(step + 1);
          }}
        />
      )}
      {step > 0 ? <Button title={t('Wstecz')} variant="secondary" onPress={() => setStep(step - 1)} /> : null}
      <Button title={t('Nie teraz')} variant="ghost" loading={defer.isPending} onPress={() => defer.mutate()} />
    </Screen>
  );
}
