// Public surface of the evals package.
// Stage-2 seed: deterministic anti-slop stop-lists. The LLM judge (rubric sec 0.7) and
// golden transcripts arrive in chats 2.3/2.4 and export from here too.
// The deterministic scanners (anti-slop, VK addendum loader, NF1 grounding) moved to
// @brodyazhnik/prose-gate in chat 3.2 (K2); re-exported so this surface is unchanged.
export * from '@brodyazhnik/prose-gate';
export * from './lt1gate.js';
export * from './groundingReplay.js';
export * from './reports.js';
export * from './harness/index.js';
