import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { useSession } from '../session';
import type { Questionnaire, QuestionnaireItem } from '../types';
import { Button, Notice, Segmented } from '../ui';

/**
 * Formularz FHIR Questionnaire wspólny dla wywiadu przed wizytą (M27) i ankiet pacjenta (A12.3):
 * tryb „po jednym pytaniu” (rozmowa, postęp, podsumowanie przed wysłaniem) albo wszystkie pytania naraz.
 * Odpowiedzi nie są oceniane — formularz tylko je zbiera.
 */

export type Answers = Record<string, string | number | boolean | string[] | null>;

export function enabled(item: QuestionnaireItem, answers: Answers): boolean {
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

export function QItem({ item, answers, set }: { item: QuestionnaireItem; answers: Answers; set: (k: string, v: Answers[string]) => void }) {
  const { t } = useI18n();
  if (!enabled(item, answers)) return null;
  const id = `q-${item.linkId}`;
  const label = (
    <label htmlFor={id} style={{ fontWeight: 600 }}>
      {t(item.text ?? '')}
      {item.required && <span aria-hidden> *</span>}
    </label>
  );
  const v = answers[item.linkId];
  switch (item.type) {
    case 'display':
      return <p className="small muted">{t(item.text ?? '')}</p>;
    case 'group':
      return (
        <fieldset className="stack" style={{ border: 0, padding: 0 }}>
          <legend style={{ fontWeight: 650 }}>{t(item.text ?? '')}</legend>
          {item.item?.map((c) => <QItem key={c.linkId} item={c} answers={answers} set={set} />)}
        </fieldset>
      );
    case 'boolean':
      return (
        <fieldset className="field" style={{ border: 0, padding: 0 }}>
          <legend style={{ fontWeight: 600, marginBottom: 6 }}>
            {t(item.text ?? '')}
            {item.required && <span aria-hidden> *</span>}
          </legend>
          <div className="segmented">
            <button type="button" aria-pressed={v === true} onClick={() => set(item.linkId, true)}>
              {t('Tak')}
            </button>
            <button type="button" aria-pressed={v === false} onClick={() => set(item.linkId, false)}>
              {t('Nie')}
            </button>
          </div>
        </fieldset>
      );
    case 'choice':
      return (
        <fieldset className="field" style={{ border: 0, padding: 0 }}>
          <legend style={{ fontWeight: 600, marginBottom: 6 }}>
            {t(item.text ?? '')}
            {item.required && <span aria-hidden> *</span>}
          </legend>
          <div className="stack" style={{ gap: 6 }}>
            {item.answerOption?.map((o) => {
              const code = o.valueCoding?.code ?? o.valueString ?? '';
              if (item.repeats) {
                // wielokrotny wybór — zaznacz wszystkie pasujące
                const list = Array.isArray(v) ? v : typeof v === 'string' && v ? [v] : [];
                return (
                  <label key={code} className="check">
                    <input type="checkbox" checked={list.includes(code)} onChange={(e) => set(item.linkId, e.target.checked ? [...list, code] : list.filter((x) => x !== code))} />
                    <span>{t(o.valueCoding?.display ?? o.valueString ?? '')}</span>
                  </label>
                );
              }
              return (
                <label key={code} className="check">
                  <input type="radio" name={id} checked={v === code} onChange={() => set(item.linkId, code)} />
                  <span>{t(o.valueCoding?.display ?? o.valueString ?? '')}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      );
    case 'text':
      return (
        <div className="field">
          {label}
          <textarea id={id} className="textarea" maxLength={2000} value={(v as string) ?? ''} onChange={(e) => set(item.linkId, e.target.value)} required={item.required} />
        </div>
      );
    case 'integer':
    case 'decimal':
      return (
        <div className="field">
          {label}
          <input id={id} className="input" type="number" step={item.type === 'integer' ? 1 : 'any'} value={(v as number) ?? ''} onChange={(e) => set(item.linkId, e.target.value === '' ? null : Number(e.target.value))} />
        </div>
      );
    case 'date':
      return (
        <div className="field">
          {label}
          <input id={id} className="input" type="date" value={(v as string) ?? ''} onChange={(e) => set(item.linkId, e.target.value)} />
        </div>
      );
    default:
      return (
        <div className="field">
          {label}
          <input id={id} className="input" maxLength={300} value={(v as string) ?? ''} onChange={(e) => set(item.linkId, e.target.value)} required={item.required} />
        </div>
      );
  }
}

export function answersFromResponse(resp: { item?: { linkId: string; answer?: Record<string, unknown>[]; item?: unknown[] }[] } | null): Answers {
  const out: Answers = {};
  const walk = (items: { linkId: string; answer?: Record<string, unknown>[]; item?: unknown[] }[] = []) => {
    for (const i of items) {
      const a = i.answer?.[0];
      if (i.answer && i.answer.length > 1) {
        // wielokrotny wybór
        out[i.linkId] = i.answer.map((x) => String((x.valueCoding as { code?: string } | undefined)?.code ?? x.valueString ?? ''));
      } else if (a) {
        const coding = a.valueCoding as { code?: string } | undefined;
        const v = a.valueBoolean ?? a.valueString ?? coding?.code ?? a.valueInteger ?? a.valueDecimal ?? a.valueDate;
        out[i.linkId] = v === undefined ? null : (v as Answers[string]);
      }
      walk(i.item as typeof items);
    }
  };
  walk(resp?.item);
  return out;
}

/** Odpowiedź w czytelnej postaci (podsumowanie przed wysłaniem). */
export function answerText(item: QuestionnaireItem, answers: Answers, t: (s: string) => string): string {
  if (item.type === 'group') return (item.item ?? []).filter((c) => enabled(c, answers)).map((c) => answerText(c, answers, t)).filter(Boolean).join('; ');
  const v = answers[item.linkId];
  if (v === undefined || v === null || v === '') return '';
  if (typeof v === 'boolean') return v ? t('Tak') : t('Nie');
  const label = (code: string) => t(item.answerOption?.find((o) => (o.valueCoding?.code ?? o.valueString) === code)?.valueCoding?.display ?? code);
  if (Array.isArray(v)) return v.map(label).join(', ');
  return item.type === 'choice' ? label(String(v)) : String(v);
}


export function QuestionnaireForm({
  questionnaire,
  initial,
  onSubmit,
  submitting,
  error,
  submitLabel,
  footer,
}: {
  questionnaire: Questionnaire;
  initial: Answers;
  onSubmit: (answers: Answers) => void;
  submitting?: boolean;
  error?: ReactNode;
  submitLabel?: string;
  /** Dodatkowe przyciski obok „Wyślij” (np. „Nie teraz”). */
  footer?: ReactNode;
}) {
  const { t } = useI18n();
  const { a11y } = useSession();
  const [answers, setAnswers] = useState<Answers>(initial);
  // Domyślnie po jednym pytaniu przy prostym języku albo dużym tekście; zawsze do przełączenia.
  const [mode, setMode] = useState<'all' | 'step'>(a11y.simpleLanguage || a11y.textScale >= 150 ? 'step' : 'all');
  const [step, setStep] = useState(0);
  const [missing, setMissing] = useState(false);
  const stepRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (mode === 'step') stepRef.current?.focus();
  }, [step, mode]);
  const set = (k: string, v: Answers[string]) => {
    setMissing(false);
    setAnswers({ ...answers, [k]: v });
  };
  const items = questionnaire.item ?? [];
  const steps = items.filter((i) => i.type !== 'display' && enabled(i, answers));
  const notes = items.filter((i) => i.type === 'display');
  const reviewing = step >= steps.length;
  const isEmpty = (v: Answers[string] | undefined) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  const next = () => {
    const item = steps[step];
    if (item?.required && isEmpty(answers[item.linkId])) return setMissing(true);
    setMissing(false);
    setStep(step + 1);
  };
  const label = submitLabel ?? t('Wyślij odpowiedzi');
  return (
    <div className="stack-lg">
      <Segmented
        label={t('Sposób wypełniania')}
        value={mode}
        onChange={(m) => {
          setMode(m);
          setStep(0);
        }}
        options={[
          { value: 'step', label: t('Po jednym pytaniu') },
          { value: 'all', label: t('Wszystkie pytania') },
        ]}
      />
      {mode === 'all' ? (
        <form
          className="card stack-lg"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(answers);
          }}
        >
          {items.map((item) => <QItem key={item.linkId} item={item} answers={answers} set={set} />)}
          {error}
          <div className="btn-row">
            <Button type="submit" loading={submitting}>
              {label}
            </Button>
            {footer}
          </div>
        </form>
      ) : (
        <div className="card stack-lg">
          <div>
            <p className="small muted" style={{ margin: '0 0 6px' }}>
              {reviewing ? t('Sprawdź odpowiedzi przed wysłaniem') : t('Pytanie {n} z {m}', { n: step + 1, m: steps.length })}
            </p>
            <div className="step-progress" role="progressbar" aria-label={t('Postęp wywiadu')} aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={Math.min(step, steps.length)}>
              <span style={{ width: `${steps.length ? Math.round((Math.min(step, steps.length) / steps.length) * 100) : 100}%` }} />
            </div>
          </div>
          <div ref={stepRef} tabIndex={-1} className="stack" style={{ outline: 'none' }}>
            {!reviewing && steps[step] && <QItem item={steps[step]} answers={answers} set={set} />}
            {!reviewing && missing && <Notice kind="warn">{t('To pytanie jest wymagane — odpowiedz, żeby przejść dalej.')}</Notice>}
            {reviewing && (
              <dl className="answers-review">
                {steps.map((item, i) => (
                  <div key={item.linkId}>
                    <dt>{t(item.text ?? '')}</dt>
                    <dd>
                      {answerText(item, answers, t) || <span className="muted">{t('bez odpowiedzi')}</span>}{' '}
                      <button type="button" className="link-btn" onClick={() => setStep(i)} aria-label={t('Zmień odpowiedź: {q}', { q: t(item.text ?? '') })}>
                        {t('Zmień')}
                      </button>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {reviewing && notes.map((n) => <p key={n.linkId} className="small muted" style={{ margin: 0 }}>{t(n.text ?? '')}</p>)}
          </div>
          {error}
          <div className="btn-row">
            {step > 0 && (
              <Button variant="secondary" onClick={() => setStep(step - 1)}>
                {t('Wstecz')}
              </Button>
            )}
            {reviewing ? (
              <Button onClick={() => onSubmit(answers)} loading={submitting}>
                {label}
              </Button>
            ) : (
              <Button onClick={next}>{step === steps.length - 1 ? t('Podsumowanie') : t('Dalej')}</Button>
            )}
            {footer}
          </div>
        </div>
      )}
    </div>
  );
}
