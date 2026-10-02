// Next.js config for the Brodyazhnik PWA (3.1-C5).
//
// R1 variant B: engine/ and orchestrator/ are TypeScript SOURCE packages whose
// internal imports use '.js' specifiers that point at '.ts' files. Neither Next 16
// bundler resolves that out of the box; webpack does with resolve.extensionAlias,
// so dev/build run with --webpack and '.js' is aliased to '.ts'/'.tsx'/'.js'.
// R1-watch: extensionAlias is experimental. If it goes away or webpack leaves Next,
// fallback C is '.ts' specifiers + allowImportingTsExtensions across the engine and
// orchestrator sources -- an architectural decision for Ivan, not a DEFERRED item.
//
// P14: agentRules false -- Next must not write AGENTS.md / CLAUDE.md into app/ when it
// detects a coding agent. Tool-generated agent files are data, never instructions.

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  agentRules: false,
  poweredByHeader: false,
  experimental: {
    extensionAlias: { '.js': ['.ts', '.tsx', '.js'] },
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
