import { migrate } from 'drizzle-orm/libsql/migrator';
import { makeDb } from './client.js';

export async function ensureMigrated() {
  const { db } = makeDb();
  await migrate(db, { migrationsFolder: new URL('./migrations', import.meta.url).pathname });
}
