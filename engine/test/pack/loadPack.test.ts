import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadPack } from "../../src/pack/loadPack.js";
import { nodePackSource } from "../../src/pack/nodeSource.js";
import { PackIntegrityError, PackNotVerifiedError } from "../../src/pack/pack.js";
import type { PackSource } from "../../src/pack/source.js";
import { checkConfigFromPack, diceConfigFromPack } from "../../src/pack/configFromPack.js";

// --- in-memory PackSource for principle-#5 and integrity tests ---

interface MemFile {
  readonly id: string;
  readonly type: string;
  readonly verified: boolean;
}

function memSource(opts: {
  allVerified: boolean;
  total: number;
  verified: number;
  files: Record<string, MemFile>; // relPath -> file
}): PackSource {
  const manifest = {
    pack_id: "test",
    pack_version: "0.0.1",
    schema_version: "1.0",
    content: [{ dir: "mechanics/", count: Object.keys(opts.files).length, types: ["rule_card"] }],
    verified: { all_verified: opts.allVerified, total: opts.total, verified: opts.verified },
  };
  return {
    readText: (relPath) => {
      if (relPath === "manifest.json") return JSON.stringify(manifest);
      const f = opts.files[relPath];
      if (!f) throw new Error(`no such file: ${relPath}`);
      return JSON.stringify({ id: f.id, type: f.type, verified: f.verified, payload: {} });
    },
    listJsonFiles: (relDir) =>
      Object.keys(opts.files)
        .filter((p) => p.startsWith(relDir))
        .map((p) => p.slice(relDir.length))
        .sort(),
  };
}

const oneGood = { "mechanics/a.json": { id: "kv.a", type: "rule_card", verified: true } };

describe("principle #5: refuse unverified packs", () => {
  it("throws PackNotVerifiedError when all_verified is false", () => {
    const src = memSource({ allVerified: false, total: 1, verified: 1, files: oneGood });
    expect(() => loadPack(src)).toThrow(PackNotVerifiedError);
  });

  it("loads when all_verified is true and every file is verified", () => {
    const src = memSource({ allVerified: true, total: 1, verified: 1, files: oneGood });
    const pack = loadPack(src);
    expect(pack.manifest.verified.all_verified).toBe(true);
    expect(pack.getById("kv.a")?.type).toBe("rule_card");
  });

  it("throws when an individual file is verified:false even if manifest aggregate is true", () => {
    const src = memSource({
      allVerified: true,
      total: 1,
      verified: 1,
      files: { "mechanics/a.json": { id: "kv.a", type: "rule_card", verified: false } },
    });
    expect(() => loadPack(src)).toThrow(PackNotVerifiedError);
  });
});

describe("integrity checks", () => {
  it("throws when per-dir file count disagrees with the manifest", () => {
    // manifest count is derived from files (1), but declare total mismatch instead
    const src = memSource({ allVerified: true, total: 2, verified: 2, files: oneGood });
    expect(() => loadPack(src)).toThrow(PackIntegrityError); // 1 indexed != total 2
  });

  it("throws on duplicate id", () => {
    const src = memSource({
      allVerified: true,
      total: 2,
      verified: 2,
      files: {
        "mechanics/a.json": { id: "kv.dup", type: "rule_card", verified: true },
        "mechanics/b.json": { id: "kv.dup", type: "rule_card", verified: true },
      },
    });
    expect(() => loadPack(src)).toThrow(PackIntegrityError);
  });
});

describe("indexing", () => {
  const src = memSource({
    allVerified: true,
    total: 2,
    verified: 2,
    files: {
      "mechanics/a.json": { id: "kv.a", type: "rule_card", verified: true },
      "mechanics/b.json": { id: "kv.b", type: "lookup_table", verified: true },
    },
  });
  const pack = loadPack(src);

  it("getById / requireById / listByType", () => {
    expect(pack.getById("kv.a")?.id).toBe("kv.a");
    expect(pack.getById("kv.missing")).toBeUndefined();
    expect(pack.requireById("kv.b").type).toBe("lookup_table");
    expect(() => pack.requireById("kv.missing")).toThrow();
    expect(pack.listByType("rule_card").map((e) => e.id)).toEqual(["kv.a"]);
    expect(pack.listByType("nope")).toEqual([]);
  });
});

describe("real KV pack via Node adapter", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const packRoot = resolve(here, "../../..", "content-packs/kv");
  const pack = loadPack(nodePackSource(packRoot));

  it("loads 222 verified files", () => {
    expect(pack.manifest.verified.all_verified).toBe(true);
    expect(pack.manifest.verified.total).toBe(222);
    expect(pack.listByType("rule_card")).toHaveLength(189);
    expect(pack.getById("kv.solo.hero_adjustments")).toBeDefined();
  });

  it("derives the same Dice/Check configs as direct file reads", () => {
    const dice = diceConfigFromPack(pack);
    expect(dice.feat).toEqual({
      sides: 12,
      eyeFace: 11,
      gandalfRuneFace: 12,
      eyeNumericValue: 0,
      normalDiceCount: 1,
      modifiedDiceCount: 2,
    });
    expect(dice.success).toEqual({ sides: 6, successIconFace: 6 });

    const checks = checkConfigFromPack(pack);
    expect(checks.tnBase).toBe(18);
    expect(checks.specialSuccesses.map((s) => s.key)).toContain("gain_advantage");
    expect(checks.riskDegrees.map((r) => r.key)).toEqual(["normal", "dangerous", "reckless"]);
  });
});
