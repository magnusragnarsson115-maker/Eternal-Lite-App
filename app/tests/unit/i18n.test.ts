import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EN as EN_MOBILE } from '../../mobile/src/i18n-en.js';
import { EN } from '../../web/src/i18n-en.js';
import { SIMPLE as SIMPLE_MOBILE } from '../../mobile/src/simple-pl.js';
import { SIMPLE } from '../../web/src/simple-pl.js';

/** Teksty źródłowe: t('…') oraz <FullText text="…"> (tekst z wersją w prostym języku). */
function literals(src: string): string[] {
  return [
    ...[...src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1].replace(/\\'/g, "'")),
    ...[...src.matchAll(/<FullText\s+text="([^"]*)"/g)].map((m) => m[1]),
  ];
}

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []));
}

describe('Tłumaczenie angielskie', () => {
  it('każdy tekst przekazany do t() ma tłumaczenie EN', () => {
    const missing = new Set<string>();
    for (const f of files(path.resolve('web/src'))) {
      for (const s of literals(fs.readFileSync(f, 'utf8'))) if (!(s in EN)) missing.add(`${path.basename(f)}: ${s}`);
    }
    expect([...missing]).toEqual([]);
  });
  it('aplikacja mobilna: każdy tekst przekazany do t() ma tłumaczenie EN', () => {
    const missing = new Set<string>();
    for (const f of files(path.resolve('mobile/src'))) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) {
        const s = m[1].replace(/\\'/g, "'");
        if (!(s in EN_MOBILE)) missing.add(`${path.basename(f)}: ${s}`);
      }
    }
    expect([...missing]).toEqual([]);
  });
  it('zmienne w nawiasach klamrowych są zachowane w tłumaczeniu', () => {
    const bad = [...Object.entries(EN), ...Object.entries(EN_MOBILE)].filter(([pl, en]) => {
      const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
      return vars(pl) !== vars(en);
    });
    expect(bad).toEqual([]);
  });

  it.each([
    ['web', 'web/src', SIMPLE, EN],
    ['mobile', 'mobile/src', SIMPLE_MOBILE, EN_MOBILE],
  ] as const)('prosty język (A23.2, %s): klucze z interfejsu, tłumaczenia, bez nowych zmiennych, krótkie zdania', (_name, dir, simple, en) => {
    const used = new Set(files(path.resolve(dir)).flatMap((f) => literals(fs.readFileSync(f, 'utf8'))));
    const vars = (s: string) => new Set(s.match(/\{\w+\}/g) ?? []);
    // zasada prostego języka: krótkie zdania (najwyżej 16 słów)
    const longest = (s: string) => Math.max(...s.split(/[.!?]\s/).map((x) => x.trim().split(/\s+/).length));
    const problems = Object.entries(simple).flatMap(([full, plain]) => [
      ...(used.has(full) ? [] : [`nieużywany klucz: ${full.slice(0, 60)}`]),
      ...(plain in en ? [] : [`brak EN: ${plain}`]),
      ...[...vars(plain)].filter((v) => !vars(full).has(v)).map((v) => `nowa zmienna ${v}: ${plain}`),
      ...(longest(plain) <= 16 ? [] : [`zdanie dłuższe niż 16 słów: ${plain}`]),
    ]);
    expect(problems).toEqual([]);
  });
});
