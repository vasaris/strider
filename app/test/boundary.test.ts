// Server boundary: a static scan of every file under src/.
// (a) every file under src/server is a source module (.ts .tsx .js .jsx .mjs .cjs) whose first
//     statement is `import 'server-only'`; data belongs in content-packs/ and prompts/, read at
//     runtime by server code (a JSON file cannot carry server-only and would ship to a client);
// (b) outside src/server no @brodyazhnik/* specifier at all; nowhere @brodyazhnik/evals;
// (c) every route file exports runtime = 'nodejs', exactly once;
// (d) from each 'use client' module, transitively over relative specifiers: no reachable file
//     under src/server, no @brodyazhnik/* import, no unresolved relative specifier;
// (e) no relative specifier in any src module resolves outside src/ (engine/orchestrator
//     sources are reachable only by package name, which (b) constrains).
// Specifiers: import/export from, import(), require(), require.resolve(),
// new URL(x, import.meta.url); quoted or backtick without ${}. Matching runs on
// comment-stripped code.
// Known limits (by design, not chased): the comment stripper does not tokenise regex
// literals or JSX text; computed/dynamic specifiers are invisible; symlinks inside src/
// are not followed (a symlinked dir is a leaf). Next's build-time `server-only` guard is
// the backstop for client bundles.
// Layout consequence for C7: route handlers only. A 'use server' module reaching
// src/server fails (a)/(d) -- Server Actions would need a rule change first.
import { readdirSync, readFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const ROUTE = /(^|\/)route\.(ts|tsx|js|jsx|mjs)$/;
const ANY_WORKSPACE = /^@brodyazhnik(\/|$)/;
const EVALS = /^@brodyazhnik\/evals(\/|$)/;
const IGNORED = new Set(['.DS_Store']); // Finder litter, never part of a git tree

/** src-relative posix path -> source text (source modules) or null (any other file). */
type Tree = ReadonlyMap<string, string | null>;

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : IGNORED.has(e.name) ? [] : [join(dir, e.name)],
  );
}

