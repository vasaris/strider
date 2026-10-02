-- brodyazhnik init (3.1-C6): sessions, turns and generations in the private schema brodyazhnik.
-- Applied ONLY by the app's own runner (npm run db:migrate -w app; P11). No transaction control
-- in this file: the runner wraps it, together with its accounting row, in one transaction.
--
-- Model (Q2): a session holds its seed, hero, pack identity and the initial JourneyState. Every
-- turn appends the FULL JourneyState after that turn (rng and hero inside) and that turn's
-- immutable NarrativePackage. Every Keeper call appends a generation -- prose or an error -- with
-- its provenance; regenerating prose appends another generation for the same turn.
--
-- P12 append-only: UPDATE, DELETE and TRUNCATE are rejected on every table (triggers below).
-- Rolling history back (arch 2.1) will come later as a head pointer / branch over these rows,
-- never as deletion.
-- The triggers stop app bugs and other roles, not a holder of the owner credentials (the owner
-- can DISABLE TRIGGER, replace the function or DROP); splitting the owner from the runtime role
-- is deferred (DB-ROLES1).
--
-- Access: server-only, through DATABASE_URL, connecting as the owner of these tables -- a dedicated
-- ordinary role, never a superuser or BYPASSRLS one (README; the CLI refuses those). RLS is
-- enabled on every table with ZERO policies and without FORCE: the owner bypasses RLS by design,
-- and any other role (Supabase anon / authenticated, were this schema ever exposed) sees nothing.
--
-- Error codes raised here (mapped by the Postgres SessionStore):
--   BRD01  a turn index that is not the next contiguous index of its session
--   BRD02  UPDATE / DELETE / TRUNCATE on an append-only table
--   23503  (raised by the contiguity trigger too) a turn for a session that does not exist

-- The runner bootstraps the schema before applying files, so this must not fail if it exists.
create schema if not exists brodyazhnik;
revoke all on schema brodyazhnik from public;

create table brodyazhnik.sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- P10: 1..128 characters. Entropy is the seed generator's job; short known seeds such as
  -- 'a3-1' are legitimate (contract tests, replaying a seed to debug).
  rng_seed text not null check (length(rng_seed) between 1 and 128),
  hero_ref text not null check (length(hero_ref) between 1 and 128),
  pack_id text not null check (length(pack_id) > 0),
  pack_version text not null check (length(pack_version) > 0),
  initial_state jsonb not null check (jsonb_typeof(initial_state) = 'object')
);

-- Contiguity: turn indices are 0-based and contiguous per session. The state before turn n is
-- turn n-1's state, or sessions.initial_state for n = 0, so a gap would break the chain. The
-- before-insert trigger below enforces it for every code path; two concurrent inserts of the
-- same index both pass it and the loser fails on the primary key (23505).
create table brodyazhnik.turns (
  session_id uuid not null references brodyazhnik.sessions (id),
  turn_index integer not null check (turn_index >= 0),
  created_at timestamptz not null default now(),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  pkg jsonb not null check (jsonb_typeof(pkg) = 'object'),
  pack_version text not null check (length(pack_version) > 0),
  primary key (session_id, turn_index)
);

create table brodyazhnik.generations (
  id bigint generated always as identity primary key,
  session_id uuid not null,
  turn_index integer not null,
  created_at timestamptz not null default now(),
  prose text check (prose is null or length(prose) > 0),
  error text check (error is null or length(error) > 0),
  model text not null check (length(model) > 0),
  keeper_prompt_path text not null check (length(keeper_prompt_path) > 0),
  keeper_prompt_sha256 text not null check (keeper_prompt_sha256 ~ '^[0-9a-f]{64}$'),
  tone_sha256 text not null check (tone_sha256 ~ '^[0-9a-f]{64}$'),
  assembly_sha256 text not null check (assembly_sha256 ~ '^[0-9a-f]{64}$'),
  check (num_nonnulls(prose, error) = 1),
  foreign key (session_id, turn_index) references brodyazhnik.turns (session_id, turn_index)
);

create index generations_turn_idx on brodyazhnik.generations (session_id, turn_index, id);

-- A missing session is reported first (as the foreign key would, 23503), then a non-contiguous
-- index (BRD01); check constraints run after before-row triggers.
create function brodyazhnik.turns_contiguous() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  next_index integer;
begin
  if not exists (select 1 from brodyazhnik.sessions where id = new.session_id) then
    raise exception 'brodyazhnik: session % does not exist', new.session_id
      using errcode = 'foreign_key_violation';
  end if;
  select coalesce(max(turn_index) + 1, 0) into next_index
    from brodyazhnik.turns
    where session_id = new.session_id;
  if new.turn_index is distinct from next_index then
    raise exception 'brodyazhnik: turn % of session % is not contiguous (next is %)',
      new.turn_index, new.session_id, next_index
      using errcode = 'BRD01';
  end if;
  return new;
end
$$;

create trigger turns_contiguous before insert on brodyazhnik.turns
  for each row execute function brodyazhnik.turns_contiguous();

-- P12: one function for all three tables. Row-level triggers catch UPDATE and DELETE; TRUNCATE
-- fires only statement-level triggers, hence the second trigger per table.
create function brodyazhnik.reject_mutation() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'brodyazhnik: % on %.% rejected: the table is append-only (P12)',
    tg_op, tg_table_schema, tg_table_name
    using errcode = 'BRD02';
end
$$;

create trigger sessions_append_only before update or delete on brodyazhnik.sessions
  for each row execute function brodyazhnik.reject_mutation();
create trigger sessions_no_truncate before truncate on brodyazhnik.sessions
  for each statement execute function brodyazhnik.reject_mutation();

create trigger turns_append_only before update or delete on brodyazhnik.turns
  for each row execute function brodyazhnik.reject_mutation();
create trigger turns_no_truncate before truncate on brodyazhnik.turns
  for each statement execute function brodyazhnik.reject_mutation();

create trigger generations_append_only before update or delete on brodyazhnik.generations
  for each row execute function brodyazhnik.reject_mutation();
create trigger generations_no_truncate before truncate on brodyazhnik.generations
  for each statement execute function brodyazhnik.reject_mutation();

-- RLS on, zero policies, no FORCE (see the header).
alter table brodyazhnik.sessions enable row level security;
alter table brodyazhnik.turns enable row level security;
alter table brodyazhnik.generations enable row level security;
