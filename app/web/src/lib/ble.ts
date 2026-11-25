/**
 * Web Bluetooth — odczyt z urządzeń medycznych zgodnych ze standardowymi profilami GATT Bluetooth SIG.
 * Działa w Chrome/Edge (Android, Windows, macOS, ChromeOS); nie działa w Safari/iOS.
 * Parsery są czystymi funkcjami (testy jednostkowe w tests/unit/ble.test.ts).
 */

export type BleKind = 'bp' | 'heartRate' | 'weight' | 'temperature' | 'spo2' | 'glucose';

export interface BleReading {
  kind: BleKind;
  systolic?: number;
  diastolic?: number;
  pulse?: number;
  value?: number;
  unit: string;
  timestamp?: string;
}

export const BLE_PROFILES: Record<BleKind, { service: number; characteristic: number; label: string }> = {
  bp: { service: 0x1810, characteristic: 0x2a35, label: 'Ciśnieniomierz' },
  heartRate: { service: 0x180d, characteristic: 0x2a37, label: 'Pulsometr' },
  weight: { service: 0x181d, characteristic: 0x2a9d, label: 'Waga' },
  temperature: { service: 0x1809, characteristic: 0x2a1c, label: 'Termometr' },
  spo2: { service: 0x1822, characteristic: 0x2a5e, label: 'Pulsoksymetr' },
  glucose: { service: 0x1808, characteristic: 0x2a18, label: 'Glukometr' },
};

/** Charakterystyki zapasowe: pulsoksymetry wysyłające tylko pomiar ciągły (PLX Continuous, 0x2A5F). */
const FALLBACK: Partial<Record<BleKind, number>> = { spo2: 0x2a5f };

/** IEEE 11073-20601 SFLOAT (16 bit): 12-bitowa mantysa i 4-bitowy wykładnik, oba ze znakiem. */
export function readSfloat(view: DataView, offset: number): number {
  const raw = view.getUint16(offset, true);
  if (raw === 0x07ff || raw === 0x0800 || raw === 0x07fe || raw === 0x0802 || raw === 0x0801) return Number.NaN;
  let mantissa = raw & 0x0fff;
  let exponent = raw >> 12;
  if (mantissa >= 0x0800) mantissa -= 0x1000;
  if (exponent >= 0x8) exponent -= 0x10;
  return decimal(mantissa, exponent);
}

/** IEEE 11073-20601 FLOAT (32 bit): 24-bitowa mantysa i 8-bitowy wykładnik. */
export function readFloat(view: DataView, offset: number): number {
  const raw = view.getUint32(offset, true);
  let mantissa = raw & 0x00ffffff;
  let exponent = raw >> 24;
  if (mantissa === 0x007fffff || mantissa === 0x00800000 || mantissa === 0x007ffffe || mantissa === 0x00800002) return Number.NaN;
  if (mantissa >= 0x00800000) mantissa -= 0x01000000;
  if (exponent >= 0x80) exponent -= 0x100;
  return decimal(mantissa, exponent);
}

/** mantysa × 10^wykładnik bez szumu zmiennoprzecinkowego — tyle miejsc po przecinku, ile wynika z wykładnika. */
function decimal(mantissa: number, exponent: number): number {
  return Number((mantissa * 10 ** exponent).toFixed(Math.min(20, Math.max(0, -exponent))));
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}

