// Offline surface guard (3.1-C4): the SDK is reachable ONLY through the
// `@brodyazhnik/orchestrator/anthropic` subpath. src/index.ts (the offline surface evals and the
// app import by default) must never pull it in.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as api from '../src/index.js';

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = resolve(pkgDir, 'src');

function tsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tsFiles(join(dir, e.name)) : e.name.endsWith('.ts') ? [join(dir, e.name)] : [],
  );
}

describe('offline surface (no SDK through src/index.ts)', () => {
  it('only src/llm/anthropic.ts imports @anthropic-ai/sdk', () => {
    const importers = tsFiles(srcDir)
      .filter((f) => readFileSync(f, 'utf8').includes('@anthropic-ai/sdk'))
      .map((f) => relative(srcDir, f));
    expect(importers).toEqual(['llm/anthropic.ts']);
  });

  it('src/index.ts never references the SDK or the llm/ binding', () => {
    const index = readFileSync(resolve(srcDir, 'index.ts'), 'utf8');
    expect(index).not.toContain('@anthropic-ai/sdk');
    expect(index).not.toMatch(/from '\.\/llm\//);
  });

  it('the index module exposes no AnthropicLlmClient / buildMessageParams, but does expose the seam', () => {
    expect('AnthropicLlmClient' in api).toBe(false);
    expect('buildMessageParams' in api).toBe(false);
    expect('LLM_MAX_TOKENS' in api).toBe(false);
    expect(typeof api.AnthropicKeeper).toBe('function');
    expect(typeof api.loadKeeperSetup).toBe('function');
    expect(typeof api.buildKeeperUser).toBe('function');
    expect(typeof api.startJourney).toBe('function');
    expect(typeof api.loadJourneyEnv).toBe('function');
  });

  it('package.json exports: "." -> src/index.ts, "./anthropic" -> src/llm/anthropic.ts', () => {
    const pkg = JSON.parse(readFileSync(resolve(pkgDir, 'package.json'), 'utf8')) as {
      exports: Record<string, string>;
      dependencies: Record<string, string>;
    };
    expect(pkg.exports).toEqual({ '.': './src/index.ts', './anthropic': './src/llm/anthropic.ts' });
    expect(pkg.dependencies['@anthropic-ai/sdk']).toBeDefined();
  });
});
