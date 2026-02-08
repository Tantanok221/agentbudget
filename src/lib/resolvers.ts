import { eq } from 'drizzle-orm';
import { makeDb } from '../db/client.js';
import { accounts, envelopes } from '../db/schema.js';
import { requireNonEmpty } from './util.js';

export async function resolveAccountId(db: ReturnType<typeof makeDb>['db'], accountRaw: string): Promise<string> {
  const value = requireNonEmpty(accountRaw, 'Account is required');
  const byId = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, value)).limit(1);
  if (byId[0]) return byId[0].id;
  const byName = await db.select({ id: accounts.id }).from(accounts).where(eq(accounts.name, value)).limit(1);
  if (byName[0]) return byName[0].id;
  throw new Error(`Account not found: ${value}`);
}

export async function resolveEnvelopeId(db: ReturnType<typeof makeDb>['db'], envelopeRaw: string): Promise<string> {
  const value = requireNonEmpty(envelopeRaw, 'Envelope is required');
  const byId = await db.select({ id: envelopes.id }).from(envelopes).where(eq(envelopes.id, value)).limit(1);
  if (byId[0]) return byId[0].id;
  const byName = await db.select({ id: envelopes.id }).from(envelopes).where(eq(envelopes.name, value)).limit(1);
  if (byName[0]) return byName[0].id;
  throw new Error(`Envelope not found: ${value}`);
}
