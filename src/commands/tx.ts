import { Command } from 'commander';
import fs from 'node:fs';
import readline from 'node:readline';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { makeDb } from '../db/client.js';
import { accounts, envelopes, transactionSplits, transactions } from '../db/schema.js';
import { print, printError } from '../lib/output.js';
import { newId, nowIsoUtc, requireNonEmpty } from '../lib/util.js';

type SplitInput = { envelope: string; amount: number; note?: string };

type ImportTx = {
  externalId?: string;
  account: string;
  date: string;
  amount: number;
  payee?: string;
  memo?: string;
  skipBudget?: boolean;
} & (
  | { envelope: string; splits?: never }
  | { splits: SplitInput[]; envelope?: never }
  | { skipBudget: true; envelope?: never; splits?: never }
);

const SplitSchema = z.object({
  envelope: z.string().min(1),
  amount: z.number().finite(),
  note: z.string().optional(),
});

const ImportTxSchema = z
  .object({
    externalId: z.string().optional(),
    account: z.string().min(1),
    date: z.string().min(1),
    amount: z.number().finite(),
    payee: z.string().optional(),
    memo: z.string().optional(),
    skipBudget: z.boolean().optional(),
    envelope: z.string().optional(),
    splits: z.array(SplitSchema).optional(),
  })
  .superRefine((val, ctx) => {
    const skip = Boolean(val.skipBudget);
    if (skip) return;
    if (!val.envelope && !val.splits) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Provide envelope or splits (or set skipBudget=true)' });
    }
    if (val.envelope && val.splits) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Provide either envelope or splits, not both' });
    }
  });

