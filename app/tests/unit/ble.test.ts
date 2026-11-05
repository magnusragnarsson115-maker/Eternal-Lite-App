import { describe, expect, it } from 'vitest';
import { parseBloodPressure, parseHeartRate, parsePlxSpotCheck, parseTemperature, parseWeight, readSfloat } from '../../web/src/lib/ble.js';

const dv = (bytes: number[]) => new DataView(new Uint8Array(bytes).buffer);
const sfloat = (mantissa: number, exp: number) => {
  const raw = ((exp & 0xf) << 12) | (mantissa & 0x0fff);
  return [raw & 0xff, raw >> 8];
};

describe('Web Bluetooth — parsery GATT (IEEE 11073)', () => {
  it('SFLOAT z wykładnikiem ujemnym i wartości specjalne', () => {
    expect(readSfloat(dv(sfloat(365, -1)), 0)).toBe(36.5);
    expect(readSfloat(dv(sfloat(120, 0)), 0)).toBe(120);
    expect(readSfloat(dv([0xff, 0x07]), 0)).toBeNaN();
  });
  it('Blood Pressure Measurement 0x2A35 (mmHg, tętno, znacznik czasu)', () => {
    const ts = [0xea, 0x07, 10, 4, 7, 30, 0]; // 2026-10-04 07:30:00
    const r = parseBloodPressure(dv([0x06, ...sfloat(121, 0), ...sfloat(79, 0), ...sfloat(93, 0), ...ts, ...sfloat(66, 0)]));
    expect(r).toMatchObject({ kind: 'bp', systolic: 121, diastolic: 79, pulse: 66, unit: 'mmHg' });
    expect(r.timestamp).toBeDefined();
  });
  it('Blood Pressure w kPa przelicza na mmHg', () => {
    const r = parseBloodPressure(dv([0x01, ...sfloat(160, -1), ...sfloat(107, -1), ...sfloat(125, -1)]));
    expect(r.systolic).toBe(120);
    expect(r.diastolic).toBe(80);
  });
  it('Heart Rate 0x2A37 (uint8 i uint16)', () => {
    expect(parseHeartRate(dv([0x00, 72])).value).toBe(72);
    expect(parseHeartRate(dv([0x01, 0x2c, 0x01])).value).toBe(300);
  });
  it('Weight 0x2A9D (SI i imperial)', () => {
    expect(parseWeight(dv([0x00, 0xb0, 0x36])).value).toBe(70); // 14000 * 0.005
    expect(parseWeight(dv([0x01, 0x10, 0x27])).value).toBe(45.4); // 10000 * 0.01 lb
  });
  it('Temperature 0x2A1C (FLOAT, °C i °F)', () => {
    expect(parseTemperature(dv([0x00, 0x70, 0x01, 0x00, 0xff])).value).toBe(36.8);
    expect(parseTemperature(dv([0x01, 0xda, 0x03, 0x00, 0xff])).value).toBe(37); // 98.6 °F
  });
  it('PLX Spot-check 0x2A5E', () => {
    expect(parsePlxSpotCheck(dv([0x00, ...sfloat(97, 0), ...sfloat(65, 0)]))).toMatchObject({ value: 97, pulse: 65, unit: '%' });
  });
});
