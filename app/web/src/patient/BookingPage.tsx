import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CalendarCheck, Check, Clock, MapPin, Stethoscope, Video } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { get, post, put, qs } from '../api';
import { errorCode, errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { useSession } from '../session';
import type { AppointmentView, LocationView, PractitionerView, ServiceView, SlotView } from '../types';
import { Badge, Button, Card, Notice, PageHead, QueryError, Skeleton, TextArea, useToast } from '../ui';
import { SlotPicker } from '../ui/SlotPicker';

interface Catalog {
  services: ServiceView[];
  practitioners: PractitionerView[];
  locations: LocationView[];
}

export function BookingPage() {
  const { t, fmt } = useI18n();
  const { config } = useSession();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [params] = useSearchParams();
  const rescheduleId = params.get('przeloz') ?? undefined;
  const catalog = useQuery({ queryKey: ['catalog'], queryFn: () => get<Catalog>('/api/catalog') });
  const original = useQuery({
    queryKey: ['appointment', rescheduleId],
    queryFn: () => get<AppointmentView>(`/api/me/appointments/${rescheduleId}`),
    enabled: !!rescheduleId,
  });

  const [serviceId, setServiceId] = useState<string | undefined>(params.get('service') ?? undefined);
  const [practitionerId, setPractitionerId] = useState<string>('any');
  const [slot, setSlot] = useState<SlotView | undefined>();
  const [comment, setComment] = useState('');

  const effectiveServiceId = rescheduleId ? original.data?.serviceId : serviceId;
  const service = catalog.data?.services.find((s) => s.id === effectiveServiceId);
  const practitioners = useMemo(
    () => catalog.data?.practitioners.filter((p) => service && p.serviceIds.includes(service.id)) ?? [],
    [catalog.data, service],
  );
  const step = !service ? 1 : !slot ? 2 : 3;

  const availability = useQuery({
    queryKey: ['availability', effectiveServiceId, practitionerId],
    queryFn: () =>
      get<{ slots: SlotView[] }>(
        `/api/availability${qs({ serviceId: effectiveServiceId, practitionerId: practitionerId === 'any' ? undefined : practitionerId, to: new Date(Date.now() + 42 * 86_400_000).toISOString() })}`,
      ),
    enabled: !!effectiveServiceId,
  });

  const book = useMutation({
    mutationFn: () =>
      rescheduleId
        ? post<AppointmentView>(`/api/me/appointments/${rescheduleId}/reschedule`, { slotId: slot?.id })
        : post<AppointmentView>('/api/me/appointments', { slotId: slot?.id, serviceId: service?.id, comment: comment || undefined }),
    onSuccess: (a) => {
      void qc.invalidateQueries({ queryKey: ['appointments'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast(rescheduleId ? t('Termin wizyty został zmieniony.') : t('Wizyta zarezerwowana.'));
      nav(`/wizyty/${a.id}`, { replace: true });
    },
    onError: (err) => {
      if (errorCode(err) === 'slot_taken') {
        setSlot(undefined);
        void availability.refetch();
      }
    },
  });

  const grantTele = useMutation({
    mutationFn: () => put('/api/me/consents/telemedicine', { granted: true }),
    onSuccess: () => book.mutate(),
  });

  const waitlist = useMutation({
    mutationFn: () => post('/api/me/waitlist', { serviceId: service?.id, practitionerId: practitionerId === 'any' ? undefined : practitionerId }),
    onSuccess: () => toast(t('Zapisano na listę oczekujących. Powiadomimy Cię, gdy zwolni się termin.')),
  });

  if (catalog.isLoading || (rescheduleId && original.isLoading)) return <Skeleton count={4} />;
  if (catalog.isError) return <QueryError error={catalog.error} retry={() => void catalog.refetch()} />;
  const location = service?.locationIds[0] ? catalog.data?.locations.find((l) => l.id === service.locationIds[0]) : undefined;

  return (
    <div className="stack-lg">
      <PageHead
        title={rescheduleId ? t('Zmiana terminu') : t('Umów wizytę')}
        sub={rescheduleId && original.data ? `${original.data.serviceName} · ${t('obecnie')}: ${fmt.dateTime(original.data.start)}` : undefined}
        back={{ to: rescheduleId ? `/wizyty/${rescheduleId}` : '/', label: t('Wróć') }}
      />
      <div className="steps" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span key={n} className={n <= step ? 'done' : ''} />
        ))}
      </div>

      {!rescheduleId && (
        <section className="stack" aria-labelledby="svc-h">
          <h2 id="svc-h">1. {t('Wybierz usługę')}</h2>
          <div className="stack" style={{ gap: 8 }}>
            {catalog.data?.services.map((s) => (
              <button
                key={s.id}
                type="button"
                className="option-card"
                aria-pressed={s.id === serviceId}
                onClick={() => {
                  setServiceId(s.id);
                  setSlot(undefined);
                  setPractitionerId('any');
                }}
              >
                <span className="list-icon">{s.mode === 'tele' ? <Video size={20} /> : <Stethoscope size={20} />}</span>
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>{s.name}</span>
                  <span className="list-sub">
                    {s.durationMinutes} min{s.mode === 'tele' ? ` · ${t('teleporada wideo')}` : ''}
                    {s.description ? ` · ${s.description}` : ''}
                  </span>
                </span>
                <span className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                  {s.price !== undefined && <strong className="nowrap">{fmt.money(s.price)}</strong>}
                  {s.id === serviceId && <Check size={18} color="var(--primary)" aria-hidden />}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {service && (
        <section className="stack" aria-labelledby="slot-h">
          <h2 id="slot-h">{rescheduleId ? '' : '2. '}{t('Wybierz termin')}</h2>
          {practitioners.length > 1 && !rescheduleId && (
            <div className="segmented" role="group" aria-label={t('Lekarz')}>
              <button type="button" aria-pressed={practitionerId === 'any'} onClick={() => { setPractitionerId('any'); setSlot(undefined); }}>
                {t('Dowolny lekarz')}
              </button>
              {practitioners.map((p) => (
                <button key={p.id} type="button" aria-pressed={practitionerId === p.id} onClick={() => { setPractitionerId(p.id); setSlot(undefined); }}>
                  {p.name}
                </button>
              ))}
            </div>
          )}
          {availability.isLoading && <Skeleton height={56} count={3} />}
          {availability.isError && <QueryError error={availability.error} retry={() => void availability.refetch()} />}
          {availability.data && <SlotPicker slots={availability.data.slots} value={slot?.id} onChange={setSlot} showPractitioner={practitionerId === 'any' && practitioners.length > 1} />}
          {availability.data && !rescheduleId && (
            <Button variant="ghost" size="sm" icon={<BellRing size={16} />} onClick={() => waitlist.mutate()} loading={waitlist.isPending} style={{ alignSelf: 'flex-start' }}>
              {t('Powiadom mnie o wcześniejszym terminie')}
            </Button>
          )}
        </section>
      )}

      {service && slot && (
        <Card as="section">
          <h2>{rescheduleId ? t('Potwierdź nowy termin') : `3. ${t('Potwierdź rezerwację')}`}</h2>
          <dl className="kv" style={{ marginBottom: 14 }}>
            <dt>{t('Usługa')}</dt>
            <dd>
              {service.name} {service.mode === 'tele' && <Badge kind="info">{t('Teleporada')}</Badge>}
            </dd>
            <dt>{t('Termin')}</dt>
            <dd>
              <Clock size={15} aria-hidden style={{ verticalAlign: '-2px' }} /> {fmt.dateLong(slot.start)}, {fmt.time(slot.start)}–{fmt.time(slot.end)}
            </dd>
            <dt>{t('Lekarz')}</dt>
            <dd>{slot.practitionerName}</dd>
            {service.mode !== 'tele' && location && (
              <>
                <dt>{t('Miejsce')}</dt>
                <dd>
                  <MapPin size={15} aria-hidden style={{ verticalAlign: '-2px' }} /> {location.name}
                  {location.address ? `, ${location.address}` : ''}
                </dd>
              </>
            )}
            {service.price !== undefined && (
              <>
                <dt>{t('Cena')}</dt>
                <dd>{fmt.money(service.price)} <span className="muted small">({t('płatność w placówce')})</span></dd>
              </>
            )}
          </dl>
          {service.preparation && (
            <Notice kind="info" title={t('Przygotowanie')}>
              {service.preparation}
            </Notice>
          )}
          {!rescheduleId && (
            <div style={{ marginTop: 12 }}>
              <TextArea
                label={t('Informacja dla placówki (opcjonalnie)')}
                hint={t('Np. wizyta kontrolna. Nie opisuj tu objawów nagłych — w nagłym przypadku dzwoń 112.')}
                maxLength={500}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>
          )}
          <p className="small muted" style={{ marginTop: 10 }}>
            {t('Wizytę możesz odwołać lub przełożyć w aplikacji do {h} godz. przed jej rozpoczęciem.', { h: config?.clinic.cancelMinHours ?? 12 })}
          </p>
          {book.isError && errorCode(book.error) === 'telemedicine_consent_required' ? (
            <Notice kind="warn" title={t('Zgoda na teleporadę')}>
              <p>{t('Teleporada odbywa się przez połączenie wideo w przeglądarce. Aby kontynuować, potwierdź zgodę na udział w teleporadach (możesz ją wycofać w ustawieniach prywatności).')}</p>
              <Button size="sm" onClick={() => grantTele.mutate()} loading={grantTele.isPending}>
                {t('Wyrażam zgodę i rezerwuję')}
              </Button>
            </Notice>
          ) : (
            book.isError && <Notice kind="danger">{errorMessage(book.error, t)}</Notice>
          )}
          <div className="btn-row" style={{ marginTop: 14 }}>
            <Button onClick={() => book.mutate()} loading={book.isPending} icon={<CalendarCheck size={18} />}>
              {rescheduleId ? t('Zmień termin') : t('Rezerwuję')}
            </Button>
            <Button variant="secondary" onClick={() => setSlot(undefined)}>
              {t('Wybierz inny termin')}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
