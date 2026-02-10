import { eq } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { settings } from '../db/schema.js';
import { nowIsoUtc } from './util.js';

export async function getSetting(db: LibSQLDatabase, key: string): Promise<string | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function setSetting(db: LibSQLDatabase, key: string, value: string): Promise<void> {
  const updatedAt = nowIsoUtc();
  // SQLite upsert
  await db
    .insert(settings)
    .values({ key, value, updatedAt })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt } });
}

export async function getBudgetCurrency(db: LibSQLDatabase): Promise<string> {
  // DB-backed first
  const v = await getSetting(db, 'currency');
  if (v) return v;
  // Env fallback (useful for ad-hoc runs)
  if (process.env.AGENTBUDGET_CURRENCY) return String(process.env.AGENTBUDGET_CURRENCY);
  return 'MYR';
}
