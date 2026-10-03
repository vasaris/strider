// /api/health reports the verified pack identity; findRepoRoot walks up to the pack marker.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { GET } from '../src/app/api/health/route';
import { findRepoRoot } from '../src/server/env';

const manifest = JSON.parse(
  readFileSync(new URL('../../content-packs/kv/manifest.json', import.meta.url), 'utf8'),
) as { pack_id: string; pack_version: string };

describe('GET /api/health', () => {
  it('returns 200 with the pack id and version', async () => {
    const res = GET(new Request('http://127.0.0.1:3000/api/health', { headers: { host: '127.0.0.1:3000' } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, pack: { id: manifest.pack_id, version: manifest.pack_version } });
  });

  it('403 forbidden_host for a foreign Host (3.1-C7)', async () => {
    const res = GET(new Request('http://127.0.0.1:3000/api/health', { headers: { host: 'evil.example:3000' } }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: { code: 'forbidden_host', message: 'This host is not allowed.' } });
  });
});

describe('findRepoRoot', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'brodyazhnik-root-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  it('finds the nearest ancestor with content-packs/kv/manifest.json', () => {
    const root = join(tmp, 'repo');
    mkdirSync(join(root, 'content-packs', 'kv'), { recursive: true });
    writeFileSync(join(root, 'content-packs', 'kv', 'manifest.json'), '{}');
    const deep = join(root, 'app', 'src', 'x');
    mkdirSync(deep, { recursive: true });
    expect(findRepoRoot(deep)).toBe(root);
    expect(findRepoRoot(root)).toBe(root);
  });

  it('throws a clear error when no ancestor has the marker', () => {
    const lone = join(tmp, 'lone', 'a');
    mkdirSync(lone, { recursive: true });
    expect(() => findRepoRoot(lone)).toThrow(/findRepoRoot: no content-packs.kv.manifest\.json/);
  });
});
