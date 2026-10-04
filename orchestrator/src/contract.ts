// Contract between the deterministic engine and the narrative layer (the Keeper).
//
// This is the structured package the orchestrator assembles each turn and hands to
// the LLM (arch v1 sec 2.3 input). The narrative layer renders prose from it and never
// re-rolls, recomputes, or invents the mechanical facts carried here.
//
// LEGAL CONTOUR: this type lives OUTSIDE engine/ on purpose -- the orchestrator
// composes engine output + pack lore (RAG) + journal, which engine/ must never touch.
// The TYPE itself is pure structure and content-clean: ASCII only, English
// identifiers/comments, zero VK content. VK lore arrives at runtime as opaque
// strings (LoreChunk.text), never hardcoded in this source.
//
// Stage-2 thin slice: just the package shape + the Keeper output shape. The real
// assembly (classifier, RAG retrieval, journal compression) grows here in Stage 3.

/**
 * Intent classes from arch v1 sec5 game loop. Whether classification is a separate
 * cheap LLM call or part of the main call is DEFERRED to chat 2.4 (open question Q1,
 * "decide by latency"). This field is classifier-agnostic: it records the resolved
 * intent regardless of how it was produced.
 */
export type IntentKind =
  | 'yes_no_question' // oracle answer table
  | 'open_question' // oracle lore table -> LLM interpretation
  | 'risky_action' // skill + risk degree -> check
  | 'journey' // travel procedure (scenes per day)
  | 'council' // council (resistance rating)
  | 'combat' // combat by stances
  | 'mundane'; // safe/everyday action, no roll -> straight narration

/**
 * Scene type. Drives prose-length calibration, but the concrete char ranges per scene
 * kind are NOT defined here: that mapping (and the 5-kind -> length-band assignment) is
 * a calibration parameter owned by the pack tone contract
 * (content-packs/kv/tone.md, DEFERRED LT1) and tuned in chat 2.3. The orchestrator
 * resolves the range at runtime and passes it in NarrativePackage.length_target.
 */
export type SceneKind =
  | 'journey'
  | 'combat'
  | 'council'
  | 'free'
  | 'fellowship_phase';

/**
 * Prose length bounds in characters. Pure structure: the concrete numbers are a
 * calibration parameter (tone.md / LT1, tuned in 2.3), never hardcoded in this type.
 * The orchestrator fills this from the calibrated source at assembly time.
 */
export interface LengthTarget {
  readonly min_chars: number;
  readonly max_chars: number;
}

/**
 * A die result already rolled by the engine. The Keeper renders it, never re-rolls.
 * Feat die: face 11 = Eye, face 12 = Gandalf rune (arch v1 sec2.2). Success dice are
 * d6; a 6 is a success icon.
 *
 * UI-ONLY FIELDS (DD-DICE-FACES): the raw faces -- feat_die, success_dice, feat_candidates,
 * feat_modifier, success_counted -- are for the browser dice panel. renderNarrativePackage never emits them
 * (render.ts UI_ONLY_DICE_KEYS), so the Keeper and the judge do not see faces; their request
 * bytes are unchanged. The producer (provider.ts mapDice) fills them from the engine's
 * StepRecord roll; nothing re-rolls.
 */
export interface DiceResult {
  readonly feat_die?: number; // UI-only: physical d12 face of the KEPT Feat die
  readonly feat_symbol?: 'eye' | 'gandalf' | null;
  readonly success_dice?: readonly number[]; // UI-only: d6 faces, in roll order
  readonly success_icons?: number; // count of sixes
  readonly total?: number;
  readonly target_number?: number; // TN = 18 - attribute (solo formula)
  readonly outcome?: CheckOutcome;
  // UI-only: every physical Feat die face rolled, in roll order -- present only when the roll was
  // favoured / ill-favoured (more than one Feat die); feat_die is the one the engine kept.
  readonly feat_candidates?: readonly number[];
  // UI-only: the engine roll's Feat modifier, present exactly when feat_candidates is (copied from
  // DiceRoll.featModifier, never inferred from the faces).
  readonly feat_modifier?: 'favoured' | 'ill_favoured';
  // UI-only: index-aligned with success_dice -- true when that face entered `total` (false only
  // for a face voided by weariness). From the engine's successDiceCounted, the same rule the
  // engine sums with; when total is present, total = kept Feat value + sum of counted faces.
  readonly success_counted?: readonly boolean[];
}

export type CheckOutcome = 'failure' | 'weak' | 'strong' | 'extraordinary';

