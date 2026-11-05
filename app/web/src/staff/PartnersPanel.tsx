import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { del, get, post, put } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { Badge, Button, Card, Notice, SelectField, TextField, useToast } from '../ui';

/**
 * Partnerzy przez API (runda 5) — panel administratora: ZnanyLekarz/Docplanner (mapowanie lekarzy i usług,
 * synchronizacja) oraz bramka regulacyjna silnika Infermedica.
 */

interface DpMapping {
  facilityId: string;
  doctors: { practitionerId: string; doctorId: string; addressId: string; services: { serviceId: string; addressServiceId: string }[] }[];
  lastSlotsPushAt?: string;
  lastBookingsPullAt?: string;
}

function DocplannerCard() {
  const { t, fmt } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['docplanner'], queryFn: () => get<{ configured: boolean; domain: string; mapping: DpMapping | null }>('/api/admin/docplanner') });
  const facilities = useQuery({ queryKey: ['dp-facilities'], queryFn: () => get<{ items: { id: string; name: string }[] }>('/api/admin/docplanner/facilities'), enabled: !!q.data?.configured, retry: false });
  const catalog = useQuery({ queryKey: ['admin-catalog'], queryFn: () => get<{ services: { id: string; name: string }[]; practitioners: { id: string; name: string }[] }>('/api/admin/catalog'), enabled: !!q.data?.configured, retry: false });
  const practitioners = { data: { items: catalog.data?.practitioners ?? [] } };
  const services = { data: { items: catalog.data?.services ?? [] } };
  const [facility, setFacility] = useState('');
  const [row, setRow] = useState({ practitionerId: '', doctorId: '', addressId: '', serviceId: '', addressServiceId: '' });
  const doctors = useQuery({ queryKey: ['dp-doctors', facility], queryFn: () => get<{ items: { id: string; name: string }[] }>(`/api/admin/docplanner/facilities/${facility}/doctors`), enabled: !!facility });
  const addresses = useQuery({ queryKey: ['dp-addr', facility, row.doctorId], queryFn: () => get<{ items: { id: string; name: string }[] }>(`/api/admin/docplanner/facilities/${facility}/doctors/${row.doctorId}/addresses`), enabled: !!facility && !!row.doctorId });
  const dpServices = useQuery({
    queryKey: ['dp-svc', facility, row.doctorId, row.addressId],
    queryFn: () => get<{ items: { id: string; name: string }[] }>(`/api/admin/docplanner/facilities/${facility}/doctors/${row.doctorId}/addresses/${row.addressId}/services`),
    enabled: !!facility && !!row.doctorId && !!row.addressId,
  });
  const save = useMutation({
    mutationFn: () => {
      const prev = q.data?.mapping?.facilityId === facility ? q.data.mapping.doctors : [];
      const doctorsMap = [...prev.filter((d) => d.practitionerId !== row.practitionerId), { practitionerId: row.practitionerId, doctorId: row.doctorId, addressId: row.addressId, services: [{ serviceId: row.serviceId, addressServiceId: row.addressServiceId }] }];
      return put('/api/admin/docplanner/mapping', { facilityId: facility, doctors: doctorsMap });
    },
    onSuccess: () => (toast(t('Zapisano mapowanie.')), void qc.invalidateQueries({ queryKey: ['docplanner'] })),
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  const sync = useMutation({
    mutationFn: () => post<{ bookings: { created: number; cancelled: number; skipped: number }; slots: { slots: number } }>('/api/admin/docplanner/sync'),
    onSuccess: (r) => (toast(t('Rezerwacje: nowe {c}, odwołane {x}; wysłane terminy: {s}.', { c: r.bookings.created, x: r.bookings.cancelled, s: r.slots.slots })), void qc.invalidateQueries({ queryKey: ['docplanner'] })),
    onError: (e) => toast(errorMessage(e, t), 'error'),
  });
  const d = q.data;
  return (
    <Card title={t('ZnanyLekarz / Docplanner')} action={d?.configured ? <Badge kind="ok">{t('klucze ustawione')}</Badge> : <Badge kind="info">{t('wymaga kluczy API')}</Badge>}>
      <p className="small muted">{t('Terminy z kalendarza Eternal trafiają do ZnanyLekarz, a rezerwacje i odwołania wracają jako wizyty — przez API, bez widżetu na stronie. Klucze API otrzymują klienci Docplanner (panel → Integracje).')}</p>
      {!d?.configured ? (
        <p className="small mono">DOCPLANNER_CLIENT_ID, DOCPLANNER_CLIENT_SECRET</p>
      ) : (
        <div className="stack">
          {d.mapping && (
            <p className="small">
              {t('Zmapowani lekarze: {n}', { n: d.mapping.doctors.length })} · {t('terminy wysłane')}: {d.mapping.lastSlotsPushAt ? fmt.dateTime(d.mapping.lastSlotsPushAt) : '—'} · {t('rezerwacje pobrane')}: {d.mapping.lastBookingsPullAt ? fmt.dateTime(d.mapping.lastBookingsPullAt) : '—'}
            </p>
          )}
          {facilities.isError && <Notice kind="danger">{errorMessage(facilities.error, t)}</Notice>}
          <div className="grid-2">
            <SelectField label={t('Placówka w ZnanyLekarz')} value={facility} onChange={(e) => setFacility(e.target.value)}>
              <option value="">—</option>
              {(facilities.data?.items ?? []).map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </SelectField>
            <SelectField label={t('Lekarz w Eternal')} value={row.practitionerId} onChange={(e) => setRow({ ...row, practitionerId: e.target.value })}>
              <option value="">—</option>
              {(practitioners.data?.items ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </SelectField>
            <SelectField label={t('Lekarz w ZnanyLekarz')} value={row.doctorId} onChange={(e) => setRow({ ...row, doctorId: e.target.value, addressId: '', addressServiceId: '' })}>
              <option value="">—</option>
              {(doctors.data?.items ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </SelectField>
            <SelectField label={t('Adres (kalendarz)')} value={row.addressId} onChange={(e) => setRow({ ...row, addressId: e.target.value, addressServiceId: '' })}>
              <option value="">—</option>
              {(addresses.data?.items ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </SelectField>
            <SelectField label={t('Usługa w Eternal')} value={row.serviceId} onChange={(e) => setRow({ ...row, serviceId: e.target.value })}>
              <option value="">—</option>
              {(services.data?.items ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </SelectField>
            <SelectField label={t('Usługa w ZnanyLekarz')} value={row.addressServiceId} onChange={(e) => setRow({ ...row, addressServiceId: e.target.value })}>
              <option value="">—</option>
              {(dpServices.data?.items ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="btn-row">
            <Button size="sm" disabled={!facility || !row.practitionerId || !row.doctorId || !row.addressId || !row.serviceId || !row.addressServiceId} loading={save.isPending} onClick={() => save.mutate()}>
              {t('Zapisz mapowanie')}
            </Button>
            <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} disabled={!d.mapping} loading={sync.isPending} onClick={() => sync.mutate()}>
              {t('Synchronizuj teraz')}
            </Button>
          </div>
          <p className="small muted">{t('Synchronizacja w tle co 10 minut. Nowi pacjenci z ZnanyLekarz trafiają do kartoteki z tożsamością niepotwierdzoną.')}</p>
        </div>
      )}
    </Card>
  );
}

function InfermedicaCard() {
  const { t, fmt } = useI18n();
  const toast = useToast();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['infermedica-admin'], queryFn: () => get<{ configured: boolean; regulatory: { reference: string; confirmedBy: string; at: string } | null }>('/api/admin/infermedica') });
  const [ref, setRef] = useState('');
  const [who, setWho] = useState('');
  const save = useMutation({ mutationFn: () => put('/api/admin/infermedica/regulatory', { reference: ref, confirmedBy: who }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['infermedica-admin'] }), onError: (e) => toast(errorMessage(e, t), 'error') });
  const revoke = useMutation({ mutationFn: () => del('/api/admin/infermedica/regulatory'), onSuccess: () => void qc.invalidateQueries({ queryKey: ['infermedica-admin'] }) });
  const d = q.data;
  return (
    <Card title={t('Infermedica — wywiad objawowy (wyrób medyczny)')} action={d?.regulatory ? <Badge kind="ok">{t('odblokowany')}</Badge> : <Badge kind="info">{t('zablokowany')}</Badge>}>
      <Notice kind="warn" title={t('Dlaczego zablokowany')}>
        {t('Silnik Infermedica sam dobiera pytania i podaje triaż — to wyrób medyczny (klasa IIb wg MDR). Certyfikat Infermedica nie obejmuje produktu, który go integruje. Odblokuj dopiero po ocenie zgodności MDR produktu (klasyfikacja, jednostka notyfikowana, instrukcja używania) i umowie powierzenia danych z Infermedica. Do tego czasu działa wywiad z pytaniami zatwierdzonymi przez lekarza.')}
      </Notice>
      {!d?.configured && <p className="small mono">INFERMEDICA_APP_ID, INFERMEDICA_APP_KEY</p>}
      {d?.regulatory ? (
        <div className="stack-sm">
          <p className="small">
            <ShieldCheck size={14} aria-hidden /> {d.regulatory.reference} · {d.regulatory.confirmedBy} · {fmt.dateTime(d.regulatory.at)}
          </p>
          <Button size="sm" variant="ghost" onClick={() => revoke.mutate()}>
            {t('Zablokuj ponownie')}
          </Button>
        </div>
      ) : (
        d?.configured && (
          <div className="stack-sm">
            <TextField label={t('Referencja oceny zgodności MDR (np. numer certyfikatu, deklaracja zgodności)')} value={ref} onChange={(e) => setRef(e.target.value)} />
            <TextField label={t('Osoba odpowiedzialna za zgodność z przepisami (PRRC)')} value={who} onChange={(e) => setWho(e.target.value)} />
            <Button size="sm" disabled={ref.trim().length < 6 || who.trim().length < 5} loading={save.isPending} onClick={() => save.mutate()}>
              {t('Odblokuj silnik')}
            </Button>
          </div>
        )
      )}
    </Card>
  );
}

export function PartnersPanel() {
  const { t } = useI18n();
  return (
    <div className="stack">
      <h3 style={{ margin: '8px 0 0' }}>{t('Partnerzy przez API')}</h3>
      <div className="grid-2">
        <DocplannerCard />
        <InfermedicaCard />
      </div>
    </div>
  );
}
