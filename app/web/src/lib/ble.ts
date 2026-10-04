/**
 * Web Bluetooth — odczyt z urządzeń medycznych zgodnych ze standardowymi profilami GATT Bluetooth SIG.
 * Działa w Chrome/Edge (Android, Windows, macOS, ChromeOS); nie działa w Safari/iOS.
 * Parsery są czystymi funkcjami (testy jednostkowe w tests/unit/ble.test.ts).
 */

export type BleKind = 'bp' | 'heartRate' | 'weight' | 'temperature' | 'spo2';

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
};

/** IEEE 11073-20601 SFLOAT (16 bit): 12-bitowa mantysa i 4-bitowy wykładnik, oba ze znakiem. */
export function readSfloat(view: DataView, offset: number): number {
  const raw = view.getUint16(offset, true);
  if (raw === 0x07ff || raw === 0x0800 || raw === 0x07fe || raw === 0x0802 || raw === 0x0801) return Number.NaN;
  let mantissa = raw & 0x0fff;
  let exponent = raw >> 12;
  if (mantissa >= 0x0800) mantissa -= 0x1000;
  if (exponent >= 0x8) exponent -= 0x10;
  return round(mantissa * 10 ** exponent);
}

/** IEEE 11073-20601 FLOAT (32 bit): 24-bitowa mantysa i 8-bitowy wykładnik. */
export function readFloat(view: DataView, offset: number): number {
  const raw = view.getUint32(offset, true);
  let mantissa = raw & 0x00ffffff;
  let exponent = raw >> 24;
  if (mantissa === 0x007fffff || mantissa === 0x00800000 || mantissa === 0x007ffffe || mantissa === 0x00800002) return Number.NaN;
  if (mantissa >= 0x00800000) mantissa -= 0x01000000;
  if (exponent >= 0x80) exponent -= 0x100;
  return round(mantissa * 10 ** exponent);
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

export const PARSERS: Record<BleKind, (v: DataView) => BleReading> = {
  bp: parseBloodPressure,
  heartRate: parseHeartRate,
  weight: parseWeight,
  temperature: parseTemperature,
  spo2: parsePlxSpotCheck,
};

// --- połączenie z urządzeniem (API przeglądarki) ------------------------------------------------------

interface BtCharacteristic extends EventTarget {
  value?: DataView;
  startNotifications(): Promise<BtCharacteristic>;
  stopNotifications(): Promise<BtCharacteristic>;
}
interface BtDevice {
  name?: string;
  gatt?: {
    connect(): Promise<{
      getPrimaryService(s: number): Promise<{ getCharacteristic(c: number): Promise<BtCharacteristic> }>;
      disconnect(): void;
    }>;
  };
}
interface BtNavigator {
  bluetooth?: { requestDevice(opts: { filters: { services: number[] }[] }): Promise<BtDevice> };
}

export function bluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && !!(navigator as unknown as BtNavigator).bluetooth && window.isSecureContext;
}

/**
 * Łączy się z urządzeniem i czeka na pierwszy pomiar (urządzenia wysyłają wynik po zakończeniu pomiaru).
 * Zwraca odczyt i nazwę urządzenia. Przerwanie przez użytkownika rzuca błąd NotFoundError.
 */
export async function readFromDevice(kind: BleKind, timeoutMs = 90_000): Promise<{ reading: BleReading; deviceName: string }> {
  const bt = (navigator as unknown as BtNavigator).bluetooth;
  if (!bt) throw new Error('bluetooth_unsupported');
  const profile = BLE_PROFILES[kind];
  const device = await bt.requestDevice({ filters: [{ services: [profile.service] }] });
  const server = await device.gatt!.connect();
  try {
    const service = await server.getPrimaryService(profile.service);
    const ch = await service.getCharacteristic(profile.characteristic);
    const reading = await new Promise<BleReading>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('bluetooth_timeout')), timeoutMs);
      ch.addEventListener('characteristicvaluechanged', (ev) => {
        const value = (ev.target as BtCharacteristic).value;
        if (!value) return;
        clearTimeout(timer);
        try {
          resolve(PARSERS[kind](value));
        } catch (err) {
          reject(err);
        }
      });
      ch.startNotifications().catch(reject);
    });
    await ch.stopNotifications().catch(() => undefined);
    return { reading, deviceName: device.name ?? profile.label };
  } finally {
    server.disconnect();
  }
}
