import { Command } from 'commander';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { makeDb } from '../db/client.js';
import { scheduledPostings, scheduledTransactions, transactionSplits, transactions } from '../db/schema.js';
import { print, printError } from '../lib/output.js';
import { parseDateToIsoUtc } from '../lib/dates.js';
import { newId, nowIsoUtc, requireNonEmpty } from '../lib/util.js';
import { resolveOrCreatePayeeId } from './payee.js';
import { resolveAccountId, resolveEnvelopeId } from '../lib/resolvers.js';
import { generateDailyOccurrences, generateMonthlyOccurrences, generateWeeklyOccurrences, generateYearlyOccurrences, parseIsoDateOnly, ScheduleRule } from '../lib/schedule_rules.js';
import { parseMajorToMinor } from '../lib/money.js';

function parseInterval(v: string | undefined) {
  const n = v == null ? 1 : Number(v);
  if (!Number.isInteger(n) || n < 1) throw new Error(`Invalid --interval (must be integer >= 1): ${v}`);
  return n;
}

function parseMonthDay(v: string | undefined): number | 'last' {
  if (!v) throw new Error('--month-day is required for monthly schedules');
  if (v === 'last') return 'last';
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 31) throw new Error(`Invalid --month-day: ${v}`);
  return n;
}

function parseWeekdayList(v: string | undefined): Array<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'> {
  if (!v) throw new Error('--weekday is required for weekly schedules');
  const parts = String(v)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!parts.length) throw new Error('--weekday is required for weekly schedules');

  const allowed = new Set(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
  for (const p of parts) {
    if (!allowed.has(p)) throw new Error(`Invalid --weekday: ${p}`);
  }

  // unique, stable order
  return Array.from(new Set(parts)) as any;
}

function parseMonth(v: string | undefined): number {
  if (!v) throw new Error('--month is required for yearly schedules');
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 12) throw new Error(`Invalid --month: ${v}`);
  return n;
}

function ruleFromOpts(opts: any): ScheduleRule {
  const freq = requireNonEmpty(String(opts.freq ?? ''), '--freq is required') as any;
  const interval = parseInterval(opts.interval);

  if (freq === 'daily') return { freq: 'daily', interval };
  if (freq === 'weekly') {
    const weekdays = parseWeekdayList(opts.weekday);
    return { freq: 'weekly', interval, weekdays };
  }
  if (freq === 'monthly') {
    const monthDay = parseMonthDay(opts.monthDay);
    return { freq: 'monthly', interval, monthDay };
  }
  if (freq === 'yearly') {
    const month = parseMonth(opts.month);
    const monthDay = parseMonthDay(opts.monthDay);
    return { freq: 'yearly', interval, month, monthDay };
  }

  throw new Error(`Unsupported --freq: ${freq}`);
}

function parseRange(opts: any): { from: string; to: string } {
  const to = opts.to ? String(opts.to) : null;
  const from = opts.from ? String(opts.from) : null;
  if (!to && !from) throw new Error('Provide --from and/or --to (YYYY-MM-DD)');

  // If only one side provided, treat it as a single-day window.
  const f = from ?? to!;
  const t = to ?? from!;
  parseIsoDateOnly(f);
  parseIsoDateOnly(t);
  if (f > t) throw new Error('--from must be <= --to');
  return { from: f, to: t };
}

function makeOccurrenceId(scheduledId: string, occurrenceDate: string) {
  return `occ_${scheduledId}_${occurrenceDate}`;
}

function parseOccurrenceId(occurrenceId: string): { scheduledId: string; occurrenceDate: string } {
  const m = /^occ_(sched_[a-z0-9-]+)_([0-9]{4}-[0-9]{2}-[0-9]{2})$/.exec(occurrenceId);
  if (!m) throw new Error(`Invalid occurrenceId: ${occurrenceId}`);
  return { scheduledId: m[1], occurrenceDate: m[2] };
}

