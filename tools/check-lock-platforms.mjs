#!/usr/bin/env node
// check-lock-platforms: guards package-lock.json against the npm defect where a
// lock regenerated over an existing node_modules records optional native
// binaries (esbuild, rollup, ...) for the current platform only. Such a lock
// breaks `npm ci` on other hosts (the reviewer runs Linux x64 glibc).
//
// Rule A: every optionalDependency of every lock entry resolves by node-style
//         lookup (own node_modules, ancestors, root); an exact-version spec must match.
// Rule B: every native family (an entry with a linux-x64 non-musl optional
//         dep) resolves that dep to an entry with os linux, cpu x64 (libc glibc).
//
// Usage: node tools/check-lock-platforms.mjs [lockPath]
// Exit: 0 ok, 1 violations, 2 usage/IO/parse error. Zero deps, node: only.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TAG = 'check-lock-platforms';
const args = process.argv.slice(2);
if (args.length > 1) {
  console.error(`${TAG}: usage: node tools/check-lock-platforms.mjs [lockPath]`);
  process.exit(2);
}
const lockPath = args[0] ?? fileURLToPath(new URL('../package-lock.json', import.meta.url));

let packages;
try {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  packages = lock.packages;
  if (packages === null || typeof packages !== 'object') throw new Error('no "packages" map (lockfileVersion >= 2 required)');
} catch (err) {
  console.error(`${TAG}: cannot read ${lockPath}: ${err.message}`);
  process.exit(2);
}

// Parent install location: cut at the last /node_modules/; a top-level
// node_modules/<x> or a workspace dir (e.g. engine) has the root '' as parent.
function parentLoc(loc) {
  const i = loc.lastIndexOf('/node_modules/');
  return i >= 0 ? loc.slice(0, i) : '';
}

function resolve(fromLoc, name) {
  let loc = fromLoc;
  for (;;) {
    const key = loc === '' ? `node_modules/${name}` : `${loc}/node_modules/${name}`;
    if (Object.hasOwn(packages, key)) return key;
    if (loc === '') return null;
    loc = parentLoc(loc);
  }
}

// Native families pin exact versions; ranges (fsevents ~2.3.2) stay presence-only.
const EXACT = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const has = (list, v) => Array.isArray(list) && list.includes(v);
const nameOf = (loc) => {
  const i = loc.lastIndexOf('node_modules/');
  return i >= 0 ? loc.slice(i + 'node_modules/'.length) : loc || '(root)';
};

const violations = [];
const families = [];
let resolved = 0;

for (const [loc, entry] of Object.entries(packages)) {
  const optional = entry.optionalDependencies;
  if (!optional) continue;
  let isFamily = false;
  for (const [dep, spec] of Object.entries(optional)) {
    const native = /linux-x64/.test(dep) && !/musl/.test(dep);
    if (native) isFamily = true;
    const target = resolve(loc, dep);
    const where = loc === '' ? '(root)' : loc;
    if (target === null) {
      violations.push(`${where} -> optionalDependency ${dep}: missing`);
      continue;
    }
    const got = packages[target].version;
    if (EXACT.test(spec) && got !== spec) {
      violations.push(`${where} -> optionalDependency ${dep}: version mismatch (wants ${spec}, resolves ${target}@${got})`);
      continue;
    }
    resolved++;
    if (native) {
      const t = packages[target];
      const ok = has(t.os, 'linux') && has(t.cpu, 'x64') && (t.libc === undefined || has(t.libc, 'glibc'));
      if (!ok) {
        violations.push(`${where} -> optionalDependency ${dep}: wrong platform (${target}: os=${JSON.stringify(t.os)} cpu=${JSON.stringify(t.cpu)} libc=${JSON.stringify(t.libc)})`);
      }
    }
  }
  if (isFamily) families.push(`${nameOf(loc)}@${entry.version}`);
}

if (families.length === 0) {
  violations.push('no native families found (no entry declares a linux-x64 glibc optional dep) -- detection is broken or the lock is not v3');
}

if (violations.length > 0) {
  for (const v of violations) console.error(v);
  console.error(`${TAG}: FAIL -- ${violations.length} violation(s) in ${lockPath}`);
  process.exit(1);
}

console.log(`${TAG}: OK -- ${families.length} native families (${families.join(', ')}) have linux-x64 glibc variants; ${resolved} optional deps resolved`);