/**
 * An oracle result already rolled by the engine's oracle adapter.
 *
 * `detail` is the SECOND-LEVEL sub-table (scene_details.*). The engine rolls it in the
 * journey loop (SD1 done since Stage 1); the orchestrator SURFACES the already-rolled row
 * here at chat 2.4, never re-rolling. Per "oracles are engine mechanics", these sub-tables
 * are rolled by the engine, not improvised by the Keeper. When absent the Keeper renders
 * only the top-level result; it never substitutes its own roll for a missing detail.
 *
 * `row` carries the full rolled SD1 scene-detail row so the Keeper weaves the concrete
 * detail without a second pack lookup. See OracleDetailRow: structural fields are typed (so
 * consumers can safely branch -- notably on significantEncounter), while scene/prompt stay
 * opaque content.
 */
export interface OracleResult {
  readonly table: string; // pack table id, e.g. 'answer' | 'lore' | 'luck' | 'misfortune'
  readonly result_ref: string; // opaque pack ref to the rolled entry
  readonly detail?: OracleResult | null; // SD1 second level, surfaced by the orchestrator (2.4)
  readonly row?: OracleDetailRow | null; // full rolled SD1 row (typed structurally)
}

/**
 * The second-level oracle row (SD1 scene_details). Structural fields are typed so consumers
 * branch safely -- notably `significantEncounter`, on which the narrative layer and judge
 * branch (escalation to a meaningful encounter). `scene`/`prompt` are opaque pack content
 * carried through verbatim; their VALUES may be Cyrillic, but the field NAMES keep this
 * type ASCII/content-clean.
 *
 * Scoped to scene_details on purpose: the only second-level oracle today is SD1. A future
 * sub-table (it would NOT be patron_tasks -- those are not oracle.detail) extends this then.
 */
export interface OracleDetailRow {
  readonly face: number;
  readonly scene: string; // opaque pack content
  readonly prompt: string; // opaque pack content
  readonly skill: string | null;
  readonly significantEncounter: boolean;
}

/**
 * What changed in state this turn, already computed by the engine. Summary only --
 * the Keeper weaves consequences into prose but never recomputes the numbers.
 */
export interface StatePatchSummary {
  readonly endurance_delta?: number;
  readonly fatigue_delta?: number;
  readonly hope_delta?: number;
  readonly shadow_delta?: number;
  // Eye of Mordor awareness GROWTH this step, up to any detection. When the Eye reaches the
  // pursuit threshold the engine resets awareness to the initial rating; that reset is NOT a
  // delta here (it is implied by NarrativePackage.detection), so a detection step reports the
  // growth that triggered it (e.g. +1), never growth-plus-reset folded into one negative diff.
  readonly eye_delta?: number;
  readonly conditions_gained?: readonly string[];
  readonly conditions_cleared?: readonly string[];
  readonly notes?: readonly string[]; // opaque, engine-authored
}

/**
 * Journey progress of ONE engine step (TP1). Present on every real journey step; absent (null)
 * on non-journey turns. The travel check lives HERE, next to the day count, and nowhere else:
 * `NarrativePackage.dice` stays the SCENE check only (A4.1), so the Keeper cannot narrate the
 * guide's Travel roll as the outcome of the scene.
 */
export interface JourneyStepSummary {
  // Change of the journey duration (days) this step: scene journey_days_delta effects (a short
  // cut -1, a mishap +1). 0 is INCLUDED -- it tells the Keeper the day count did not move.
  readonly days_delta: number;
  readonly arrived?: true; // present only on the arrival step
  readonly days_total?: number; // present only on the arrival step: the final journey duration in days
  // The guide's Travel roll of this step -- NOT the scene outcome (that is `dice`). Optional since
  // 3.3a: a resolution beat (the player's scene check) has no travel roll; every whole step and
  // every travel beat (setup / arrival / encounter) carries it.
  readonly travel_check?: DiceResult;
}

/**
 * A detection scene the engine rolled this step: Eye awareness reached the pursuit threshold, the
 * engine rolled kv.solo.detection_scenes and reset awareness to the initial rating. The scene is
 * opaque pack text carried verbatim; the Keeper weaves it like an oracle result (never re-rolls,
 * never substitutes its own).
 */
export interface DetectionScene {
  readonly table: string; // 'detection_scenes'
  readonly scene: string; // opaque pack text of the rolled row, verbatim
}

/**
 * An opaque lore chunk from the pack (RAG retrieval). The TYPE is clean; the DATA is
 * VK content supplied at runtime. Pack-side production of lore/ is DEFERRED LT1.
 */
export interface LoreChunk {
  readonly chunk_id: string;
  readonly text: string; // opaque pack content, never authored in this source
}

/** A journal fact carried into context (arch v1 sec2.4 extraction). */
export interface JournalFact {
  readonly kind: 'npc' | 'place' | 'promise' | 'find' | 'threat';
  readonly text: string;
}

// ---- 3.3a: per-beat prose (the interactive journey step) ----

/**
 * Which beat of an interactive journey step the Keeper writes (3.3a). A step with a scene check is
 * two prose beats: 'setup' (the travel roll and the drawn scene, BEFORE the player rolls the scene
 * check -- no outcome yet) and 'resolution' (the scene check's outcome). A step that ends in
 * 'arrival' or in a significant 'encounter' (no check) is one prose beat. Absent on a whole-step
 * (v0.3) package.
 */