function readTimestamp(view: DataView, offset: number): string | undefined {
  const year = view.getUint16(offset, true);
  if (!year) return undefined;
  const d = new Date(year, view.getUint8(offset + 2) - 1, view.getUint8(offset + 3), view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/** Blood Pressure Measurement (0x2A35). */
export function parseBloodPressure(view: DataView): BleReading {
  const flags = view.getUint8(0);
  const kpa = (flags & 0x01) !== 0;
  let offset = 1;
  let systolic = readSfloat(view, offset);
  let diastolic = readSfloat(view, offset + 2);
  offset += 6; // skurczowe, rozkurczowe, MAP
  let timestamp: string | undefined;
  if (flags & 0x02) {
    timestamp = readTimestamp(view, offset);
    offset += 7;
  }
  let pulse: number | undefined;
  if (flags & 0x04) {
    pulse = readSfloat(view, offset);
    offset += 2;
  }
  if (kpa) {
    systolic = Math.round(systolic * 7.50062);
    diastolic = Math.round(diastolic * 7.50062);
  }
  return { kind: 'bp', systolic, diastolic, pulse: pulse !== undefined && Number.isFinite(pulse) ? Math.round(pulse) : undefined, unit: 'mmHg', timestamp };
}

/** Heart Rate Measurement (0x2A37). */
export function parseHeartRate(view: DataView): BleReading {
  const flags = view.getUint8(0);
  const value = flags & 0x01 ? view.getUint16(1, true) : view.getUint8(1);
  return { kind: 'heartRate', value, unit: '/min' };
}

/** Weight Measurement (0x2A9D): SI 0.005 kg, imperial 0.01 lb. */
export function parseWeight(view: DataView): BleReading {
  const flags = view.getUint8(0);
  const imperial = (flags & 0x01) !== 0;
  const raw = view.getUint16(1, true);
  const timestamp = flags & 0x02 ? readTimestamp(view, 3) : undefined;
  const kg = imperial ? raw * 0.01 * 0.45359237 : raw * 0.005;
  return { kind: 'weight', value: Math.round(kg * 10) / 10, unit: 'kg', timestamp };
}

/** Temperature Measurement (0x2A1C). */
export function parseTemperature(view: DataView): BleReading {
  const flags = view.getUint8(0);
  let v = readFloat(view, 1);
  if (flags & 0x01) v = ((v - 32) * 5) / 9;
  const timestamp = flags & 0x02 ? readTimestamp(view, 5) : undefined;
  return { kind: 'temperature', value: Math.round(v * 10) / 10, unit: '°C', timestamp };
}

/** PLX Spot-Check Measurement (0x2A5E). */
export function parsePlxSpotCheck(view: DataView): BleReading {
  const flags = view.getUint8(0);
  const spo2 = readSfloat(view, 1);
  const pr = readSfloat(view, 3);
  const timestamp = flags & 0x01 ? readTimestamp(view, 5) : undefined;
  return { kind: 'spo2', value: spo2, pulse: Number.isFinite(pr) ? Math.round(pr) : undefined, unit: '%', timestamp };
}

/** PLX Continuous Measurement (0x2A5F): SpO2 i tętno „normal” zawsze na początku, dalsze pola wg flag. */
export function parsePlxContinuous(view: DataView): BleReading {
  const spo2 = readSfloat(view, 1);
  const pr = readSfloat(view, 3);
  return { kind: 'spo2', value: spo2, pulse: Number.isFinite(pr) ? Math.round(pr) : undefined, unit: '%' };
}

/**
 * Glucose Measurement (0x2A18): numer sekwencji, czas, opcjonalne przesunięcie czasu, stężenie (SFLOAT) w kg/L
 * albo mol/L wg flagi. Zapisujemy w mg/dL, jak pozostałe pomiary glukozy w aplikacji: kg/L × 100 000, a mol/L
 * przez mmol/L × 18,016 (masa molowa glukozy 180,16 g/mol). Aplikacja zapisuje wartość z urządzenia — nie ocenia jej.
 */
export function parseGlucose(view: DataView): BleReading {
  const flags = view.getUint8(0);
  let offset = 3; // flagi + numer sekwencji
  const timestamp = readTimestamp(view, offset);
  offset += 7;
  if (flags & 0x01) offset += 2; // przesunięcie czasu
  if (!(flags & 0x02)) throw new Error('glucose_no_concentration');
  const raw = readSfloat(view, offset);
  const molPerL = (flags & 0x04) !== 0;
  return { kind: 'glucose', value: Math.round(molPerL ? raw * 1000 * 18.016 : raw * 100_000), unit: 'mg/dL', timestamp };
}

export const PARSERS: Record<BleKind, (v: DataView) => BleReading> = {
  bp: parseBloodPressure,
  heartRate: parseHeartRate,
  weight: parseWeight,
  temperature: parseTemperature,
  spo2: parsePlxSpotCheck,
  glucose: parseGlucose,
};

const FALLBACK_PARSERS: Partial<Record<BleKind, (v: DataView) => BleReading>> = { spo2: parsePlxContinuous };

/** Uniwersalny adapter (F2.21): rodzaj pomiaru po numerze usługi GATT (Bluetooth SIG). */
export function kindForService(uuid: number | string): BleKind | undefined {
  const n = typeof uuid === 'number' ? uuid : parseInt(uuid.length > 8 ? uuid.slice(4, 8) : uuid, 16);
  return (Object.entries(BLE_PROFILES) as [BleKind, { service: number }][]).find(([, p]) => p.service === n)?.[0];
}

// --- połączenie z urządzeniem (API przeglądarki) ------------------------------------------------------

interface BtCharacteristic extends EventTarget {
  value?: DataView;
  writeValue?(data: BufferSource): Promise<void>;
  startNotifications(): Promise<BtCharacteristic>;
  stopNotifications(): Promise<BtCharacteristic>;
}
interface BtService {
  uuid?: string;
  getCharacteristic(c: number): Promise<BtCharacteristic>;
}
interface BtServer {
  getPrimaryService(s: number): Promise<BtService>;
  getPrimaryServices?(): Promise<BtService[]>;
  disconnect(): void;
}
interface BtDevice {
  name?: string;
  gatt?: { connect(): Promise<BtServer> };
}
interface BtNavigator {
  bluetooth?: { requestDevice(opts: { filters: { services: number[] }[]; optionalServices?: number[] }): Promise<BtDevice> };
}

export function bluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as unknown as BtNavigator).bluetooth && window.isSecureContext;
}

