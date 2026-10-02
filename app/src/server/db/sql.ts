// SqlExecutor: the one port between our SQL and a Postgres driver (pg in production, PGlite in
// offline tests). Serialization stays in OUR code (jsonb in as $n::jsonb text, out as ::text), so
// both drivers see the same SQL and return the same shapes.
import 'server-only';

export interface SqlExecutor {
  /** One parameterized statement. */
  query<R extends object = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<{ rows: R[] }>;
  /**
   * A multi-statement script on ONE connection (simple protocol). On error the implementation
   * issues ROLLBACK on that connection before rethrowing; the connection is always released.
   */
  exec(script: string): Promise<void>;
}

/** The SQLSTATE of a driver error (pg DatabaseError and PGlite errors both carry `code`). */
export function sqlState(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null || !('code' in err)) return undefined;
  const code = (err as { code: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}
