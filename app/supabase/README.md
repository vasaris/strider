# app/supabase -- database migrations

- **Layout only.** Files follow the Supabase CLI naming, `migrations/<YYYYMMDDHHMMSS>_<name>.sql`
  (`name` = `[a-z0-9_]+`), so the project can move to a Supabase-managed workflow later.
- **Applied ONLY by our own runner (P11):** `npm run db:migrate -w app` (reads `DATABASE_URL`
  from the environment; `src/server/db/migrate.ts`). Accounting lives in
  `brodyazhnik.schema_migrations` (version, name, sha256, applied_at).
- **NEVER** run `supabase db push`, `supabase db reset` or `supabase migration up` against a
  database managed by this runner: the CLI tracks `supabase_migrations.schema_migrations`, knows
  nothing of ours, and would try to re-apply everything.
- **No transaction control in a migration** (`BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT`, ...).
  The runner applies each file and its accounting row in one transaction, the file inside
  `DO ... EXECUTE`; Postgres rejects any transaction command there (0A000), so such a file fails
  whole: nothing applied, nothing recorded. Statements that cannot run inside a transaction or a
  function (`CREATE INDEX CONCURRENTLY`, `VACUUM`, ...) are not supported either. A file must not
  contain the runner's dollar-quote tag prefix `$brodyazhnik_mig_` (refused before execution).
- **`SET LOCAL`, not `SET`.** A session-level `SET` (search_path, role, ...) outlives the file's
  transaction on that connection and would leak into later files of the same run.
- **Printable ASCII only** (0x20-0x7E) plus LF and tab -- the project's ASCII rule for SQL, and
  no client-encoding ambiguity: a CR / CRLF, a non-ASCII or another control byte stops the run
  before anything is applied, naming the file and the byte offset.
- **Applied files are immutable.** The runner stores each file's sha256; an edited applied file
  (or a recorded version whose file is gone) stops the run before anything is applied. Change the
  schema with a new migration.
- **New files only after the latest applied one.** A pending file whose timestamp is older than
  the latest applied migration (e.g. from a late-merged branch) stops the run; rename it with a
  newer timestamp.
- Offline tests apply the same files to PGlite (`test/db`, `test/store`); no Docker, no live DB.

## First-time setup (Postgres.app)

The app and the runner connect as a dedicated ordinary role that owns the schema. The default
Postgres.app roles are superusers: they bypass RLS and can switch the append-only triggers off,
so `db:migrate` refuses a superuser or BYPASSRLS role, or a member of one
(`src/server/db/role.ts`). Object
ownership is fixed by the first migrate, so do this before it. Once, as the Postgres.app
superuser (`psql postgres`):

```sql
create role brodyazhnik_app login nosuperuser nocreatedb nocreaterole nobypassrls noreplication;
create database brodyazhnik owner brodyazhnik_app;
revoke all on database brodyazhnik from public;
```

Then, in the shell (never in a committed file):

```sh
export DATABASE_URL=postgres://brodyazhnik_app@127.0.0.1:5432/brodyazhnik
npm run db:migrate -w app
```

A password is optional locally: Postgres.app's local authentication is usually `trust` (check
`pg_hba.conf` in its data directory). If yours asks for one, set it with `\password
brodyazhnik_app` in psql and put it into `DATABASE_URL` in the shell only.
