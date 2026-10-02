// db:migrate -- apply app/supabase/migrations to the database at DATABASE_URL (P11 runner).
// Run as `npm run db:migrate -w app`: tsx with the react-server condition, so 'server-only'
// resolves to its empty module. Refuses a superuser / BYPASSRLS role before anything runs
// (role.ts). Prints applied / skipped versions; failures as one line from describeDbError,
// never the URL.
import { fileURLToPath } from 'node:url';

import { describeDbError } from '../src/server/db/describe';
import { migrate } from '../src/server/db/migrate';
import { closePool, getPool, pgExecutor } from '../src/server/db/pg';
import { assertOrdinaryRole } from '../src/server/db/role';

const DIR = fileURLToPath(new URL('../supabase/migrations', import.meta.url));

let status = 0;
try {
  const sql = pgExecutor(getPool());
  await assertOrdinaryRole(sql);
  const { applied, skipped } = await migrate(sql, DIR);
  console.log(`db:migrate: applied ${applied.length}${applied.length > 0 ? ` (${applied.join(', ')})` : ''}`);
  console.log(`db:migrate: skipped ${skipped.length}${skipped.length > 0 ? ` (${skipped.join(', ')})` : ''}`);
} catch (err) {
  console.error(`db:migrate: ${describeDbError(err)}`);
  status = 1;
} finally {
  await closePool().catch(() => undefined);
}
process.exit(status);
