import { CalendarX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { clinicDate, useI18n } from '../i18n';
import type { SlotView } from '../types';
import { Empty } from './index';

/** Wybór dnia i godziny spośród wolnych slotów; grupowanie po dniach w strefie placówki. */
export function SlotPicker({
  slots,
  value,
  onChange,
  showPractitioner,
}: {
  slots: SlotView[];
  value?: string;
  onChange: (slot: SlotView) => void;
  showPractitioner?: boolean;
}) {
  const { t, fmt } = useI18n();
  const byDay = useMemo(() => {
    const m = new Map<string, SlotView[]>();
    for (const s of slots) {
      const d = clinicDate(s.start);
      m.set(d, [...(m.get(d) ?? []), s]);
    }
    return m;
  }, [slots]);
  const days = [...byDay.keys()].sort();
  const [day, setDay] = useState<string | undefined>(days[0]);

  useEffect(() => {
    if (!day || !byDay.has(day)) setDay(days[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots]);

  if (slots.length === 0) {
    return (
      <Empty icon={<CalendarX size={36} />} title={t('Brak wolnych terminów w wybranym okresie')}>
        <p className="small">{t('Spróbuj innego lekarza lub zapisz się na listę oczekujących — powiadomimy Cię o zwolnionym terminie.')}</p>
      </Empty>
    );
  }

  const daySlots = (day && byDay.get(day)) || [];
  const groups = showPractitioner
    ? [...new Set(daySlots.map((s) => s.practitionerName))].map((name) => ({ name, slots: daySlots.filter((s) => s.practitionerName === name) }))
    : [{ name: '', slots: daySlots }];

  return (
    <div className="stack">
      <div className="day-strip" role="group" aria-label={t('Wybierz dzień')}>
        {days.map((d) => {
          const iso = byDay.get(d)![0].start;
          return (
            <button key={d} type="button" className="day-chip" aria-pressed={d === day} onClick={() => setDay(d)} aria-label={`${fmt.dateLong(iso)}, ${t('{n} terminów', { n: byDay.get(d)!.length })}`}>
              <span className="dow">{fmt.weekday(iso)}</span>
              <span className="dom">{fmt.dayNum(iso)}</span>
              <span className="cnt">{byDay.get(d)!.length}</span>
            </button>
          );
        })}
      </div>
      {day && <p className="small muted" style={{ margin: 0 }}>{fmt.dateLong(daySlots[0]?.start)}</p>}
      {groups.map((g) => (
        <div key={g.name} className="stack" style={{ gap: 8 }}>
          {g.name && <h3 style={{ margin: '6px 0 0', fontSize: '0.95rem' }}>{g.name}</h3>}
          <div className="time-grid" role="group" aria-label={t('Wybierz godzinę')}>
            {g.slots.map((s) => (
              <button key={s.id} type="button" className="time-btn" aria-pressed={value === s.id} onClick={() => onChange(s)}>
                {fmt.time(s.start)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
