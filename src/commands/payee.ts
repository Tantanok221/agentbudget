import { Command } from 'commander';
import { and, asc, eq } from 'drizzle-orm';
import { makeDb } from '../db/client.js';
import { payeeRules, payees, transactions } from '../db/schema.js';
import { print, printError } from '../lib/output.js';
import { newId, nowIsoUtc, requireNonEmpty } from '../lib/util.js';

async function resolvePayeeId(db: ReturnType<typeof makeDb>['db'], valueRaw: string): Promise<string> {
  const value = requireNonEmpty(valueRaw, 'Payee is required');
  const byId = await db.select().from(payees).where(eq(payees.id, value)).limit(1);
  if (byId[0]) return byId[0].id;
  const byName = await db.select().from(payees).where(eq(payees.name, value)).limit(1);
  if (byName[0]) return byName[0].id;
  throw new Error(`Payee not found: ${value}`);
}

export async function resolveOrCreatePayee(db: ReturnType<typeof makeDb>['db'], nameRaw: string): Promise<{ id: string; name: string }> {
  const name = requireNonEmpty(nameRaw, 'Payee name is required');

  // Apply payee rules first (pattern matching), so imports normalize.
  const { resolvePayeeByRules } = await import('../lib/payee_rules.js');
  const ruled = await resolvePayeeByRules(db, name);
  if (ruled) return { id: ruled.payeeId, name: ruled.canonicalName };

  const existing = await db.select({ id: payees.id, name: payees.name }).from(payees).where(eq(payees.name, name)).limit(1);
  if (existing[0]) return existing[0];

  const now = nowIsoUtc();
  const row = { id: newId('payee'), name, createdAt: now, updatedAt: now };
  await db.insert(payees).values(row);
  return { id: row.id, name: row.name };
}

export async function resolveOrCreatePayeeId(db: ReturnType<typeof makeDb>['db'], nameRaw: string): Promise<string> {
  const r = await resolveOrCreatePayee(db, nameRaw);
  return r.id;
}

export function registerPayeeCommands(program: Command) {
  const payee = program.command('payee').description('Manage payees').addHelpCommand(false);

  payee.action(function () {
    (this as Command).outputHelp();
    process.exit(0);
  });

  payee
    .command('list')
    .description('List payees')
    .action(async function () {
      const cmd = this as Command;
      try {
        const { db } = makeDb();
        const rows = await db.select().from(payees).orderBy(asc(payees.name));
        print(cmd, rows.map((p) => `- ${p.name} (${p.id})`).join('\n') || '(none)', rows);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  payee
    .command('create <name>')
    .description('Create a payee')
    .action(async function (name: string) {
      const cmd = this as Command;
      try {
        const clean = requireNonEmpty(name, 'Payee name is required');
        const { db } = makeDb();
        const id = await resolveOrCreatePayeeId(db, clean);
        const row = (await db.select().from(payees).where(eq(payees.id, id)).limit(1))[0];
        print(cmd, `Created payee: ${row.name}`, row);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  payee
    .command('rename <from> <to>')
    .description('Rename a payee')
    .action(async function (from: string, to: string) {
      const cmd = this as Command;
      try {
        const toName = requireNonEmpty(to, 'New payee name is required');
        const { db } = makeDb();
        const fromId = await resolvePayeeId(db, from);

        await db.update(payees).set({ name: toName, updatedAt: nowIsoUtc() }).where(eq(payees.id, fromId));
        // Keep transactions.payeeName in sync for this payee
        await db.update(transactions).set({ payeeName: toName }).where(eq(transactions.payeeId, fromId));

        const row = (await db.select().from(payees).where(eq(payees.id, fromId)).limit(1))[0];
        print(cmd, `Renamed payee to: ${row.name}`, row);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  payee
    .command('merge <source>')
    .description('Merge a payee into another (updates transactions, deletes source)')
    .requiredOption('--into <target>', 'Target payee id/name')
    .action(async function (source: string) {
      const cmd = this as Command;
      try {
        const { db } = makeDb();
        const sourceId = await resolvePayeeId(db, source);
        const targetId = await resolvePayeeId(db, String(cmd.opts().into));
        if (sourceId === targetId) throw new Error('source and target payee must be different');

        // Update txs
        const target = (await db.select().from(payees).where(eq(payees.id, targetId)).limit(1))[0];
        await db.update(transactions).set({ payeeId: targetId, payeeName: target.name }).where(eq(transactions.payeeId, sourceId));

        // Update rules pointing at source
        await db.update(payeeRules).set({ targetPayeeId: targetId, updatedAt: nowIsoUtc() }).where(eq(payeeRules.targetPayeeId, sourceId));

        // Delete source
        await db.delete(payees).where(eq(payees.id, sourceId));

        print(cmd, `Merged payee ${sourceId} -> ${targetId}`, { sourceId, targetId });
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  const rule = payee.command('rule').description('Payee normalization rules (pattern matching)').addHelpCommand(false);

  rule.action(function () {
    (this as Command).outputHelp();
    process.exit(0);
  });

  rule
    .command('list')
    .description('List payee rules')
    .action(async function () {
      const cmd = this as Command;
      try {
        const { db } = makeDb();
        const rows = await db.select().from(payeeRules).where(eq(payeeRules.archived, false)).orderBy(asc(payeeRules.createdAt));
        const data = rows.map((r) => ({
          id: r.id,
          match: r.match,
          pattern: r.pattern,
          targetPayeeId: r.targetPayeeId,
          archived: Boolean(r.archived),
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));
        print(cmd, data.map((r) => `- ${r.match} ${r.pattern} -> ${r.targetPayeeId} (${r.id})`).join('\n') || '(none)', data);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  rule
    .command('add')
    .description('Add a payee rule')
    .requiredOption('--match <exact|contains|regex>', 'Match type')
    .requiredOption('--pattern <text>', 'Pattern')
    .requiredOption('--to <payee>', 'Target payee id/name')
    .action(async function () {
      const cmd = this as Command;
      try {
        const { db } = makeDb();
        const opts = cmd.opts();
        const match = String(opts.match);
        if (!['exact', 'contains', 'regex'].includes(match)) throw new Error(`Invalid --match: ${match}`);
        const pattern = requireNonEmpty(String(opts.pattern), 'Pattern is required');
        const targetPayeeId = await resolvePayeeId(db, String(opts.to));

        // Validate regex early
        if (match === 'regex') {
          try {
            // eslint-disable-next-line no-new
            new RegExp(pattern);
          } catch (e: any) {
            throw new Error(`Invalid regex pattern: ${e?.message ?? String(e)}`);
          }
        }

        const now = nowIsoUtc();
        const row = {
          id: newId('payrule'),
          match: match as any,
          pattern,
          targetPayeeId,
          archived: false as const,
          createdAt: now,
          updatedAt: now,
        };
        await db.insert(payeeRules).values(row);
        print(cmd, `Added payee rule ${row.id}`, row);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  rule
    .command('archive <id>')
    .description('Archive (disable) a payee rule')
    .action(async function (id: string) {
      const cmd = this as Command;
      try {
        const { db } = makeDb();
        const value = requireNonEmpty(String(id), 'Rule id is required');
        await db.update(payeeRules).set({ archived: true, updatedAt: nowIsoUtc() }).where(eq(payeeRules.id, value));
        print(cmd, `Archived payee rule ${value}`, { id: value });
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });
}
