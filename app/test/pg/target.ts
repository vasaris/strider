// test:pg target guard: TEST_DATABASE_URL must be set and name a database ending in _test.
// Messages never include the URL (it carries the password).
export const PG_INSTRUCTION =
  'test:pg needs TEST_DATABASE_URL=postgres://<owner role>@<host>/<name>_test (a dedicated *_test database; never the dev database)';

/** The URL, or throws a one-line instruction. */
export function testDatabaseUrl(): string {
  const url = process.env['TEST_DATABASE_URL'];
  if (url === undefined || url.trim() === '') throw new Error(PG_INSTRUCTION);
  let name: string;
  try {
    const u = new URL(url);
    if (u.protocol !== 'postgres:' && u.protocol !== 'postgresql:') throw new Error('protocol');
    name = decodeURIComponent(u.pathname.replace(/^\//, ''));
  } catch {
    throw new Error(`TEST_DATABASE_URL is not a postgres:// URL. ${PG_INSTRUCTION}`);
  }
  if (!/^[A-Za-z0-9_]+_test$/.test(name)) throw new Error(`refusing: the TEST_DATABASE_URL database name does not end in _test. ${PG_INSTRUCTION}`);
  return url;
}
