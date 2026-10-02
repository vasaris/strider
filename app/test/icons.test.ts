// The committed icons are exactly what scripts/gen-icons.mjs draws. Compared by IHDR +
// inflated IDAT (filtered scanlines incl. filter-type bytes; the generator always writes
// filter 0), not file bytes: deflate output may differ across Node/zlib versions, the
// inflated stream may not. Stricter than pixel equality (a valid re-encode with other
// filters would fail) -- fine, the committed icons are by definition the generator's output.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { decodePng } from './png';

const APP = fileURLToPath(new URL('..', import.meta.url));
const COMMITTED = join(APP, 'public', 'icons');
const tmp = mkdtempSync(join(tmpdir(), 'brodyazhnik-icons-'));

afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('gen-icons', () => {
  it('regenerates the committed icons scanline for scanline', () => {
    execFileSync(process.execPath, [join(APP, 'scripts', 'gen-icons.mjs'), '--out', tmp], { stdio: 'pipe' });
    const committed = readdirSync(COMMITTED).filter((f) => f.endsWith('.png')).sort();
    expect(readdirSync(tmp).sort()).toEqual(committed);
    expect(committed).toEqual(['icon-192.png', 'icon-512.png', 'icon-maskable-512.png']);
    for (const file of committed) {
      const a = decodePng(readFileSync(join(COMMITTED, file)));
      const b = decodePng(readFileSync(join(tmp, file)));
      expect({ ...b, scanlines: undefined }, file).toEqual({ ...a, scanlines: undefined });
      expect(b.scanlines.equals(a.scanlines), `${file} scanlines`).toBe(true);
    }
  });

  it('uses no transcendental math or clock in the generator', () => {
    const src = readFileSync(join(APP, 'scripts', 'gen-icons.mjs'), 'utf8');
    expect(src).not.toMatch(/Math\.(sin|cos|tan|atan2?|random|sqrt|hypot|exp|log|pow)\b|\bDate\b/);
  });
});
