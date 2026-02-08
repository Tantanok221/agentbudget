import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema.js';

export type Db = ReturnType<typeof makeDb>;

export function makeDb(opts?: { url?: string; authToken?: string }) {
  const url = opts?.url ?? process.env.TURSO_DATABASE_URL ?? 'file:./data/local.db';
  const authToken = opts?.authToken ?? process.env.TURSO_AUTH_TOKEN;

  const client = createClient({ url, authToken });
  const db = drizzle(client, { schema });
  return { client, db };
}