/** Source with comments removed (string literals kept) and leading whitespace trimmed. */
function code(text: string): string {
  return text
    .replace(/(["'])(?:\\.|(?!\1)[^\\\n])*\1|`(?:\\.|[^\\`])*`|\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, (m) =>
      m.startsWith('/') ? '' : m,
    )
    .trimStart();
}

const LIT = String.raw`(?:(['"])([^'"\n]+)\1|\x60([^\x60$]+)\x60)`;
const SPEC_RES = [
  new RegExp(String.raw`(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire(?:\.resolve)?\s*\(\s*)` + LIT, 'g'),
  new RegExp(String.raw`\bnew\s+URL\s*\(\s*` + LIT + String.raw`\s*,\s*import\.meta\.url`, 'g'),
];

/** Every literal module specifier (see header for the forms). */
function specifiers(text: string): string[] {
  const src = code(text);
  return SPEC_RES.flatMap((re) => [...src.matchAll(re)].map((m) => m[2] ?? m[3] ?? ''));
}

const isServer = (rel: string) => rel.startsWith('server/');
const isRelative = (s: string) => s === '.' || s === '..' || s.startsWith('./') || s.startsWith('../');

/** True when 'use client' is among the leading string-literal directives. */
function isClient(text: string): boolean {
  let rest = code(text);
  for (;;) {
    const m = /^(['"])([^'"\n]*)\1\s*;?\s*/.exec(rest);
    if (m === null) return false;
    if (m[2] === 'use client') return true;
    rest = rest.slice(m[0].length);
  }
}

/** Every runtime export: the value of each `export const runtime = ...`, or the whole `export { ... }` naming runtime. */
function runtimeExports(text: string): string[] {
  const src = code(text);
  const decls = [...src.matchAll(/\bexport\s+(?:const|let|var)\s+runtime\s*=\s*([^;\n]+)/g)].map((m) => (m[1] ?? '').trim());
  const lists = [...src.matchAll(/\bexport\s*\{[^}]*\bruntime\b[^}]*\}/g)].map((m) => m[0]);
  return [...decls, ...lists];
}

const ESCAPES = '..';

/** Resolve a relative specifier: exact file, file + extension, '.js'-style -> source, or dir index. */
function resolveRelative(tree: Tree, from: string, spec: string): string | null {
  const joined = posix.normalize(posix.join(posix.dirname(from), spec));
  if (joined === '..' || joined.startsWith('../')) return ESCAPES;
  const base = joined === '.' ? '' : joined.replace(/\/$/, '');
  const stem = base.replace(/\.(js|jsx|mjs|cjs)$/, '');
  const index = base === '' ? 'index' : `${base}/index`;
  const candidates = [base, ...EXTS.map((e) => base + e), ...EXTS.map((e) => stem + e), ...EXTS.map((e) => index + e)];
  return candidates.find((c) => c !== '' && tree.has(c)) ?? null;
}

const sources = (tree: Tree) => [...tree].flatMap(([rel, text]) => (text === null ? [] : [{ rel, text }]));

/** (a) */
function serverViolations(tree: Tree): string[] {
  return [...tree.entries()]
    .filter(([rel]) => isServer(rel))
    .flatMap(([rel, text]) =>
      !SOURCE.test(rel) || text === null
        ? [`${rel}: not a source module`]
        : /^import\s+(['"])server-only\1\s*;/.test(code(text))
          ? []
          : [`${rel}: does not start with import 'server-only'`],
    );
}

/** (b) */
function workspaceViolations(tree: Tree): string[] {
  return sources(tree).flatMap(({ rel, text }) =>
    specifiers(text).flatMap((s) =>
      EVALS.test(s) ? [`${rel}: imports ${s}`] : !isServer(rel) && ANY_WORKSPACE.test(s) ? [`${rel}: imports ${s} outside src/server`] : [],
    ),
  );
}

/** (c) */
function routeViolations(tree: Tree): string[] {
  return sources(tree)
    .filter(({ rel }) => ROUTE.test(rel))
    .flatMap(({ rel, text }) => {
      const r = runtimeExports(text);
      return r.length === 1 && /^(['"])nodejs\1$/.test(r[0] ?? '') ? [] : [`${rel}: runtime exports ${JSON.stringify(r)}`];
    });
}

/** (d): "client -> ... -> offender: reason". */
function clientViolations(tree: Tree): string[] {
  const out: string[] = [];
  for (const { rel: start, text: startText } of sources(tree)) {
    if (!isClient(startText)) continue;
    const seen = new Set<string>([start]);
    const queue: string[][] = [[start]];
    while (queue.length > 0) {
      const path = queue.shift() ?? [];
      const rel = path[path.length - 1] ?? '';
      const chain = path.join(' -> ');
      if (isServer(rel)) out.push(`${chain}: under src/server`);
      const text = tree.get(rel) ?? null;
      if (text === null) continue; // non-source leaf (css, json, svg, ...)
      for (const spec of specifiers(text)) {
        if (ANY_WORKSPACE.test(spec)) out.push(`${chain}: imports ${spec}`);
        if (!isRelative(spec)) continue;
        const next = resolveRelative(tree, rel, spec);
        if (next === ESCAPES) out.push(`${chain} -> ${spec}: escapes src/`);
        else if (next === null) out.push(`${chain} -> ${spec}: unresolved`);
        else if (!seen.has(next)) {
          seen.add(next);
          queue.push([...path, next]);
        }
      }
    }
  }
  return out;
}

/** (e) */
function escapeViolations(tree: Tree): string[] {
  return sources(tree).flatMap(({ rel, text }) =>
    specifiers(text)
      .filter((s) => isRelative(s) && resolveRelative(tree, rel, s) === ESCAPES)
      .map((s) => `${rel}: ${s} escapes src/`),
  );
}

const tree: Tree = new Map(
  walk(SRC).map((abs) => [relative(SRC, abs).split(sep).join('/'), SOURCE.test(abs) ? readFileSync(abs, 'utf8') : null]),
);
const synthetic = (entries: Record<string, string | null>): Tree => new Map(Object.entries(entries));

describe('server boundary', () => {
  it('scans a non-empty tree with server modules, routes, client modules and non-source files', () => {
    const rels = [...tree.keys()];
    expect(rels.some(isServer)).toBe(true);
    expect(rels.some((r) => ROUTE.test(r))).toBe(true);
    expect(sources(tree).some((f) => isClient(f.text))).toBe(true);
    expect([...tree.values()].some((t) => t === null)).toBe(true);
  });

  it('(a) every src/server file is a source module starting with import server-only', () => {
    expect(serverViolations(tree)).toEqual([]);
  });

  it('(b) no @brodyazhnik/* outside src/server, no @brodyazhnik/evals anywhere', () => {
    expect(workspaceViolations(tree)).toEqual([]);
  });

  it("(c) every route exports runtime = 'nodejs' and nothing else", () => {
    expect(routeViolations(tree)).toEqual([]);
  });

  it("(d) nothing reachable from a 'use client' module touches the server", () => {
    expect(clientViolations(tree)).toEqual([]);
  });

  it('(e) no relative specifier leaves src/', () => {
    expect(escapeViolations(tree)).toEqual([]);
  });

  it('specifier forms and client detection', () => {
    const forms = [
      "export * from '@brodyazhnik/engine';",
      "import x from '@brodyazhnik/orchestrator/anthropic';",
      "const m = await import('@brodyazhnik/engine');",
      'const m = await import(`@brodyazhnik/engine`);',
      "const p = require.resolve('@brodyazhnik/engine');",
      "const r = require('@brodyazhnik/engine');",
      "const u = new URL('@brodyazhnik/engine', import.meta.url);",
    ];
    for (const f of forms) expect(specifiers(f), f).toEqual([expect.stringMatching(ANY_WORKSPACE)]);
    expect(specifiers('import(`@brodyazhnik/${name}`);')).toEqual([]); // dynamic: known limit
    expect(specifiers("// import '@brodyazhnik/engine';\nconst url = 'http://x';")).toEqual([]);
    expect(specifiers("const u = new URL('https://x.test/');")).toEqual([]);
    expect(isClient("'use strict';\n\"use client\";\nexport {};")).toBe(true);
    expect(isClient("// c\n'use client'\nexport {};")).toBe(true);
    expect(isClient("export {};\n'use client';")).toBe(false);
  });

  it('(a) self-check', () => {
    expect(serverViolations(synthetic({ 'server/data.json': null, 'server/x.ts': "// h\nimport 'server-only';" }))).toEqual([
      'server/data.json: not a source module',
    ]);
    expect(serverViolations(synthetic({ 'server/x.mjs': "import fs from 'node:fs';\nimport 'server-only';" }))).toEqual([
      "server/x.mjs: does not start with import 'server-only'",
    ]);
  });

  it('(b) self-check', () => {
    expect(
      workspaceViolations(
        synthetic({
          'app/a.tsx': "import { e } from '@brodyazhnik/app/src/server/env';",
          'app/b.js': 'await import(`@brodyazhnik/engine`);',
          'server/c.ts': "import 'server-only';\nimport '@brodyazhnik/evals';\nimport '@brodyazhnik/engine';",
        }),
      ),
    ).toEqual([
      'app/a.tsx: imports @brodyazhnik/app/src/server/env outside src/server',
      'app/b.js: imports @brodyazhnik/engine outside src/server',
      'server/c.ts: imports @brodyazhnik/evals',
    ]);
  });

  it('(c) self-check', () => {
    expect(
      routeViolations(
        synthetic({
          'app/a/route.ts': "// export const runtime = 'nodejs';\nexport const runtime = 'edge';",
          'app/b/route.tsx': "/* export const runtime = 'nodejs'; */\nexport function GET() {}",
          'app/c/route.js': "export const runtime = 'nodejs';\nexport { runtime as x, runtime };",
          'app/d/route.mjs': "export const runtime = 'nodejs' as const;",
          'app/e/route.ts': "export const runtime = 'nodejs';\nexport function GET() {}",
        }),
      ).map((v) => v.split(':')[0]),
    ).toEqual(['app/a/route.ts', 'app/b/route.tsx', 'app/c/route.js', 'app/d/route.mjs']);
  });

  it('(d) self-check', () => {
    expect(
      clientViolations(
        synthetic({
          'app/widget.tsx': "'use client';\nimport { h } from '../lib/helper';",
          'lib/helper.ts': "export { getJourneyEnv as h } from '../server/env';",
          'server/env.ts': "import 'server-only';",
        }),
      ),
    ).toEqual(['app/widget.tsx -> lib/helper.ts -> server/env.ts: under src/server']);
    expect(
      clientViolations(
        synthetic({
          'app/w.tsx': "\"use client\";\nimport '../lib/index.js';",
          'lib/index.ts': "export * from './deep';",
          'lib/deep/index.mjs': "import '@brodyazhnik/engine/x';",
        }),
      ),
    ).toEqual(['app/w.tsx -> lib/index.ts -> lib/deep/index.mjs: imports @brodyazhnik/engine/x']);
    expect(
      clientViolations(synthetic({ 'app/w.tsx': "'use client';\nimport d from '../server/data.json';", 'server/data.json': null })),
    ).toEqual(['app/w.tsx -> server/data.json: under src/server']);
    expect(clientViolations(synthetic({ 'app/w.tsx': "'use client';\nimport d from './missing';" }))).toEqual([
      'app/w.tsx -> ./missing: unresolved',
    ]);
    expect(
      clientViolations(
        synthetic({ 'app/w.tsx': "'use strict';\n'use client';\nimport '../server/env';", 'server/env.ts': "import 'server-only';" }),
      ),
    ).toEqual(['app/w.tsx -> server/env.ts: under src/server']);
    expect(
      clientViolations(
        synthetic({
          'app/w.tsx': "'use client';\nconst u = new URL('../server/env.ts', import.meta.url);",
          'server/env.ts': "import 'server-only';",
        }),
      ),
    ).toEqual(['app/w.tsx -> server/env.ts: under src/server']);
    expect(
      clientViolations(
        synthetic({ 'app/w.tsx': "'use client';\nimport '..';\nimport '.';", 'index.ts': "import './server/env';", 'app/index.ts': '', 'server/env.ts': "import 'server-only';" }),
      ),
    ).toEqual(['app/w.tsx -> index.ts -> server/env.ts: under src/server']);
    expect(
      clientViolations(
        synthetic({
          'app/w.tsx': "'use client';\n// import '../server/env';\nimport './ok';\nimport './s.css';",
          'app/ok.ts': 'export const x = 1;',
          'app/s.css': null,
          'server/env.ts': "import 'server-only';",
        }),
      ),
    ).toEqual([]);
  });

  it('(e) self-check', () => {
    expect(
      escapeViolations(synthetic({ 'app/t.ts': "import '../../../engine/src/index';\nimport '../server/env';", 'server/env.ts': '' })),
    ).toEqual(['app/t.ts: ../../../engine/src/index escapes src/']);
    expect(escapeViolations(synthetic({ 'index.ts': "import '..';" }))).toEqual(["index.ts: .. escapes src/"]);
  });
});
