// next.config, .gitignore and package scripts carry the R1 and P14 decisions.
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import nextConfig from '../next.config';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('next.config', () => {
  it('disables agent rule files (P14)', () => {
    expect(nextConfig.agentRules).toBe(false);
  });

  it('aliases .js to .ts sources (R1 variant B)', () => {
    expect(nextConfig.experimental?.extensionAlias?.['.js']).toEqual(['.ts', '.tsx', '.js']);
  });
});

describe('app/.gitignore', () => {
  const lines = read('../.gitignore')
    .split('\n')
    .map((l) => l.trim());
  it.each(['AGENTS.md', 'CLAUDE.md', 'next-env.d.ts', '.env*'])('ignores %s', (entry) => {
    expect(lines).toContain(entry);
  });
  it('ignores .next', () => {
    expect(lines.some((l) => l === '.next' || l === '.next/')).toBe(true);
  });
  // P14 files must stay ignored, and a negation (e.g. '!CLAUDE.md') would silently undo an
  // entry above. Text check, not git check-ignore: the reviewer's tree comes from git archive.
  it('has no negation lines', () => {
    expect(lines.filter((l) => l.startsWith('!'))).toEqual([]);
  });
});

describe('app/package.json scripts', () => {
  const scripts = (JSON.parse(read('../package.json')) as { scripts: Record<string, string> }).scripts;
  it('dev and build use webpack', () => {
    expect(scripts['dev']).toMatch(/\bnext dev\b.*--webpack\b/);
    expect(scripts['build']).toMatch(/\bnext build\b.*--webpack\b/);
  });
  it('dev and start bind 127.0.0.1', () => {
    expect(scripts['dev']).toMatch(/-H 127\.0\.0\.1\b/);
    expect(scripts['start']).toMatch(/-H 127\.0\.0\.1\b/);
  });
  it.each(['dev', 'build', 'start'])('%s disables telemetry', (name) => {
    expect(scripts[name]).toMatch(/^NEXT_TELEMETRY_DISABLED=1 /);
  });
});
