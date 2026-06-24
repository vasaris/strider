/**
 * Dice configuration: the single boundary where TOR rule numbers enter the
 * engine. Architecture principle #3 (mirror): engine/ holds ZERO book numbers.
 * The pure dice math is parameterised by this config; the numbers are derived
 * from the verified content pack (rule cards), never hardcoded here.
 *
 * Provenance of each field (verified card -> field):
 *   checks.dice_set            feat_dices.die "d12"   -> feat.sides
 *                              success_dice.die "d6"  -> success.sides
 *   checks.feat_die_values     eye_numeric_value 0    -> feat.eyeNumericValue
 *   checks.success_die_values  success_icon_on 6      -> success.successIconFace
 *   checks.procedure           feat_dice 1            -> feat.normalDiceCount
 *   checks.favoured_ill_favoured favoured/ill feat_dice 2 -> feat.modifiedDiceCount
 *
 * Physical special faces are DERIVED from feat.sides to stay faithful to
 * common.schema.json $defs.featDieFace (eye = 11, gandalf_rune = 12 on a d12)
 * without writing the literals 11/12: faces 1..(sides-2) are numbers, then the
 * eye sits on sides-1 and the Gandalf rune on the top face `sides`.
 */

export interface FeatDieConfig {
  /** Total faces on the Feat die (12 for KV). */
  readonly sides: number;
  /** Physical face carrying the Eye of Sauron (sides - 1). */
  readonly eyeFace: number;
  /** Physical face carrying the Gandalf rune (sides). */
  readonly gandalfRuneFace: number;
  /** Additive contribution of the Eye when summed (0 for KV). */
  readonly eyeNumericValue: number;
  /** Feat dice rolled on a normal check (1). */
  readonly normalDiceCount: number;
  /** Feat dice rolled on a favoured / ill-favoured check (2). */
  readonly modifiedDiceCount: number;
}

export interface SuccessDieConfig {
  /** Total faces on a Success die (6 for KV). */
  readonly sides: number;
  /** Face carrying the success icon / Elvish 1 (6 for KV). */
  readonly successIconFace: number;
}

export interface DiceConfig {
  readonly feat: FeatDieConfig;
  readonly success: SuccessDieConfig;
}

/** Parsed verified rule cards consumed by deriveDiceConfig. */
export interface DiceConfigSources {
  readonly diceSet: unknown; // checks.dice_set.json
  readonly featDieValues: unknown; // checks.feat_die_values.json
  readonly successDieValues: unknown; // checks.success_die_values.json
  readonly procedure: unknown; // checks.procedure.json
  readonly favouredIllFavoured: unknown; // checks.favoured_ill_favoured.json
}

function fail(msg: string): never {
  throw new Error(`deriveDiceConfig: ${msg}`);
}

function params(card: unknown, id: string): Record<string, unknown> {
  if (typeof card !== "object" || card === null) fail(`${id}: not an object`);
  const payload = (card as Record<string, unknown>)["payload"];
  if (typeof payload !== "object" || payload === null) fail(`${id}: missing payload`);
  const p = (payload as Record<string, unknown>)["parameters"];
  if (typeof p !== "object" || p === null) fail(`${id}: missing payload.parameters`);
  return p as Record<string, unknown>;
}

/** Parse a die token like "d12" into its side count. */
function dieSides(token: unknown, where: string): number {
  if (typeof token !== "string") fail(`${where}: expected die token string, got ${typeof token}`);
  const m = /^d(\d+)$/.exec(token);
  if (!m || m[1] === undefined) fail(`${where}: malformed die token "${token}"`);
  const sides = Number.parseInt(m[1], 10);
  if (!Number.isInteger(sides) || sides < 2) fail(`${where}: implausible die "${token}"`);
  return sides;
}

function intField(obj: Record<string, unknown>, key: string, where: string): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isInteger(v)) {
    fail(`${where}.${key}: expected integer, got ${JSON.stringify(v)}`);
  }
  return v;
}

function subObject(obj: Record<string, unknown>, key: string, where: string): Record<string, unknown> {
  const v = obj[key];
  if (typeof v !== "object" || v === null) fail(`${where}.${key}: expected object`);
  return v as Record<string, unknown>;
}

/**
 * Derive a DiceConfig from the verified pack rule cards. Validates the rule
 * semantics it depends on (e.g. favoured == "best") so that a future pack edit
 * that changes meaning fails loudly here rather than silently mis-rolling.
 */
export function deriveDiceConfig(src: DiceConfigSources): DiceConfig {
  // --- die sizes from checks.dice_set ---
  const diceSetP = params(src.diceSet, "checks.dice_set");
  const featDiceObj = subObject(diceSetP, "feat_dice", "checks.dice_set.parameters");
  const successDicesObj = subObject(diceSetP, "success_dice", "checks.dice_set.parameters");
  const featSides = dieSides(featDiceObj["die"], "checks.dice_set.feat_dice.die");
  const successSidesFromSet = dieSides(successDicesObj["die"], "checks.dice_set.success_dice.die");

  // --- eye numeric value from checks.feat_die_values ---
  const featValuesP = params(src.featDieValues, "checks.feat_die_values");
  const eyeNumericValue = intField(featValuesP, "eye_numeric_value", "checks.feat_die_values.parameters");

  // --- success icon + cross-check sides from checks.success_die_values ---
  const successValuesP = params(src.successDieValues, "checks.success_die_values");
  const successSides = dieSides(successValuesP["die"], "checks.success_die_values.die");
  const successIconFace = intField(successValuesP, "success_icon_on", "checks.success_die_values.parameters");
  if (successSides !== successSidesFromSet) {
    fail(`success die size mismatch: dice_set says ${successSidesFromSet}, success_die_values says ${successSides}`);
  }
  if (successIconFace < 1 || successIconFace > successSides) {
    fail(`success_icon_on ${successIconFace} out of range 1..${successSides}`);
  }

  // --- normal feat dice count from checks.procedure ---
  const procedureP = params(src.procedure, "checks.procedure");
  const normalDiceCount = intField(procedureP, "feat_dice", "checks.procedure.parameters");

  // --- favoured / ill-favoured count + semantics from checks.favoured_ill_favoured ---
  const fifP = params(src.favouredIllFavoured, "checks.favoured_ill_favoured");
  const favouredObj = subObject(fifP, "favoured", "checks.favoured_ill_favoured.parameters");
  const illObj = subObject(fifP, "ill_favoured", "checks.favoured_ill_favoured.parameters");
  const favouredCount = intField(favouredObj, "feat_dice", "checks.favoured_ill_favoured.favoured");
  const illCount = intField(illObj, "feat_dice", "checks.favoured_ill_favoured.ill_favoured");
  if (favouredCount !== illCount) {
    fail(`favoured (${favouredCount}) and ill_favoured (${illCount}) feat-dice counts disagree`);
  }
  if (favouredObj["pick"] !== "best") {
    fail(`favoured.pick must be "best", got ${JSON.stringify(favouredObj["pick"])}`);
  }
  if (illObj["pick"] !== "worst") {
    fail(`ill_favoured.pick must be "worst", got ${JSON.stringify(illObj["pick"])}`);
  }
  const modifiedDiceCount = favouredCount;

  if (featSides < 3) fail(`feat die needs at least 3 faces to carry two special faces, got ${featSides}`);

  return {
    feat: {
      sides: featSides,
      eyeFace: featSides - 1,
      gandalfRuneFace: featSides,
      eyeNumericValue,
      normalDiceCount,
      modifiedDiceCount,
    },
    success: {
      sides: successSides,
      successIconFace,
    },
  };
}