function parseDateToIsoUtc(input: string): string {
  // Accept ISO, YYYY-MM-DD, or anything Date can parse.
  // Store as ISO UTC.
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${input}`);
  return d.toISOString();
}

async function resolveAccountId(db: ReturnType<typeof makeDb>['db'], account: string): Promise<string> {
  const value = requireNonEmpty(account, 'Account is required');
  const byId = await db.select().from(accounts).where(eq(accounts.id, value)).limit(1);
  if (byId[0]) return byId[0].id;
  const byName = await db.select().from(accounts).where(eq(accounts.name, value)).limit(1);
  if (byName[0]) return byName[0].id;
  throw new Error(`Account not found: ${value}`);
}

async function resolveEnvelopeId(db: ReturnType<typeof makeDb>['db'], envelope: string): Promise<string> {
  const value = requireNonEmpty(envelope, 'Envelope is required');
  const byId = await db.select().from(envelopes).where(eq(envelopes.id, value)).limit(1);
  if (byId[0]) return byId[0].id;
  const byName = await db.select().from(envelopes).where(eq(envelopes.name, value)).limit(1);
  if (byName[0]) return byName[0].id;
  throw new Error(`Envelope not found: ${value}`);
}

function parseSplitsJson(raw: string): SplitInput[] {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    throw new Error('Invalid JSON provided to --splits-json');
  }
  if (!Array.isArray(v)) throw new Error('--splits-json must be a JSON array');
  const splits: SplitInput[] = [];
  for (const item of v) {
    if (!item || typeof item !== 'object') throw new Error('Each split must be an object');
    const s = item as any;
    if (typeof s.envelope !== 'string' || !s.envelope.trim()) throw new Error('Split.envelope must be a non-empty string');
    if (typeof s.amount !== 'number' || !Number.isFinite(s.amount)) throw new Error('Split.amount must be a finite number (minor units)');
    if (s.note != null && typeof s.note !== 'string') throw new Error('Split.note must be a string');
    splits.push({ envelope: s.envelope, amount: Math.trunc(s.amount), note: s.note });
  }
  return splits;
}

export function registerTxCommands(program: Command) {
  const tx = program.command('tx').description('Manage transactions').addHelpCommand(false);

  tx.action(function () {
    (this as Command).outputHelp();
    process.exit(0);
  });

  tx
    .command('add')
    .description('Add a transaction (amount: negative=outflow, positive=inflow)')
    .requiredOption('--account <account>', 'Account name or id')
    .requiredOption('--amount <minorUnits>', 'Signed integer in minor units (e.g. -2350)')
    .requiredOption('--date <date>', 'Posted date (ISO or YYYY-MM-DD)')
    .option('--payee <name>', 'Payee name')
    .option('--memo <memo>', 'Memo')
    .option('--external-id <id>', 'Idempotency key / import id')
    .option('--skip-budget', 'Do not affect budget/envelopes', false)
    .option('--envelope <envelope>', 'Single envelope name/id (shortcut for 1 split)')
    .option('--splits-json <json>', 'JSON array of splits: [{"envelope":"Groceries","amount":-12000}]')
    .action(async function () {
      const cmd = this as Command;
      try {
        const opts = cmd.opts();
        const { db } = makeDb();

        const amount = Number.parseInt(String(opts.amount), 10);
        if (!Number.isFinite(amount)) throw new Error('Invalid --amount (must be integer minor units)');

        const postedAt = parseDateToIsoUtc(String(opts.date));
        const accountId = await resolveAccountId(db, String(opts.account));

        const skipBudget = Boolean(opts.skipBudget);
        const externalId = opts.externalId ? String(opts.externalId) : null;

        const txRow = {
          id: newId('tx'),
          externalId,
          accountId,
          postedAt,
          amount,
          payeeName: opts.payee ? String(opts.payee) : null,
          memo: opts.memo ? String(opts.memo) : null,
          cleared: 'cleared' as const,
          skipBudget,
          createdAt: nowIsoUtc(),
        };

        // Idempotent insert by externalId (if provided)
        if (externalId) {
          const existing = await db.select().from(transactions).where(eq(transactions.externalId, externalId)).limit(1);
          if (existing[0]) {
            print(cmd, `Transaction already exists (externalId=${externalId}): ${existing[0].id}`, existing[0]);
            return;
          }
        }

        await db.insert(transactions).values(txRow);

        const splits: SplitInput[] = [];
        if (!skipBudget) {
          if (opts.splitsJson) {
            splits.push(...parseSplitsJson(String(opts.splitsJson)));
          } else if (opts.envelope) {
            splits.push({ envelope: String(opts.envelope), amount });
          } else {
            throw new Error('Provide either --envelope or --splits-json (or use --skip-budget)');
          }

          const sum = splits.reduce((a, s) => a + s.amount, 0);
          if (sum !== amount) {
            throw new Error(`Split amounts must sum to transaction amount. splits_sum=${sum}, amount=${amount}`);
          }

          const splitRows = [] as Array<{ id: string; transactionId: string; envelopeId: string; amount: number; note: string | null }>;
          for (const s of splits) {
            const envelopeId = await resolveEnvelopeId(db, s.envelope);
            splitRows.push({
              id: newId('split'),
              transactionId: txRow.id,
              envelopeId,
              amount: Math.trunc(s.amount),
              note: s.note ?? null,
            });
          }

          if (splitRows.length) await db.insert(transactionSplits).values(splitRows);
        }

        const out = { transaction: txRow, splits };
        print(cmd, `Created tx ${txRow.id} amount=${amount}`, out);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  tx
    .command('import')
    .description('Batch import transactions from JSONL (one JSON object per line)')
    .requiredOption('--from-jsonl <path>', 'Path to JSONL file')
    .option('--dry-run', 'Validate but do not write', false)
    .action(async function () {
      const cmd = this as Command;
      try {
        const opts = cmd.opts();
        const path = requireNonEmpty(String(opts.fromJsonl), '--from-jsonl is required');
        const dryRun = Boolean(opts.dryRun);

        if (!fs.existsSync(path)) throw new Error(`File not found: ${path}`);

        const { db } = makeDb();

        const rl = readline.createInterface({
          input: fs.createReadStream(path, { encoding: 'utf-8' }),
          crlfDelay: Infinity,
        });

        const results: Array<any> = [];
        let lineNo = 0;

        for await (const line of rl) {
          lineNo += 1;
          const trimmed = line.trim();
          if (!trimmed) continue;

          let parsed: any;
          try {
            parsed = JSON.parse(trimmed);
          } catch {
            results.push({ line: lineNo, status: 'error', error: { message: 'Invalid JSON' } });
            continue;
          }

          const valRes = ImportTxSchema.safeParse(parsed);
          if (!valRes.success) {
            results.push({
              line: lineNo,
              externalId: parsed?.externalId,
              status: 'error',
              error: { message: 'Validation failed', details: valRes.error.flatten() },
            });
            continue;
          }

          const rec = valRes.data as ImportTx;

          try {
            const amount = Math.trunc(rec.amount);
            const postedAt = parseDateToIsoUtc(rec.date);
            const accountId = await resolveAccountId(db, rec.account);
            const skipBudget = Boolean(rec.skipBudget);
            const externalId = rec.externalId ? String(rec.externalId) : null;

            if (externalId) {
              const existing = await db.select().from(transactions).where(eq(transactions.externalId, externalId)).limit(1);
              if (existing[0]) {
                results.push({ line: lineNo, externalId, status: 'exists', id: existing[0].id });
                continue;
              }
            }

            const txRow = {
              id: newId('tx'),
              externalId,
              accountId,
              postedAt,
              amount,
              payeeName: rec.payee ? String(rec.payee) : null,
              memo: rec.memo ? String(rec.memo) : null,
              cleared: 'cleared' as const,
              skipBudget,
              createdAt: nowIsoUtc(),
            };

            const splits: SplitInput[] = [];
            if (!skipBudget) {
              if ('splits' in rec && Array.isArray((rec as any).splits)) {
                for (const s of (rec as any).splits as SplitInput[]) splits.push({ envelope: s.envelope, amount: Math.trunc(s.amount), note: s.note });
              } else if ('envelope' in rec && typeof (rec as any).envelope === 'string') {
                splits.push({ envelope: (rec as any).envelope, amount });
              }

              const sum = splits.reduce((a, s) => a + s.amount, 0);
              if (sum !== amount) {
                throw new Error(`Split amounts must sum to transaction amount. splits_sum=${sum}, amount=${amount}`);
              }
            }

            if (!dryRun) {
              await db.insert(transactions).values(txRow);

              if (!skipBudget && splits.length) {
                const splitRows = [] as Array<{ id: string; transactionId: string; envelopeId: string; amount: number; note: string | null }>;
                for (const s of splits) {
                  const envelopeId = await resolveEnvelopeId(db, s.envelope);
                  splitRows.push({
                    id: newId('split'),
                    transactionId: txRow.id,
                    envelopeId,
                    amount: Math.trunc(s.amount),
                    note: s.note ?? null,
                  });
                }
                await db.insert(transactionSplits).values(splitRows);
              }
            }

            results.push({
              line: lineNo,
              externalId,
              status: dryRun ? 'validated' : 'created',
              id: txRow.id,
            });
          } catch (e) {
            results.push({
              line: lineNo,
              externalId: (rec as any)?.externalId,
              status: 'error',
              error: { message: e instanceof Error ? e.message : String(e) },
            });
          }
        }

        const summary = {
          ok: true,
          dryRun,
          total: results.length,
          created: results.filter((r) => r.status === 'created').length,
          exists: results.filter((r) => r.status === 'exists').length,
          validated: results.filter((r) => r.status === 'validated').length,
          errors: results.filter((r) => r.status === 'error').length,
          results,
        };

        print(cmd, `Imported: created=${summary.created} exists=${summary.exists} errors=${summary.errors}`, summary);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  tx
    .command('update')
    .description('Update a transaction (basic)')
    .argument('<id>', 'Transaction id')
    .option('--account <account>', 'New account name/id')
    .option('--amount <minorUnits>', 'New signed amount (minor units)')
    .option('--date <date>', 'New posted date')
    .option('--payee <name>', 'New payee')
    .option('--memo <memo>', 'New memo')
    .option('--skip-budget', 'Set skipBudget=true')
    .option('--no-skip-budget', 'Set skipBudget=false')
    .option('--envelope <envelope>', 'Replace splits with a single envelope split (amount must match)')
    .option('--splits-json <json>', 'Replace splits with JSON array')
    .action(async function (id: string) {
      const cmd = this as Command;
      try {
        const txId = requireNonEmpty(id, 'Transaction id is required');
        const opts = cmd.opts();
        const { db } = makeDb();

        const existing = await db.select().from(transactions).where(eq(transactions.id, txId)).limit(1);
        if (!existing[0]) throw new Error(`Transaction not found: ${txId}`);

        const patch: any = {};

        if (opts.account) patch.accountId = await resolveAccountId(db, String(opts.account));
        if (opts.date) patch.postedAt = parseDateToIsoUtc(String(opts.date));
        if (opts.amount != null) {
          const amt = Number.parseInt(String(opts.amount), 10);
          if (!Number.isFinite(amt)) throw new Error('Invalid --amount');
          patch.amount = amt;
        }
        if (opts.payee != null) patch.payeeName = String(opts.payee);
        if (opts.memo != null) patch.memo = String(opts.memo);
        if (typeof opts.skipBudget === 'boolean') patch.skipBudget = Boolean(opts.skipBudget);

        const newAmount = patch.amount ?? existing[0].amount;
        const skipBudget = patch.skipBudget ?? existing[0].skipBudget;

        const replacingSplits = Boolean(opts.envelope || opts.splitsJson);
        if (replacingSplits && skipBudget) {
          throw new Error('Cannot set splits when skipBudget=true');
        }

        // Update transaction
        if (Object.keys(patch).length) {
          await db.update(transactions).set(patch).where(eq(transactions.id, txId));
        }

        // Replace splits if requested
        if (replacingSplits) {
          const splits: SplitInput[] = [];
          if (opts.splitsJson) splits.push(...parseSplitsJson(String(opts.splitsJson)));
          else if (opts.envelope) splits.push({ envelope: String(opts.envelope), amount: newAmount });

          const sum = splits.reduce((a, s) => a + s.amount, 0);
          if (sum !== newAmount) throw new Error(`Split amounts must sum to transaction amount. splits_sum=${sum}, amount=${newAmount}`);

          await db.delete(transactionSplits).where(eq(transactionSplits.transactionId, txId));

          const splitRows = [] as Array<{ id: string; transactionId: string; envelopeId: string; amount: number; note: string | null }>;
          for (const s of splits) {
            const envelopeId = await resolveEnvelopeId(db, s.envelope);
            splitRows.push({
              id: newId('split'),
              transactionId: txId,
              envelopeId,
              amount: Math.trunc(s.amount),
              note: s.note ?? null,
            });
          }
          if (splitRows.length) await db.insert(transactionSplits).values(splitRows);
        }

        // Return updated row
        const updated = await db.select().from(transactions).where(eq(transactions.id, txId)).limit(1);
        print(cmd, `Updated tx ${txId}`, { transaction: updated[0] });
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  tx
    .command('delete')
    .description('Delete a transaction (hard delete). If it is part of a transfer, deletes both sides.')
    .argument('<id>', 'Transaction id')
    .action(async function (id: string) {
      const cmd = this as Command;
      try {
        const txId = requireNonEmpty(id, 'Transaction id is required');
        const { db } = makeDb();

        const existing = await db
          .select({
            id: transactions.id,
            transferGroupId: transactions.transferGroupId,
            transferPeerId: transactions.transferPeerId,
          })
          .from(transactions)
          .where(eq(transactions.id, txId))
          .limit(1);

        if (!existing[0]) throw new Error(`Transaction not found: ${txId}`);

        const deletedIds = new Set<string>();
        deletedIds.add(txId);

        if (existing[0].transferGroupId) {
          // Prefer peerId, fallback to any other tx in same group.
          if (existing[0].transferPeerId) {
            deletedIds.add(existing[0].transferPeerId);
          } else {
            const others = await db
              .select({ id: transactions.id })
              .from(transactions)
              .where(eq(transactions.transferGroupId, existing[0].transferGroupId));
            for (const o of others) deletedIds.add(o.id);
          }
        }

        const ids = Array.from(deletedIds);
        if (ids.length === 1) {
          await db.delete(transactions).where(eq(transactions.id, txId));
        } else {
          await db.delete(transactions).where(sql`${transactions.id} in ${ids}`);
        }

        print(cmd, `Deleted tx${ids.length > 1 ? 's' : ''}: ${ids.join(', ')}`, { deletedIds: ids });
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  tx
    .command('transfer')
    .description('Transfer money between two accounts (creates two linked transactions; no envelopes)')
    .requiredOption('--from-account <account>', 'From account name/id')
    .requiredOption('--to-account <account>', 'To account name/id')
    .requiredOption('--amount <minorUnits>', 'Positive integer minor units (e.g. 25000)')
    .requiredOption('--date <date>', 'Date (ISO or YYYY-MM-DD)')
    .option('--memo <memo>', 'Memo')
    .action(async function () {
      const cmd = this as Command;
      try {
        const opts = cmd.opts();
        const { db } = makeDb();

        const fromAccountId = await resolveAccountId(db, String(opts.fromAccount));
        const toAccountId = await resolveAccountId(db, String(opts.toAccount));
        if (fromAccountId === toAccountId) throw new Error('from-account and to-account must be different');

        const amount = Number.parseInt(String(opts.amount), 10);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('--amount must be a positive integer (minor units)');

        const postedAt = parseDateToIsoUtc(String(opts.date));
        const memo = opts.memo ? String(opts.memo) : null;

        const transferGroupId = newId('xfer');

        const fromTx = {
          id: newId('tx'),
          externalId: null,
          transferGroupId,
          transferPeerId: null as string | null,
          accountId: fromAccountId,
          postedAt,
          amount: -amount,
          payeeName: null,
          memo,
          cleared: 'cleared' as const,
          skipBudget: true,
          createdAt: nowIsoUtc(),
        };

        const toTx = {
          id: newId('tx'),
          externalId: null,
          transferGroupId,
          transferPeerId: null as string | null,
          accountId: toAccountId,
          postedAt,
          amount: amount,
          payeeName: null,
          memo,
          cleared: 'cleared' as const,
          skipBudget: true,
          createdAt: nowIsoUtc(),
        };

        fromTx.transferPeerId = toTx.id;
        toTx.transferPeerId = fromTx.id;

        await db.insert(transactions).values([fromTx, toTx]);

        print(cmd, `Transferred ${amount} (${fromTx.id} -> ${toTx.id})`, { from: fromTx, to: toTx });
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  tx
    .command('list')
    .description('List transactions')
    .option('--account <account>', 'Filter by account name/id')
    .option('--envelope <envelope>', 'Filter by envelope name/id')
    .option('--from <date>', 'From date (inclusive)')
    .option('--to <date>', 'To date (inclusive)')
    .option('--search <text>', 'Search in payee/memo')
    .option('--limit <n>', 'Max results', '50')
    .action(async function () {
      const cmd = this as Command;
      try {
        const opts = cmd.opts();
        const { db } = makeDb();

        const limit = Math.max(1, Math.min(500, Number.parseInt(String(opts.limit ?? '50'), 10) || 50));

        let whereTx: any[] = [];

        if (opts.account) {
          const accountId = await resolveAccountId(db, String(opts.account));
          whereTx.push(eq(transactions.accountId, accountId));
        }

        if (opts.from) whereTx.push(gte(transactions.postedAt, parseDateToIsoUtc(String(opts.from))));
        if (opts.to) whereTx.push(lte(transactions.postedAt, parseDateToIsoUtc(String(opts.to))));

        if (opts.search) {
          const q = `%${String(opts.search)}%`;
          whereTx.push(
            sql`(coalesce(${transactions.payeeName}, '') like ${q} OR coalesce(${transactions.memo}, '') like ${q})`,
          );
        }

        // Base tx rows
        const base = await db
          .select()
          .from(transactions)
          .where(whereTx.length ? and(...whereTx) : undefined as any)
          .orderBy(desc(transactions.postedAt))
          .limit(limit);

        let rows = base;

        // Envelope filter requires split join
        if (opts.envelope) {
          const envelopeId = await resolveEnvelopeId(db, String(opts.envelope));
          const filtered = await db
            .select({ tx: transactions })
            .from(transactions)
            .innerJoin(transactionSplits, eq(transactionSplits.transactionId, transactions.id))
            .where(and(...(whereTx.length ? whereTx : [sql`1=1`]), eq(transactionSplits.envelopeId, envelopeId)))
            .orderBy(desc(transactions.postedAt))
            .limit(limit);
          rows = filtered.map((r) => r.tx);
        }

        const ids = rows.map((r) => r.id);
        const splitsRows = ids.length
          ? await db
              .select({
                txId: transactionSplits.transactionId,
                amount: transactionSplits.amount,
                note: transactionSplits.note,
                envelopeName: envelopes.name,
                envelopeId: envelopes.id,
              })
              .from(transactionSplits)
              .innerJoin(envelopes, eq(envelopes.id, transactionSplits.envelopeId))
              .where(sql`${transactionSplits.transactionId} in ${ids}`)
          : [];

        const byTx = new Map<string, any[]>();
        for (const s of splitsRows) {
          const arr = byTx.get(s.txId) ?? [];
          arr.push({ envelope: s.envelopeName, envelopeId: s.envelopeId, amount: s.amount, note: s.note });
          byTx.set(s.txId, arr);
        }

        const out = rows.map((t) => ({ ...t, splits: byTx.get(t.id) ?? [] }));

        const human = out
          .map((t) => `${t.postedAt.slice(0, 10)} ${t.amount} ${t.payeeName ?? ''} (${t.id})`)
          .join('\n') || '(none)';

        print(cmd, human, out);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });
}
