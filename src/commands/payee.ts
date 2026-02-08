import { Command } from 'commander';
import { asc, eq } from 'drizzle-orm';
import { makeDb } from '../db/client.js';
import { payees, transactions } from '../db/schema.js';
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

export async function resolveOrCreatePayeeId(db: ReturnType<typeof makeDb>['db'], nameRaw: string): Promise<string> {
  const name = requireNonEmpty(nameRaw, 'Payee name is required');
  const existing = await db.select().from(payees).where(eq(payees.name, name)).limit(1);
  if (existing[0]) return existing[0].id;

  const now = nowIsoUtc();
  const row = { id: newId('payee'), name, createdAt: now, updatedAt: now };
  await db.insert(payees).values(row);
  return row.id;
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

        // Delete source
        await db.delete(payees).where(eq(payees.id, sourceId));

        print(cmd, `Merged payee ${sourceId} -> ${targetId}`, { sourceId, targetId });
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });
}
