import { Command } from 'commander';
import { eq } from 'drizzle-orm';
import { makeDb } from '../db/client.js';
import { envelopes, targets } from '../db/schema.js';
import { print, printError } from '../lib/output.js';
import { parseMonthStrict } from '../lib/month.js';
import { newId, nowIsoUtc, requireNonEmpty } from '../lib/util.js';

async function resolveEnvelopeId(db: ReturnType<typeof makeDb>['db'], envelope: string): Promise<string> {
  const value = requireNonEmpty(envelope, 'Envelope is required');
  const byId = await db.select().from(envelopes).where(eq(envelopes.id, value)).limit(1);
  if (byId[0]) return byId[0].id;
  const byName = await db.select().from(envelopes).where(eq(envelopes.name, value)).limit(1);
  if (byName[0]) return byName[0].id;
  throw new Error(`Envelope not found: ${value}`);
}

export function registerTargetCommands(program: Command) {
  const target = program.command('target').description('Manage envelope targets/goals').addHelpCommand(false);

  target.action(function () {
    (this as Command).outputHelp();
    process.exit(0);
  });

  target
    .command('list')
    .description('List active targets')
    .action(async function () {
      const cmd = this as Command;
      try {
        const { db } = makeDb();
        const rows = await db
          .select({
            id: targets.id,
            type: targets.type,
            amount: targets.amount,
            targetAmount: targets.targetAmount,
            targetMonth: targets.targetMonth,
            startMonth: targets.startMonth,
            envelopeId: envelopes.id,
            envelopeName: envelopes.name,
            groupName: envelopes.groupName,
            archived: targets.archived,
          })
          .from(targets)
          .innerJoin(envelopes, eq(envelopes.id, targets.envelopeId))
          .where(eq(targets.archived, false));

        print(cmd, rows.map((r) => `- ${r.envelopeName}: ${r.type}`).join('\n') || '(none)', rows);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  target
    .command('set <envelope>')
    .description('Set/replace the active target for an envelope')
    .requiredOption('--type <type>', 'monthly|needed-for-spending|by-date')
    .option('--amount <minorUnits>', 'For monthly / needed-for-spending')
    .option('--target-amount <minorUnits>', 'For by-date')
    .option('--target-month <YYYY-MM>', 'For by-date')
    .option('--start-month <YYYY-MM>', 'For by-date (default: current month)')
    .option('--note <note>', 'Note')
    .action(async function (envelopeArg: string) {
      const cmd = this as Command;
      try {
        const { db } = makeDb();
        const envelopeId = await resolveEnvelopeId(db, envelopeArg);

        const typeRaw = String(cmd.opts().type);
        const type =
          typeRaw === 'monthly'
            ? 'monthly'
            : typeRaw === 'needed-for-spending'
              ? 'needed_for_spending'
              : typeRaw === 'by-date'
                ? 'by_date'
                : null;
        if (!type) throw new Error('Invalid --type. Use monthly|needed-for-spending|by-date');

        const now = nowIsoUtc();

        // compute fields
        let amount: number | null = null;
        let targetAmount: number | null = null;
        let targetMonth: string | null = null;
        let startMonth: string | null = null;

        if (type === 'monthly' || type === 'needed_for_spending') {
          const a = Number.parseInt(String(cmd.opts().amount ?? ''), 10);
          if (!Number.isFinite(a) || a < 0) throw new Error('--amount is required and must be >= 0');
          amount = a;
        }

        if (type === 'by_date') {
          const ta = Number.parseInt(String(cmd.opts().targetAmount ?? ''), 10);
          if (!Number.isFinite(ta) || ta < 0) throw new Error('--target-amount is required and must be >= 0');
          const tm = String(cmd.opts().targetMonth ?? '').trim();
          if (!tm) throw new Error('--target-month is required');
          parseMonthStrict(tm);

          const smRaw = cmd.opts().startMonth ? String(cmd.opts().startMonth) : null;
          const sm = smRaw ? String(smRaw).trim() : null;
          const defaultStart = (() => {
            const d = new Date();
            const y = d.getUTCFullYear();
            const m = String(d.getUTCMonth() + 1).padStart(2, '0');
            return `${y}-${m}`;
          })();

          parseMonthStrict(sm ?? defaultStart);

          targetAmount = ta;
          targetMonth = tm;
          startMonth = sm ?? defaultStart;
        }

        // upsert: replace existing active target
        const existing = await db.select({ id: targets.id }).from(targets).where(eq(targets.envelopeId, envelopeId)).limit(1);

        const row = {
          id: existing[0]?.id ?? newId('tgt'),
          envelopeId,
          type,
          amount,
          targetAmount,
          targetMonth,
          startMonth,
          note: cmd.opts().note ? String(cmd.opts().note) : null,
          archived: false,
          createdAt: existing[0] ? now : now,
          updatedAt: now,
        };

        if (existing[0]) {
          await db
            .update(targets)
            .set({
              type: row.type,
              amount: row.amount,
              targetAmount: row.targetAmount,
              targetMonth: row.targetMonth,
              startMonth: row.startMonth,
              note: row.note,
              archived: false,
              updatedAt: now,
            })
            .where(eq(targets.id, row.id));
        } else {
          await db.insert(targets).values(row);
        }

        print(cmd, `Set target for ${envelopeArg}: ${type}`, row);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  target
    .command('clear <envelope>')
    .description('Remove (archive) the active target for an envelope')
    .action(async function (envelopeArg: string) {
      const cmd = this as Command;
      try {
        const { db } = makeDb();
        const envelopeId = await resolveEnvelopeId(db, envelopeArg);
        await db.update(targets).set({ archived: true, updatedAt: nowIsoUtc() }).where(eq(targets.envelopeId, envelopeId));
        print(cmd, `Cleared target for ${envelopeArg}`, { envelopeId });
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });
}
