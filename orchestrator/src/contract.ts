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
 */
export interface DiceResult {
  readonly feat_die?: number; // d12 face, if a check was made
  readonly feat_symbol?: 'eye' | 'gandalf' | null;
  readonly success_dice?: readonly number[]; // d6 faces
  readonly success_icons?: number; // count of sixes
  readonly total?: number;
  readonly target_number?: number; // TN = 18 - attribute (solo formula)
  readonly outcome?: CheckOutcome;
}

export type CheckOutcome = 'failure' | 'weak' | 'strong' | 'extraordinary';

/**
 * An oracle result already rolled by the engine's oracle adapter.
 *
 * `detail` is the SECOND-LEVEL sub-table (scene_details.*) -- DEFERRED SD1, rolled by
 * the engine in chat 2.2.a. The slot exists NOW so the contract does not change when
 * SD1 lands. Per "oracles are engine mechanics", these sub-tables MUST be rolled by
 * the engine, not improvised by the Keeper. When absent the Keeper renders only the
 * top-level result; it never substitutes its own roll for a missing detail.
 */
export interface OracleResult {
  readonly table: string; // pack table id, e.g. 'answer' | 'lore' | 'luck' | 'misfortune'
  readonly result_ref: string; // opaque pack ref to the rolled entry
  readonly detail?: OracleResult | null; // SD1 sub-table slot (chat 2.2.a)
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
  readonly eye_delta?: number; // Eye of Mordor awareness change
  readonly conditions_gained?: readonly string[];
  readonly conditions_cleared?: readonly string[];
  readonly notes?: readonly string[]; // opaque, engine-authored
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
  readonly patch?: StatePatchSummary | null;
  readonly lore_chunks?: readonly LoreChunk[];
  readonly journal_facts?: readonly JournalFact[];
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
