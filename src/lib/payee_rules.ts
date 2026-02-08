import { and, eq } from 'drizzle-orm';
import { makeDb } from '../db/client.js';
import { payeeRules, payees } from '../db/schema.js';

export type PayeeRuleMatch = 'exact' | 'contains' | 'regex';

export function ruleMatches(match: PayeeRuleMatch, pattern: string, input: string): boolean {
  if (match === 'exact') return input === pattern;
  if (match === 'contains') return input.includes(pattern);
  if (match === 'regex') {
    const re = new RegExp(pattern);
    return re.test(input);
  }
  return false;
}

export async function resolvePayeeByRules(db: ReturnType<typeof makeDb>['db'], rawPayeeName: string) {
  const name = rawPayeeName;
  const rules = await db
    .select({ id: payeeRules.id, match: payeeRules.match, pattern: payeeRules.pattern, targetPayeeId: payeeRules.targetPayeeId })
    .from(payeeRules)
    .where(eq(payeeRules.archived, false));

  for (const r of rules) {
    try {
      if (ruleMatches(r.match as PayeeRuleMatch, String(r.pattern), name,)) {
        const target = await db.select({ id: payees.id, name: payees.name }).from(payees).where(eq(payees.id, r.targetPayeeId)).limit(1);
        if (target[0]) return { payeeId: target[0].id, canonicalName: target[0].name, ruleId: r.id };
      }
    } catch {
      // ignore invalid regex errors etc.
    }
  }

  return null;
}
