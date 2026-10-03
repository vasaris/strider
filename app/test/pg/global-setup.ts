// test:pg fails (never skips) without a *_test TEST_DATABASE_URL.
import { testDatabaseUrl } from './target';

export default function setup(): void {
  testDatabaseUrl();
}
