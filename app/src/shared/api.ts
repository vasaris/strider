// The wire types of the JSON API (K5): what the route handlers send and the browser reads. This
// module sits OUTSIDE src/server and imports nothing, so 'use client' modules may use it; the
// handlers check their responses against these types with `satisfies` (http/handlers.ts), so a
// server-side change that breaks the wire shape fails typecheck instead of the browser.
//
// The package types mirror the orchestrator contract (NarrativePackage and friends) structurally,
// limited to the fields the UI reads; the server's richer types are assignable to them.

export const REGION_IDS = ['border_lands', 'wild_lands', 'dark_lands'] as const;
export type RegionId = (typeof REGION_IDS)[number];

export type CheckOutcome = 'failure' | 'weak' | 'strong' | 'extraordinary';

/** A rolled check (contract DiceResult). The face fields are absent on packages stored before
 *  DD-DICE-FACES (K1). */
export interface DiceDto {
  readonly feat_die?: number;
  readonly feat_symbol?: 'eye' | 'gandalf' | null;
  readonly success_dice?: readonly number[];
  readonly success_icons?: number;
  readonly total?: number;
  readonly target_number?: number;
  readonly outcome?: CheckOutcome;
  readonly feat_candidates?: readonly number[];
  readonly feat_modifier?: 'favoured' | 'ill_favoured';
  readonly success_counted?: readonly boolean[];
}

export interface OracleRowDto {
  readonly face: number;
  readonly scene: string;
  readonly prompt: string;
  readonly skill: string | null;
  readonly significantEncounter: boolean;
}

export interface OracleDto {
  readonly table: string;
  readonly result_ref: string;
  readonly detail?: OracleDto | null;
  readonly row?: OracleRowDto | null;
}

/** The trackers a patch can move, as `<id>_delta` keys (contract HeroPatch), in display order. The
 *  server labels these ids (group 'trackers'); the UI lists the non-zero deltas in this order. */
export const TRACKER_IDS = ['endurance', 'fatigue', 'hope', 'shadow', 'eye'] as const;
export type TrackerId = (typeof TRACKER_IDS)[number];

export interface PatchDto {
  readonly endurance_delta?: number;
  readonly fatigue_delta?: number;
  readonly hope_delta?: number;
  readonly shadow_delta?: number;
  readonly eye_delta?: number;
  readonly conditions_gained?: readonly string[];
  readonly conditions_cleared?: readonly string[];
}

export interface JourneyStepDto {
  readonly days_delta: number;
  readonly arrived?: true;
  readonly days_total?: number;
  readonly travel_check: DiceDto;
}

export interface DetectionDto {
  readonly table: string;
  readonly scene: string;
}

export interface PackageDto {
  readonly dice?: DiceDto | null;
  readonly oracle?: OracleDto | null;
  readonly detection?: DetectionDto | null;
  readonly patch?: PatchDto | null;
  readonly journey?: JourneyStepDto | null;
}

/** prose-gate ListId (the server's GateFinding.list must stay assignable to this). */
export const GATE_LIST_IDS = [
  'calque',
  'slop_ru',
  'slop_en',
  'register_parasite',
  'vk_addendum',
  'mixed_script',
  'nf1_name',
  'nf1_backstory',
  'sa1_plural',
] as const;
export type GateListId = (typeof GATE_LIST_IDS)[number];

export interface GateFindingDto {
  readonly list: GateListId;
  readonly term: string;
  readonly severity: 'block' | 'warn';
}

export type ProseState = 'ready' | 'blocked' | 'failed' | 'missing';

export interface TurnDto {
  readonly turnIndex: number;
  readonly createdAt: string;
  readonly pkg: PackageDto;
  readonly prose: string | null;
  readonly proseState: ProseState;
  readonly gate: readonly GateFindingDto[];
  readonly generating: boolean;
  readonly generations: number;
}

/** The roles the UI names (K5.2): not in packages, so the server labels every one of them in every
 *  labels object it sends (group 'roles'). */
export const ROLE_IDS = ['keeper'] as const;
export type RoleId = (typeof ROLE_IDS)[number];

export const LABEL_GROUPS = ['scenes', 'skills', 'conditions', 'outcomes', 'regions', 'trackers', 'rolls', 'roles'] as const;
export type LabelGroup = (typeof LABEL_GROUPS)[number];
export type LabelsDto = { readonly [G in LabelGroup]: Readonly<Record<string, string>> };

export interface SessionDto {
  readonly id: string;
  readonly createdAt: string;
  readonly rngSeed: string;
  readonly heroRef: string;
  readonly packId: string;
  readonly packVersion: string;
  readonly region: RegionId;
}

export interface SessionSummaryDto {
  readonly session: SessionDto;
  readonly nextTurnIndex: number;
  readonly journeyComplete: boolean;
}

export interface SessionListDto {
  readonly sessions: readonly SessionSummaryDto[];
}

export interface CreatedSessionDto {
  readonly session: SessionDto;
  readonly nextTurnIndex: number;
  readonly journeyComplete: boolean;
}

export interface SessionDetailDto {
  readonly session: SessionDto;
  readonly turns: readonly TurnDto[];
  readonly labels: LabelsDto;
  readonly nextTurnIndex: number;
  readonly journeyComplete: boolean;
  readonly packCurrent: boolean;
}

/** POST .../turns (201). The client re-GETs after it; only the type is checked. */
export interface PlayedTurnDto {
  readonly turnIndex: number;
  readonly pkg: PackageDto;
  readonly labels: LabelsDto;
  readonly prose: string | null;
  readonly proseState: Exclude<ProseState, 'failed'>;
  readonly gate: readonly GateFindingDto[];
  readonly generationId: string | null;
  readonly nextTurnIndex: number;
  readonly journeyComplete: boolean;
}

/** POST .../turns/:n/prose (201): the outcome of THIS generation only. */
export interface RegeneratedProseDto {
  readonly turnIndex: number;
  readonly prose: string | null;
  readonly proseState: Exclude<ProseState, 'failed'>;
  readonly gate: readonly GateFindingDto[];
  readonly generationId: string | null;
}

/** The fixed error codes (server/http/errors.ts API_ERRORS; a test keeps the two in step). */
export const API_ERROR_CODES = [
  'invalid_request',
  'forbidden_host',
  'forbidden_origin',
  'not_found',
  'session_not_found',
  'turn_not_found',
  'pack_mismatch',
  'journey_complete',
  'turn_conflict',
  'generation_in_progress',
  'payload_too_large',
  'unsupported_media_type',
  'unsupported_route',
  'internal_error',
  'keeper_failed',
  'keeper_not_configured',
  'database_not_configured',
  'database_unavailable',
  'database_misconfigured',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
  readonly error: { readonly code: ApiErrorCode; readonly message: string };
}
