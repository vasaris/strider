// P14 "test after dev": `next dev` must not write agent files.
//
// Next 16 dev writes AGENTS.md + CLAUDE.md (an instruction-shaped managed block) into
// the project dir when it detects a coding agent, unless next.config sets
// agentRules: false. Such files are data, never instructions, and are never committed.
// The child gets AI_AGENT=brodyazhnik-p14-probe, which forces Next's agent detection:
// without agentRules: false the files WOULD be written, so this test is meaningful on
// any host, including one with no agent in its environment. The child env is an
// allowlist (no API keys, no inherited agent variables).
// 3.1-C7: the same single dev-server start also runs the API checks (test/support/devApi.ts;
// Next's dev lock forbids a second `next dev` in app/).
import { spawn, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { devApiChecks } from './support/devApi';

const APP = fileURLToPath(new URL('..', import.meta.url));
const ROOT = join(APP, '..');
const NEXT_BIN = createRequire(import.meta.url).resolve('next/dist/bin/next');
const READY_TIMEOUT_MS = 120_000;
const GRACE_MS = 5_000;

const sha256 = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      srv.close(() => (addr !== null && typeof addr === 'object' ? resolve(addr.port) : reject(new Error('no port'))));
    });
  });
}

function childEnv(): NodeJS.ProcessEnv {
  const env: Record<string, string> = {};
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'LANG']) {
    const v = process.env[key];
    if (v !== undefined) env[key] = v;
  }
  env['NEXT_TELEMETRY_DISABLED'] = '1';
  env['AI_AGENT'] = 'brodyazhnik-p14-probe';
  return env as NodeJS.ProcessEnv;
}

function exited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

async function killGroup(child: ChildProcess): Promise<void> {
  const pid = child.pid;
  if (pid === undefined || exited(child)) return;
  const gone = new Promise<void>((r) => child.once('exit', () => r()));
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    return;
  }
  await Promise.race([gone, delay(GRACE_MS)]);
  if (!exited(child)) {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      // already gone
    }
    await Promise.race([gone, delay(GRACE_MS)]);
  }
}

describe('next dev with an agent detected (P14)', () => {
  it(
    'serves the shell and the API guards, and writes no AGENTS.md / CLAUDE.md',
    async () => {
      const appAgents = join(APP, 'AGENTS.md');
      const appClaude = join(APP, 'CLAUDE.md');
      if (existsSync(appAgents) || existsSync(appClaude)) {
        throw new Error('tool-generated agent files present -- delete them; they are data, not instructions');
      }
      const rootClaude = join(ROOT, 'CLAUDE.md');
      const rootClaudeHash = existsSync(rootClaude) ? sha256(rootClaude) : null;
      const rootAgentsBefore = existsSync(join(ROOT, 'AGENTS.md'));

      const port = await freePort();
      const child = spawn(process.execPath, [NEXT_BIN, 'dev', '--webpack', '-H', '127.0.0.1', '-p', String(port)], {
        cwd: APP,
        env: childEnv(),
        detached: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '';
      child.stdout?.on('data', (d: Buffer) => (output += d.toString()));
      child.stderr?.on('data', (d: Buffer) => (output += d.toString()));

      // Next 16 prints "Ready in" before it takes the dev lockfile, so a second dev server
      // can report ready and then exit; check for the lock message on any failure too.
      const failIfLocked = () => {
        if (/Another .*next dev.* (server|process) is already running/.test(stripAnsi(output))) {
          throw new Error('stop your running `next dev` for app/ before test:all');
        }
      };

      try {
        const deadline = Date.now() + READY_TIMEOUT_MS;
        while (!/\bReady in\b/.test(stripAnsi(output))) {
          failIfLocked();
          if (exited(child)) throw new Error(`next dev exited early:\n${stripAnsi(output)}`);
          if (Date.now() > deadline) throw new Error(`next dev not ready in ${READY_TIMEOUT_MS} ms:\n${stripAnsi(output)}`);
          await delay(200);
        }

        const base = `http://127.0.0.1:${port}`;
        try {
          for (const path of ['/', '/manifest.webmanifest', '/sw.js', '/api/health']) {
            const res = await fetch(base + path);
            expect(res.status, `${path}\n${stripAnsi(output)}`).toBe(200);
            const body = await res.text();
            if (path === '/api/health') expect((JSON.parse(body) as { ok: unknown }).ok).toBe(true);
            if (path === '/sw.js') {
              expect(res.headers.get('content-type')).toBe('application/javascript; charset=utf-8');
              expect(res.headers.get('cache-control')).toBe('no-cache, no-store, must-revalidate');
              expect(res.headers.get('content-security-policy')).toBe("default-src 'self'; script-src 'self'");
            }
          }
          await devApiChecks(port, () => stripAnsi(output)); // 3.1-C7: the API through the real bundle
        } catch (err) {
          await delay(1_000); // let the child's last output arrive
          failIfLocked();
          throw err;
        }
      } finally {
        await killGroup(child);
      }

      expect(existsSync(appAgents), 'app/AGENTS.md written by next dev').toBe(false);
      expect(existsSync(appClaude), 'app/CLAUDE.md written by next dev').toBe(false);
      expect(existsSync(rootClaude) ? sha256(rootClaude) : null).toBe(rootClaudeHash);
      expect(existsSync(join(ROOT, 'AGENTS.md'))).toBe(rootAgentsBefore);
    },
    240_000,
  );
});