/**
 * Łączy się z urządzeniem i czeka na pierwszy pomiar (urządzenia wysyłają wynik po zakończeniu pomiaru).
 * Zwraca odczyt i nazwę urządzenia. Przerwanie przez użytkownika rzuca błąd NotFoundError.
 */
export async function readFromDevice(kind: BleKind | 'any', timeoutMs = 90_000): Promise<{ reading: BleReading; deviceName: string }> {
  const bt = (navigator as unknown as BtNavigator).bluetooth;
  if (!bt) throw new Error('bluetooth_unsupported');
  const all = Object.values(BLE_PROFILES).map((p) => p.service);
  // „dowolne urządzenie”: lista urządzeń z którąkolwiek standardową usługą pomiarową
  const device = await bt.requestDevice(kind === 'any' ? { filters: all.map((s) => ({ services: [s] })), optionalServices: all } : { filters: [{ services: [BLE_PROFILES[kind].service] }] });
  const server = await device.gatt!.connect();
  try {
    let k: BleKind | undefined = kind === 'any' ? undefined : kind;
    if (!k) {
      for (const s of all) {
        const ok = await server.getPrimaryService(s).then(
          () => true,
          () => false,
        );
        if (ok) {
          k = kindForService(s);
          break;
        }
      }
      if (!k) throw new Error('bluetooth_no_supported_service');
    }
    const profile = BLE_PROFILES[k];
    const service = await server.getPrimaryService(profile.service);
    let parse = PARSERS[k];
    let ch: BtCharacteristic;
    try {
      ch = await service.getCharacteristic(profile.characteristic);
    } catch (err) {
      const alt = FALLBACK[k];
      if (!alt) throw err;
      ch = await service.getCharacteristic(alt);
      parse = FALLBACK_PARSERS[k]!;
    }
    const reading = await new Promise<BleReading>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('bluetooth_timeout')), timeoutMs);
      ch.addEventListener('characteristicvaluechanged', (ev) => {
        const value = (ev.target as BtCharacteristic).value;
        if (!value) return;
        clearTimeout(timer);
        try {
          resolve(parse(value));
        } catch (err) {
          reject(err);
        }
      });
      ch.startNotifications()
        .then(async () => {
          // glukometry wysyłają zapisane pomiary dopiero na prośbę: RACP (0x2A52) „ostatni zapis” [0x01, 0x06]
          if (k !== 'glucose') return;
          const racp = await service.getCharacteristic(0x2a52).catch(() => undefined);
          if (!racp?.writeValue) return;
          await racp.startNotifications().catch(() => undefined);
          await racp.writeValue(new Uint8Array([0x01, 0x06])).catch(() => undefined);
        })
        .catch(reject);
    });
    await ch.stopNotifications().catch(() => undefined);
    return { reading, deviceName: device.name ?? profile.label };
  } finally {
    server.disconnect();
  }
}
