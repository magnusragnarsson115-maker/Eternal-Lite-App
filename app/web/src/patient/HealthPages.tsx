import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bluetooth, Link2, Pill, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, del, get, post, put, qs } from '../api';
import { errorMessage } from '../errors';
import { useI18n } from '../i18n';
import { BLE_PROFILES, bluetoothSupported, readFromDevice, type BleKind, type BleReading } from '../lib/ble';
import type { MeasurementView, MedicationView, VitalKind } from '../types';
import { Badge, Button, Card, Combobox, Empty, Modal, Notice, PageHead, QueryError, Segmented, SelectField, Skeleton, Switch, TextField, useConfirm, useToast } from '../ui';
import { TrendChart } from '../ui/TrendChart';

const KINDS: { value: VitalKind; label: string; unit: string }[] = [
  { value: 'bp', label: 'Ciśnienie', unit: 'mmHg' },
  { value: 'heartRate', label: 'Tętno', unit: '/min' },
  { value: 'weight', label: 'Waga', unit: 'kg' },
  { value: 'spo2', label: 'Saturacja', unit: '%' },
  { value: 'temperature', label: 'Temperatura', unit: '°C' },
  { value: 'glucose', label: 'Glukoza', unit: 'mg/dL' },
];

const SOURCE_LABEL: Record<string, string> = { manual: 'ręcznie', bluetooth: 'Bluetooth', withings: 'Withings' };

function sourceLabel(s: string, t: (x: string) => string): string {
  if (s.startsWith('rpm:')) return `RPM · ${s.slice(4)}`;
  return t(SOURCE_LABEL[s] ?? s);
}

