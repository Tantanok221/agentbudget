import { eq } from 'drizzle-orm';
import { makeDb } from '../db/client.js';
import { scheduledTransactions } from '../db/schema.js';
import { requireNonEmpty } from './util.js';

export async function resolveScheduleId(db: ReturnType<typeof makeDb>['db'], valueRaw: string): Promise<string> {
  const value = requireNonEmpty(valueRaw, 'Schedule is required');
  const byId = await db.select({ id: scheduledTransactions.id }).from(scheduledTransactions).where(eq(scheduledTransactions.id, value)).limit(1);
  if (byId[0]) return byId[0].id;
  const byName = await db
    .select({ id: scheduledTransactions.id })
    .from(scheduledTransactions)
    .where(eq(scheduledTransactions.name, value))
    .limit(1);
  if (byName[0]) return byName[0].id;
  throw new Error(`Schedule not found: ${value}`);
}
