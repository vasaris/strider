import type { Pack } from "../pack/pack.js";
import { parseAnswersTable, parseFeatDieEventTable, parseLoreTable } from "./parse.js";
import type { FeatDieEventTable, OracleAnswersTable, OracleLoreTable } from "./types.js";

export interface PackOracles {
  readonly answers: OracleAnswersTable;
  readonly lore: OracleLoreTable;
  readonly luck: FeatDieEventTable;
  readonly misfortune: FeatDieEventTable;
}

/**
 * Parse the standard solo oracle tables from a loaded, verified pack. Canonical
 * ids are stable; a rename would throw at requireById (loudly), which is the
 * intended failure mode.
 */
export function oraclesFromPack(pack: Pack): PackOracles {
  return {
    answers: parseAnswersTable(pack.requireById("kv.solo.answers").raw),
    lore: parseLoreTable(pack.requireById("kv.solo.lore").raw),
    luck: parseFeatDieEventTable(pack.requireById("kv.solo.luck").raw),
    misfortune: parseFeatDieEventTable(pack.requireById("kv.solo.misfortune").raw),
  };
}