export function registerScheduleCommands(program: Command) {
  const schedule = program.command('schedule').description('Scheduled transactions').addHelpCommand(false);

  schedule.action(function () {
    (this as Command).outputHelp();
    process.exit(0);
  });

  schedule
    .command('list')
    .description('List schedules')
    .action(async function () {
      const cmd = this as Command;
      try {
        const { db } = makeDb();
        const rows = await db
          .select()
          .from(scheduledTransactions)
          .where(eq(scheduledTransactions.archived, false))
          .orderBy(asc(scheduledTransactions.name));

        const data = rows.map((r) => ({
          id: r.id,
          name: r.name,
          accountId: r.accountId,
          envelopeId: r.envelopeId,
          amount: Number(r.amount),
          payeeId: r.payeeId,
          payeeName: r.payeeName,
          memo: r.memo,
          startDate: r.startDate,
          endDate: r.endDate,
          rule: JSON.parse(r.ruleJson),
          archived: Boolean(r.archived),
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));

        print(cmd, data.map((s) => `- ${s.name} (${s.id})`).join('\n') || '(none)', data);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  schedule
    .command('create <name>')
    .description('Create a schedule (v1 supports monthly rules)')
    .requiredOption('--account <name>', 'Account name')
    .requiredOption('--amount <major>', 'Amount in major units (outflow negative, e.g. -25 or -25.00)')
    .option('--payee <name>', 'Payee name')
    .option('--memo <text>', 'Memo')
    .option('--envelope <name>', 'Envelope name (required unless --skip-budget)')
    .option('--skip-budget', 'Do not create splits / do not affect envelopes')
    .requiredOption('--freq <daily|weekly|monthly|yearly>', 'Recurrence frequency')
    .option('--interval <n>', 'Recurrence interval (default 1)')
    .option('--weekday <mon|tue|wed|thu|fri|sat|sun>', 'Weekday for weekly rules')
    .option('--month <1-12>', 'Month for yearly rules')
    .option('--month-day <1-31|last>', 'Day-of-month for monthly/yearly rules')
    .requiredOption('--start <YYYY-MM-DD>', 'Start date (date-only)')
    .option('--end <YYYY-MM-DD>', 'End date (date-only, inclusive)')
    .action(async function (name: string) {
      const cmd = this as Command;
      try {
        const opts = cmd.opts();
        const cleanName = requireNonEmpty(name, 'Schedule name is required');

        const { db } = makeDb();
        const accountId = await resolveAccountId(db, String(opts.account));
        const amount = parseMajorToMinor(String(opts.amount));

        const startDate = String(opts.start);
        parseIsoDateOnly(startDate);
        const endDate = opts.end ? String(opts.end) : null;
        if (endDate) {
          parseIsoDateOnly(endDate);
          if (endDate < startDate) throw new Error('--end must be >= --start');
        }

        const rule = ruleFromOpts({
          freq: opts.freq,
          interval: opts.interval,
          weekday: opts.weekday,
          month: opts.month,
          monthDay: opts.monthDay,
        });

        const skipBudget = Boolean(opts.skipBudget);
        let envelopeId: string | null = null;
        if (!skipBudget) {
          if (!opts.envelope) throw new Error('--envelope is required unless --skip-budget');
          envelopeId = await resolveEnvelopeId(db, String(opts.envelope));
        }

        const payeeName = opts.payee ? String(opts.payee) : null;
        const payeeId = payeeName ? await resolveOrCreatePayeeId(db, payeeName) : null;

        const now = nowIsoUtc();
        const row = {
          id: newId('sched'),
          name: cleanName,
          accountId,
          envelopeId,
          amount,
          payeeId,
          payeeName,
          memo: opts.memo ? String(opts.memo) : null,
          ruleJson: JSON.stringify(rule),
          startDate,
          endDate,
          archived: false as const,
          createdAt: now,
          updatedAt: now,
        };

        await db.insert(scheduledTransactions).values(row);

        const out = { ...row, rule };
        print(cmd, `Created schedule: ${out.name}`, out);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  schedule
    .command('due')
    .description('List scheduled occurrences due in a date range (not yet posted)')
    .option('--from <YYYY-MM-DD>', 'Start date (inclusive)')
    .option('--to <YYYY-MM-DD>', 'End date (inclusive)')
    .action(async function () {
      const cmd = this as Command;
      try {
        const opts = cmd.opts();
        const { from, to } = parseRange(opts);

        const { db } = makeDb();
        const schedules = await db
          .select()
          .from(scheduledTransactions)
          .where(eq(scheduledTransactions.archived, false));

        const occurrences: Array<{ occurrenceId: string; scheduledId: string; occurrenceDate: string; name: string; amount: number } & any> = [];

        for (const s of schedules) {
          const rule = JSON.parse(s.ruleJson) as ScheduleRule;

          // Apply endDate clamp (inclusive)
          const clampTo = s.endDate && s.endDate < to ? s.endDate : to;
          if (clampTo < from) continue;

          let dates: string[] = [];
          if (rule.freq === 'daily') {
            dates = generateDailyOccurrences(s.startDate, rule.interval, from, clampTo);
          } else if (rule.freq === 'weekly') {
            dates = generateWeeklyOccurrences(s.startDate, rule.weekdays, rule.interval, from, clampTo);
          } else if (rule.freq === 'monthly') {
            dates = generateMonthlyOccurrences(s.startDate, rule.monthDay, rule.interval, from, clampTo);
          } else if (rule.freq === 'yearly') {
            dates = generateYearlyOccurrences(s.startDate, rule.month, rule.monthDay, rule.interval, from, clampTo);
          }

          if (!dates.length) continue;

          const posted = await db
            .select({ occurrenceDate: scheduledPostings.occurrenceDate })
            .from(scheduledPostings)
            .where(and(eq(scheduledPostings.scheduledId, s.id), inArray(scheduledPostings.occurrenceDate, dates)));
          const postedSet = new Set(posted.map((p) => p.occurrenceDate));

          for (const d of dates) {
            if (postedSet.has(d)) continue;
            occurrences.push({
              occurrenceId: makeOccurrenceId(s.id, d),
              scheduledId: s.id,
              occurrenceDate: d,
              name: s.name,
              amount: Number(s.amount),
              payeeName: s.payeeName,
              payeeId: s.payeeId,
              memo: s.memo,
              accountId: s.accountId,
              envelopeId: s.envelopeId,
              rule,
            });
          }
        }

        occurrences.sort((a, b) => (a.occurrenceDate < b.occurrenceDate ? -1 : a.occurrenceDate > b.occurrenceDate ? 1 : 0));

        print(cmd, occurrences.map((o) => `- ${o.occurrenceDate} ${o.name} ${o.amount}`).join('\n') || '(none)', occurrences);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  schedule
    .command('post <occurrenceId>')
    .description('Post a scheduled occurrence as a real transaction')
    .action(async function (occurrenceId: string) {
      const cmd = this as Command;
      try {
        const { scheduledId, occurrenceDate } = parseOccurrenceId(String(occurrenceId));

        const { db } = makeDb();

        // ensure schedule exists
        const sched = (await db.select().from(scheduledTransactions).where(eq(scheduledTransactions.id, scheduledId)).limit(1))[0];
        if (!sched) throw new Error(`Schedule not found: ${scheduledId}`);
        if (sched.archived) throw new Error('Schedule is archived');

        // not already posted
        const already = await db
          .select()
          .from(scheduledPostings)
          .where(and(eq(scheduledPostings.scheduledId, scheduledId), eq(scheduledPostings.occurrenceDate, occurrenceDate)))
          .limit(1);
        if (already[0]) throw new Error('Occurrence already posted');

        // create tx
        const txId = newId('tx');
        const postedAt = parseDateToIsoUtc(occurrenceDate);
        const txRow = {
          id: txId,
          externalId: null as string | null,
          transferGroupId: null as string | null,
          transferPeerId: null as string | null,
          accountId: sched.accountId,
          postedAt,
          amount: Number(sched.amount),
          payeeId: sched.payeeId,
          payeeName: sched.payeeName,
          memo: sched.memo,
          cleared: 'pending' as const,
          skipBudget: false,
          createdAt: nowIsoUtc(),
        };

        await db.insert(transactions).values(txRow);

        if (sched.envelopeId) {
          await db.insert(transactionSplits).values({
            id: newId('split'),
            transactionId: txId,
            envelopeId: sched.envelopeId,
            amount: Number(sched.amount),
            note: null,
          });
        }

        const postRow = {
          id: newId('schedpost'),
          scheduledId,
          occurrenceDate,
          transactionId: txId,
          createdAt: nowIsoUtc(),
        };
        await db.insert(scheduledPostings).values(postRow);

        print(cmd, `Posted schedule occurrence ${occurrenceDate}`, {
          occurrence: { occurrenceId: makeOccurrenceId(scheduledId, occurrenceDate), scheduledId, occurrenceDate },
          transaction: { id: txId },
        });
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  schedule
    .command('update <schedule>')
    .description('Update a schedule (by id or name); unspecified fields are unchanged')
    .option('--name <name>', 'New schedule name')
    .option('--account <name>', 'Account name or id')
    .option('--amount <major>', 'Amount in major units (outflow negative, e.g. -25 or -25.00)')
    .option('--payee <name>', 'Payee name')
    .option('--memo <text>', 'Memo')
    .option('--envelope <name>', 'Envelope name')
    .option('--skip-budget', 'Unset envelope (no split when posting)')
    .option('--freq <daily|weekly|monthly|yearly>', 'Recurrence frequency')
    .option('--interval <n>', 'Recurrence interval')
    .option('--weekday <mon|tue|wed|thu|fri|sat|sun>', 'Weekday(s) for weekly rules (comma-separated)')
    .option('--month <1-12>', 'Month for yearly rules')
    .option('--month-day <1-31|last>', 'Day-of-month for monthly/yearly rules')
    .option('--start <YYYY-MM-DD>', 'Start date (date-only)')
    .option('--end <YYYY-MM-DD>', 'End date (date-only, inclusive)')
    .action(async function (scheduleValue: string) {
      const cmd = this as Command;
      try {
        const opts = cmd.opts();
        const { db } = makeDb();

        const { resolveScheduleId } = await import('../lib/schedule_update.js');
        const id = await resolveScheduleId(db, String(scheduleValue));
        const cur = (await db.select().from(scheduledTransactions).where(eq(scheduledTransactions.id, id)).limit(1))[0];
        if (!cur) throw new Error(`Schedule not found: ${scheduleValue}`);

        const patch: any = { updatedAt: nowIsoUtc() };

        if (opts.name != null) patch.name = requireNonEmpty(String(opts.name), 'Name is required');
        if (opts.account != null) patch.accountId = await resolveAccountId(db, String(opts.account));
        if (opts.amount != null) {
          patch.amount = parseMajorToMinor(String(opts.amount));
        }

        if (opts.payee != null) {
          const payeeName = requireNonEmpty(String(opts.payee), 'Payee name is required');
          const { resolveOrCreatePayee } = await import('./payee.js');
          const p = await resolveOrCreatePayee(db, payeeName);
          patch.payeeName = p.name;
          patch.payeeId = p.id;
        }
        if (opts.memo !== undefined) patch.memo = opts.memo == null ? null : String(opts.memo);

        if (opts.skipBudget) {
          patch.envelopeId = null;
        } else if (opts.envelope != null) {
          patch.envelopeId = await resolveEnvelopeId(db, String(opts.envelope));
        }

        if (opts.start != null) {
          const startDate = String(opts.start);
          parseIsoDateOnly(startDate);
          patch.startDate = startDate;
        }

        if (opts.end !== undefined) {
          const endDate = opts.end == null ? null : String(opts.end);
          if (endDate) parseIsoDateOnly(endDate);
          patch.endDate = endDate;
        }

        // Rule update: only if any rule-related option provided
        const wantsRule = opts.freq != null || opts.interval != null || opts.weekday != null || opts.month != null || opts.monthDay != null;
        if (wantsRule) {
          const baseRule = JSON.parse(cur.ruleJson);
          const merged = {
            freq: opts.freq ?? baseRule.freq,
            interval: opts.interval ?? baseRule.interval,
            weekday: opts.weekday ?? (baseRule.weekdays ? baseRule.weekdays.join(',') : undefined),
            month: opts.month ?? baseRule.month,
            monthDay: opts.monthDay ?? baseRule.monthDay,
          };
          const rule = ruleFromOpts(merged);
          patch.ruleJson = JSON.stringify(rule);
        }

        // Validate end >= start using patched values
        const newStart = patch.startDate ?? cur.startDate;
        const newEnd = patch.endDate !== undefined ? patch.endDate : cur.endDate;
        if (newEnd && newEnd < newStart) throw new Error('--end must be >= --start');

        await db.update(scheduledTransactions).set(patch).where(eq(scheduledTransactions.id, id));
        const row = (await db.select().from(scheduledTransactions).where(eq(scheduledTransactions.id, id)).limit(1))[0];

        const out = {
          id: row.id,
          name: row.name,
          accountId: row.accountId,
          envelopeId: row.envelopeId,
          amount: Number(row.amount),
          payeeId: row.payeeId,
          payeeName: row.payeeName,
          memo: row.memo,
          startDate: row.startDate,
          endDate: row.endDate,
          rule: JSON.parse(row.ruleJson),
          archived: Boolean(row.archived),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };

        print(cmd, `Updated schedule: ${out.name}`, out);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  schedule
    .command('archive <schedule>')
    .description('Archive a schedule (by id or name)')
    .action(async function (scheduleValue: string) {
      const cmd = this as Command;
      try {
        const { db } = makeDb();
        const { resolveScheduleId } = await import('../lib/schedule_update.js');
        const id = await resolveScheduleId(db, String(scheduleValue));

        await db.update(scheduledTransactions).set({ archived: true, updatedAt: nowIsoUtc() }).where(eq(scheduledTransactions.id, id));
        print(cmd, `Archived schedule: ${id}`, { id });
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });
}
