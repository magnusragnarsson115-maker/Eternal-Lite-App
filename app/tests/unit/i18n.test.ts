import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EN } from '../../web/src/i18n-en.js';

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []));
}

describe('Tłumaczenie angielskie', () => {
  it('każdy tekst przekazany do t() ma tłumaczenie EN', () => {
    const missing = new Set<string>();
    for (const f of files(path.resolve('web/src'))) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/\bt\(\s*'((?:[^'\\]|\\.)*)'/g)) {
        const s = m[1].replace(/\\'/g, "'");
        if (!(s in EN)) missing.add(`${path.basename(f)}: ${s}`);
      }
    }
    expect([...missing]).toEqual([]);
  });
  it('zmienne w nawiasach klamrowych są zachowane w tłumaczeniu', () => {
    const bad = Object.entries(EN).filter(([pl, en]) => {
      const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
      return vars(pl) !== vars(en);
    });
    expect(bad).toEqual([]);
  });
});