export type BeatKind = 'setup' | 'resolution' | 'arrival' | 'encounter';

/**
 * The player's input to the roll this beat narrates. `hope_spent` is engine-applied (the hero's
 * Hope already left in `patch`). `approach` is the player's own words about HOW the hero goes at
 * it -- an INTENT, never a fact: the outcome stays the engine's (`dice`), and nothing the approach
 * claims happened is true unless the package says so. Opaque runtime text, rendered verbatim.
 */
export interface PlayerInput {
  readonly hope_spent: 0 | 1;
  readonly approach?: string;
}

/**
 * A yes/no oracle question the player asked since the last prose beat, answered by the ENGINE
 * (kv.solo.answers): a world fact the Keeper weaves in, never re-asks or overturns.
 */
export interface OracleQuestion {
  readonly question: string; // the player's words, verbatim (opaque runtime text)
  readonly likelihood: string; // the PACK LABEL of the likelihood (kv.solo.answers likelihoods[].label), not the key
  readonly answer: 'yes' | 'no';
  readonly extreme: boolean; // the rune ("yes, and ...") or the Eye ("no, and ...")
  readonly note?: string; // pack text of the rune / Eye face, present only when extreme
}

/**
 * UI-ONLY (never rendered; render.ts UI_ONLY_PACKAGE_KEYS): the scene-table and detail rolls of the
 * beat (TRANS1: the player sees the table dice) and the bonus Success dice a Hope spend gave.
 * scene_table mirrors DiceResult: feat_candidates + feat_modifier only on a modified roll.
 */
export interface BeatRolls {
  readonly scene_table?: {
    readonly feat_die: number; // physical face of the KEPT Feat die
    readonly feat_candidates?: readonly number[]; // every Feat face rolled, only when favoured / ill-favoured
    readonly feat_modifier?: 'favoured' | 'ill_favoured'; // present exactly when feat_candidates is
  };
  readonly scene_detail_die?: number; // the d6 face that picked the detail row
  readonly bonus_dice?: number; // bonus Success dice from the Hope spend of this beat's roll
}

/** UI-ONLY (never rendered): one source of Eye growth this beat (TRANS1), from the engine's EyeSource. */
export interface EyeSourceSummary {
  readonly source: 'travel_check' | 'scene_check' | 'shadow';
  readonly delta: number;
}

/**
 * The full package the orchestrator hands to the Keeper (arch v1 sec2.3 input).
 *
 * Everything mechanical here is engine-sourced. The Keeper's hard contract (see
 * docs/NARRATIVE_CONTRACT.md): numbers, dice, outcomes and oracle results come ONLY
 * from this package; mechanics absent from the package must not be mentioned; the
 * oracle result is mandatory to weave in.
 */
export interface NarrativePackage {
  readonly intent: IntentKind;
  readonly scene: SceneKind;
  readonly length_target: LengthTarget;
  readonly dice?: DiceResult | null;
  readonly oracle?: OracleResult | null;
  readonly detection?: DetectionScene | null; // TP1: a detection scene rolled this step
  readonly patch?: StatePatchSummary | null;
  readonly journey?: JourneyStepSummary | null; // TP1: days / arrival / travel check of this step
  readonly lore_chunks?: readonly LoreChunk[];
  readonly journal_facts?: readonly JournalFact[];
  // 3.3a (all optional, absent on a whole-step v0.3 package, which renders byte-identically):
  readonly beat?: BeatKind; // which prose beat of the step this is
  readonly player?: PlayerInput | null; // the player's input to this beat's roll
  readonly questions?: readonly OracleQuestion[]; // engine-answered oracle questions since the last prose beat
  readonly previous_prose?: string | null; // accepted prose of the previous prose beat (continuity, CT1)
  readonly rolls?: BeatRolls | null; // UI-only: table / detail / bonus dice
  readonly eye_sources?: readonly EyeSourceSummary[]; // UI-only: what grew the Eye this beat
}

// ---- Keeper output side: what we ask the narrative layer to return ----

/**
 * A clarifying question the Keeper may pose to the player. The contract supports BOTH
 * modes (open question Q2); MVP uses 'free_text'. 'options' is offered when the Keeper
 * wants to bound the player's choice. `options` is present iff mode === 'options'.
 */
export type ClarifyingQuestion =
  | { readonly prompt: string; readonly mode: 'free_text' }
  | {
      readonly prompt: string;
      readonly mode: 'options';
      readonly options: readonly string[];
    };

/** The Keeper's expected return: prose plus optional clarifying questions. */
export interface KeeperOutput {
  readonly prose: string;
  readonly questions?: readonly ClarifyingQuestion[];
}
