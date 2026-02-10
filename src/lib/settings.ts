import { eq } from 'drizzle-orm';
import { settings } from '../db/schema.js';
import { nowIsoUtc } from './util.js';

// NOTE: we intentionally keep the DB type loose here to avoid schema-generic typing issues
// across build/test environments. The runtime db is a Drizzle libsql database.
export async function getSetting(db: any, key: string): Promise<string | null> {
  const rows = await db.select().from(settings).where(eq(settings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function setSetting(db: any, key: string, value: string): Promise<void> {
  const updatedAt = nowIsoUtc();
  // SQLite upsert
  await db
    .insert(settings)
    .values({ key, value, updatedAt })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt } });
}

export async function getBudgetCurrency(db: any): Promise<string> {
  // DB-backed first
  const v = await getSetting(db, 'currency');
  if (v) return v;
  // Env fallback (useful for ad-hoc runs)
  if (process.env.AGENTBUDGET_CURRENCY) return String(process.env.AGENTBUDGET_CURRENCY);
  return 'MYR';
}
