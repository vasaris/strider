// The web app manifest: fields, and icons that exist with the declared pixel sizes.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import manifest from '../src/app/manifest';
import { PNG_SIGNATURE, decodePng } from './png';

const PUBLIC = fileURLToPath(new URL('../public', import.meta.url));

describe('manifest', () => {
  const m = manifest();

  it('declares the app fields', () => {
    expect(m).toMatchObject({
      id: '/',
      name: 'Бродяжник',
      short_name: 'Бродяжник',
      description: 'Приватный прототип соло-движка',
      lang: 'ru',
      dir: 'ltr',
      start_url: '/',
      scope: '/',
      display: 'standalone',
    });
    expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/);
    expect(m.theme_color).toBe(m.background_color);
  });

  it('lists 192 any, 512 any and one maskable 512, all PNG files with matching IHDR sizes', () => {
    const icons = m.icons ?? [];
    expect(icons.map((i) => [i.sizes, i.purpose])).toEqual([
      ['192x192', 'any'],
      ['512x512', 'any'],
      ['512x512', 'maskable'],
    ]);
    expect(icons.filter((i) => i.purpose === 'maskable')).toHaveLength(1);
    for (const icon of icons) {
      expect(icon.type).toBe('image/png');
      expect(icon.src).toMatch(/^\/icons\/[a-z0-9-]+\.png$/);
      const buf = readFileSync(PUBLIC + icon.src);
      expect(buf.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
      const png = decodePng(buf);
      expect(`${png.width}x${png.height}`).toBe(icon.sizes);
    }
  });
});