export function MeasurementsPage() {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [kind, setKind] = useState<VitalKind>('bp');
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [addOpen, setAddOpen] = useState(false);
  const [bleReading, setBleReading] = useState<{ reading: BleReading; deviceName: string } | null>(null);
  const [bleBusy, setBleBusy] = useState(false);
  const [bleError, setBleError] = useState('');
  const { confirm, dialog } = useConfirm();

  const q = useQuery({
    queryKey: ['measurements', kind],
    queryFn: () => get<{ items: MeasurementView[]; sharedWithClinic: boolean }>(`/api/me/measurements${qs({ kind })}`),
  });
  const integrations = useQuery({ queryKey: ['integrations'], queryFn: () => get<{ withings: { available: boolean; connected: boolean; lastSyncAt?: string } }>('/api/me/integrations') });

  useEffect(() => {
    const w = params.get('withings');
    if (w) {
      toast(w === 'connected' ? t('Połączono konto Withings. Trwa import pomiarów.') : t('Nie udało się połączyć konta Withings.'), w === 'connected' ? 'info' : 'error');
      setParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const share = useMutation({
    mutationFn: (granted: boolean) => put('/api/me/consents/share-measurements', { granted }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['measurements'] }),
  });
  const saveBle = useMutation({
    mutationFn: () => {
      const r = bleReading!.reading;
      return post('/api/me/measurements', {
        kind: r.kind,
        systolic: r.systolic,
        diastolic: r.diastolic,
        pulse: r.pulse,
        value: r.value,
        effective: r.timestamp,
        source: 'bluetooth',
        device: bleReading!.deviceName,
      });
    },
    onSuccess: () => {
      setBleReading(null);
      void qc.invalidateQueries({ queryKey: ['measurements'] });
      toast(t('Pomiar zapisany.'));
    },
  });
  const retract = useMutation({
    mutationFn: (id: string) => del(`/api/me/measurements/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['measurements'] }),
  });
  const withingsConnect = useMutation({
    mutationFn: () => post<{ url: string }>('/api/me/integrations/withings/connect'),
    onSuccess: (r) => {
      window.location.href = r.url;
    },
  });
  const withingsSync = useMutation({
    mutationFn: () => post<{ imported: number }>('/api/me/integrations/withings/sync'),
    onSuccess: (r) => {
      toast(t('Zaimportowano {n} pomiarów.', { n: r.imported }));
      void qc.invalidateQueries({ queryKey: ['measurements'] });
      void qc.invalidateQueries({ queryKey: ['integrations'] });
    },
  });

  const items = q.data?.items ?? [];
  const chronological = useMemo(() => [...items].sort((a, b) => a.effective.localeCompare(b.effective)).slice(-60), [items]);
  const meta = KINDS.find((k) => k.value === kind)!;
  const bleKind = (kind in BLE_PROFILES ? kind : undefined) as BleKind | undefined;

  const connectBle = async () => {
    if (!bleKind) return;
    setBleError('');
    setBleBusy(true);
    try {
      setBleReading(await readFromDevice(bleKind));
    } catch (err) {
      const e = err as Error;
      if (e.name !== 'NotFoundError') setBleError(e.message === 'bluetooth_timeout' ? t('Nie otrzymano pomiaru. Wykonaj pomiar na urządzeniu po połączeniu.') : t('Nie udało się połączyć z urządzeniem: {m}', { m: e.message }));
    } finally {
      setBleBusy(false);
    }
  };

  return (
    <div className="stack-lg">
      <PageHead title={t('Pomiary domowe')} sub={t('Notuj wyniki pomiarów i — jeśli chcesz — udostępniaj je lekarzowi.')} action={<Button icon={<Plus size={18} />} onClick={() => setAddOpen(true)}>{t('Dodaj pomiar')}</Button>} />

      <Card>
        <div className="row-between">
          <div className="grow">
            <strong>{t('Przekazuj pomiary placówce')}</strong>
            <p className="small muted" style={{ margin: 0 }}>{t('Lekarz zobaczy Twoje pomiary w karcie pacjenta. Możesz to wyłączyć w każdej chwili.')}</p>
          </div>
          <Switch checked={!!q.data?.sharedWithClinic} onChange={(v) => share.mutate(v)} label={t('Przekazuj pomiary placówce')} disabled={share.isPending || !q.data} />
        </div>
      </Card>

      <Segmented label={t('Rodzaj pomiaru')} value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k.value, label: t(k.label) }))} />

      <Card
        title={<h2>{t(meta.label)}</h2>}
        action={
          <Segmented
            label={t('Widok')}
            value={view}
            onChange={setView}
            options={[
              { value: 'chart', label: t('Wykres') },
              { value: 'table', label: t('Tabela') },
            ]}
          />
        }
      >
        {q.isLoading && <Skeleton height={200} count={1} />}
        {q.isError && <QueryError error={q.error} />}
        {q.data && items.length === 0 && <Empty title={t('Brak pomiarów')}>{t('Dodaj pierwszy pomiar ręcznie lub z urządzenia Bluetooth.')}</Empty>}
        {q.data && items.length > 0 && view === 'chart' && (
          <TrendChart
            dates={chronological.map((m) => m.effective)}
            unit={meta.unit}
            series={
              kind === 'bp'
                ? [
                    { key: 'sys', label: t('Skurczowe'), color: 'var(--chart-line)', values: chronological.map((m) => m.systolic) },
                    { key: 'dia', label: t('Rozkurczowe'), color: 'var(--chart-line-2)', values: chronological.map((m) => m.diastolic) },
                  ]
                : [{ key: 'v', label: t(meta.label), color: 'var(--chart-line)', values: chronological.map((m) => m.value) }]
            }
          />
        )}
        {q.data && items.length > 0 && view === 'table' && (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t('Data')}</th>
                  <th scope="col" className="num">{t('Wartość')}</th>
                  <th scope="col">{t('Źródło')}</th>
                  <th scope="col"><span className="sr-only">{t('Akcje')}</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) => (
                  <tr key={m.id}>
                    <td>{fmt.dateTime(m.effective)}</td>
                    <td className="num" style={{ fontWeight: 650 }}>
                      {m.kind === 'bp' ? `${m.systolic}/${m.diastolic}` : fmt.number(m.value)} {m.unit}
                    </td>
                    <td>
                      <Badge>{sourceLabel(m.source, t)}</Badge> {m.device && <span className="small muted">{m.device}</span>}
                    </td>
                    <td>
                      {(m.source === 'manual' || m.source === 'bluetooth') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={t('Usuń pomiar')}
                          icon={<Trash2 size={16} />}
                          onClick={async () => {
                            if (await confirm({ title: t('Usunąć pomiar?'), body: t('Pomiar zostanie oznaczony jako wprowadzony omyłkowo.'), confirmLabel: t('Usuń'), danger: true })) retract.mutate(m.id);
                          }}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="small muted" style={{ marginTop: 10 }}>{t('Aplikacja nie ocenia pomiarów. Niepokojące objawy omów z lekarzem; w nagłym przypadku dzwoń 112.')}</p>
      </Card>

      <div className="grid-2">
        <Card title={<h3>{t('Urządzenie Bluetooth')}</h3>}>
          {bluetoothSupported() ? (
            bleKind ? (
              <>
                <p className="small muted">{t('Obsługujemy urządzenia zgodne ze standardem Bluetooth (profil {p}). Włącz urządzenie, połącz i wykonaj pomiar.', { p: t(BLE_PROFILES[bleKind].label) })}</p>
                <Button variant="secondary" icon={<Bluetooth size={18} />} onClick={() => void connectBle()} loading={bleBusy}>
                  {bleBusy ? t('Czekam na pomiar…') : t('Połącz: {d}', { d: t(BLE_PROFILES[bleKind].label) })}
                </Button>
                {bleError && <Notice kind="danger">{bleError}</Notice>}
              </>
            ) : (
              <p className="small muted">{t('Dla tego rodzaju pomiaru nie ma standardowego profilu Bluetooth — wpisz wynik ręcznie.')}</p>
            )
          ) : (
            <p className="small muted">{t('Twoja przeglądarka nie obsługuje Web Bluetooth. Użyj Chrome lub Edge na Androidzie albo komputerze.')}</p>
          )}
        </Card>
        <Card title={<h3>Withings</h3>}>
          {!integrations.data?.withings.available ? (
            <p className="small muted">{t('Placówka nie włączyła jeszcze integracji z Withings.')}</p>
          ) : integrations.data.withings.connected ? (
            <>
              <p className="small muted">
                {t('Połączono.')} {integrations.data.withings.lastSyncAt ? t('Ostatni import: {d}', { d: fmt.dateTime(integrations.data.withings.lastSyncAt) }) : ''}
              </p>
              <div className="btn-row">
                <Button variant="secondary" size="sm" icon={<RefreshCw size={16} />} onClick={() => withingsSync.mutate()} loading={withingsSync.isPending}>
                  {t('Importuj teraz')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    await api('/api/me/integrations/withings', { method: 'DELETE' });
                    void integrations.refetch();
                  }}
                >
                  {t('Odłącz')}
                </Button>
              </div>
              {withingsSync.isError && <Notice kind="danger">{errorMessage(withingsSync.error, t)}</Notice>}
            </>
          ) : (
            <>
              <p className="small muted">{t('Połącz konto Withings, aby automatycznie importować pomiary z wagi i ciśnieniomierza.')}</p>
              <Button variant="secondary" size="sm" icon={<Link2 size={16} />} onClick={() => withingsConnect.mutate()} loading={withingsConnect.isPending}>
                {t('Połącz konto')}
              </Button>
            </>
          )}
        </Card>
      </div>

      <AddMeasurementModal open={addOpen} onClose={() => setAddOpen(false)} initialKind={kind} />

      <Modal
        open={!!bleReading}
        onClose={() => setBleReading(null)}
        title={t('Odczytano pomiar')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setBleReading(null)}>
              {t('Odrzuć')}
            </Button>
            <Button onClick={() => saveBle.mutate()} loading={saveBle.isPending}>
              {t('Zapisz')}
            </Button>
          </>
        }
      >
        {bleReading && (
          <div className="stack">
            <p className="muted">{bleReading.deviceName}</p>
            <p style={{ fontSize: '2rem', fontWeight: 750, margin: 0 }}>
              {bleReading.reading.kind === 'bp' ? `${bleReading.reading.systolic}/${bleReading.reading.diastolic}` : bleReading.reading.value} {bleReading.reading.unit}
            </p>
            {bleReading.reading.pulse !== undefined && <p>{t('Tętno')}: {bleReading.reading.pulse} /min</p>}
            {saveBle.isError && <Notice kind="danger">{errorMessage(saveBle.error, t)}</Notice>}
          </div>
        )}
      </Modal>
      {dialog}
    </div>
  );
}

function AddMeasurementModal({ open, onClose, initialKind }: { open: boolean; onClose: () => void; initialKind: VitalKind }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const nowLocal = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  };
  const [f, setF] = useState({ kind: initialKind, systolic: '', diastolic: '', pulse: '', value: '', when: nowLocal(), note: '' });
  useEffect(() => {
    if (open) setF((x) => ({ ...x, kind: initialKind, when: nowLocal() }));
  }, [open, initialKind]);
  const num = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));
  const save = useMutation({
    mutationFn: () =>
      post('/api/me/measurements', {
        kind: f.kind,
        systolic: num(f.systolic),
        diastolic: num(f.diastolic),
        pulse: num(f.pulse),
        value: num(f.value),
        effective: new Date(f.when).toISOString(),
        note: f.note || undefined,
        source: 'manual',
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['measurements'] });
      toast(t('Pomiar zapisany.'));
      setF({ ...f, systolic: '', diastolic: '', pulse: '', value: '', note: '' });
      onClose();
    },
  });
  const unit = KINDS.find((k) => k.value === f.kind)?.unit;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('Dodaj pomiar')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('Anuluj')}
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending}>
            {t('Zapisz')}
          </Button>
        </>
      }
    >
      <div className="stack">
        <SelectField label={t('Rodzaj')} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as VitalKind })}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {t(k.label)}
            </option>
          ))}
        </SelectField>
        {f.kind === 'bp' ? (
          <div className="grid-3">
            <TextField label={t('Skurczowe (mmHg)')} inputMode="numeric" value={f.systolic} onChange={(e) => setF({ ...f, systolic: e.target.value })} />
            <TextField label={t('Rozkurczowe (mmHg)')} inputMode="numeric" value={f.diastolic} onChange={(e) => setF({ ...f, diastolic: e.target.value })} />
            <TextField label={t('Tętno (/min)')} inputMode="numeric" value={f.pulse} onChange={(e) => setF({ ...f, pulse: e.target.value })} />
          </div>
        ) : (
          <TextField label={`${t('Wartość')} (${unit})`} inputMode="decimal" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} />
        )}
        <TextField label={t('Data i godzina')} type="datetime-local" value={f.when} max={nowLocal()} onChange={(e) => setF({ ...f, when: e.target.value })} />
        <TextField label={t('Notatka (opcjonalnie)')} maxLength={300} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        {save.isError && <Notice kind="danger">{errorMessage(save.error, t)}</Notice>}
      </div>
    </Modal>
  );
}

interface DrugHit {
  id: string;
  name: string;
  commonName?: string;
  strength?: string;
  form?: string;
}

export function MedicationsPage() {
  const { t, fmt } = useI18n();
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const [f, setF] = useState({ name: '', rplId: '', dosage: '', since: '' });
  const q = useQuery({ queryKey: ['medications'], queryFn: () => get<{ items: MedicationView[] }>('/api/me/medications') });
  const add = useMutation({
    mutationFn: () => post('/api/me/medications', { name: f.name, rplId: f.rplId || undefined, dosage: f.dosage || undefined, since: f.since || undefined }),
    onSuccess: () => {
      setF({ name: '', rplId: '', dosage: '', since: '' });
      void qc.invalidateQueries({ queryKey: ['medications'] });
    },
  });
  const stop = useMutation({
    mutationFn: (id: string) => del(`/api/me/medications/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['medications'] }),
  });
  return (
    <div className="stack-lg">
      <PageHead title={t('Przyjmowane leki')} sub={t('Lista pomoże lekarzowi przygotować się do wizyty. Aplikacja nie sprawdza interakcji ani dawkowania.')} />
      <Card title={<h2>{t('Dodaj lek')}</h2>}>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <Combobox<DrugHit>
            label={t('Wyszukaj w Rejestrze Produktów Leczniczych')}
            placeholder={t('np. nazwa leku lub substancji')}
            hint={t('Wyszukiwanie odbywa się lokalnie — zapytanie nie opuszcza serwera placówki.')}
            search={async (term, signal) => (await get<{ items: DrugHit[] }>(`/api/drugs${qs({ q: term })}`, signal)).items}
            render={(d) => (
              <span>
                <strong>{d.name}</strong> {d.strength} <span className="muted small">{d.form}{d.commonName ? ` · ${d.commonName}` : ''}</span>
              </span>
            )}
            onSelect={(d) => setF({ ...f, name: [d.name, d.strength, d.form].filter(Boolean).join(', '), rplId: d.id })}
          />
          <TextField label={t('Nazwa leku')} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, rplId: '' })} required maxLength={200} hint={f.rplId ? t('Powiązano z Rejestrem Produktów Leczniczych.') : t('Możesz też wpisać nazwę ręcznie.')} />
          <div className="grid-2">
            <TextField label={t('Dawkowanie')} placeholder={t('np. 1 tabletka rano')} value={f.dosage} onChange={(e) => setF({ ...f, dosage: e.target.value })} maxLength={200} />
            <TextField label={t('Od kiedy (miesiąc)')} type="month" value={f.since} onChange={(e) => setF({ ...f, since: e.target.value })} />
          </div>
          {add.isError && <Notice kind="danger">{errorMessage(add.error, t)}</Notice>}
          <Button type="submit" icon={<Plus size={18} />} loading={add.isPending} disabled={!f.name.trim()} style={{ alignSelf: 'flex-start' }}>
            {t('Dodaj do listy')}
          </Button>
        </form>
      </Card>
      {q.isLoading && <Skeleton />}
      {q.data && q.data.items.length === 0 && <Empty icon={<Pill size={36} />} title={t('Lista leków jest pusta')} />}
      {q.data && q.data.items.length > 0 && (
        <div className="card card-flush">
          <ul className="list">
            {q.data.items.map((m) => (
              <li key={m.id} className="list-item">
                <span className="list-icon">
                  <Pill size={20} />
                </span>
                <span className="grow">
                  <span className="list-title" style={{ display: 'block' }}>{m.name}</span>
                  <span className="list-sub">
                    {[m.dosage, m.since ? t('od {d}', { d: m.since }) : '', t('dodano {d}', { d: fmt.date(m.reportedAt) })].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    if (await confirm({ title: t('Nie przyjmujesz już tego leku?'), body: m.name, confirmLabel: t('Oznacz jako odstawiony') })) stop.mutate(m.id);
                  }}
                >
                  {t('Odstawiony')}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {dialog}
    </div>
  );
}
