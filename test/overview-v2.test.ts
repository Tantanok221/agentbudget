import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { makeTempDbUrl, parseJsonOut, runCli } from './helpers.js';

async function writeAlloc(obj: any) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentbudget-ov2-'));
  const p = path.join(dir, 'alloc.json');
  await fs.writeFile(p, JSON.stringify(obj, null, 2), 'utf-8');
  return p;
}

describe('overview v2 (TDD)', () => {
  it('includes cashflow, netWorth split, toBeBudgeted naming, underfunded, and top spending by envelope', async () => {
    const { dbUrl } = await makeTempDbUrl();

    await runCli(['system', 'init', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['account', 'create', 'Brokerage', '--type', 'tracking', '--json'], { TURSO_DATABASE_URL: dbUrl });

    await runCli(['envelope', 'create', 'Groceries', '--group', 'Living', '--json'], { TURSO_DATABASE_URL: dbUrl });

    // Targets + funding
    await runCli(['target', 'set', 'Groceries', '--type', 'monthly', '--amount', '100', '--json'], { TURSO_DATABASE_URL: dbUrl });

    // Income + spend
    await runCli(
      ['tx', 'add', '--account', 'Checking', '--amount', '500', '--date', '2026-02-01', '--envelope', 'To Be Budgeted', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );
    await runCli(
      ['tx', 'add', '--account', 'Checking', '--amount', '-25', '--date', '2026-02-02', '--envelope', 'Groceries', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );

    // tracking balance
    await runCli(
      ['tx', 'add', '--account', 'Brokerage', '--amount', '1000', '--date', '2026-02-03', '--skip-budget', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );

    // budgeted 4000 => underfunded 6000
    const alloc = await writeAlloc({ allocations: [{ envelope: 'Groceries', amount: 4000 }] });
    await runCli(['budget', 'allocate', '2026-02', '--from-json', alloc, '--json'], { TURSO_DATABASE_URL: dbUrl });

    const res = await runCli(['overview', '--month', '2026-02', '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(res.exitCode).toBe(0);
    const out = parseJsonOut(res.stdout);
    expect(out.ok).toBe(true);

    // naming
    expect(out.data.budget.toBeBudgeted).toBeTruthy();
    expect(out.data.budget.tbb).toBeUndefined();

    // cashflow: income 50000, expense 2500, net 47500 (exclude transfers; none here)
    expect(out.data.reports.cashflow.income).toBe(50000);
    expect(out.data.reports.cashflow.expense).toBe(2500);
    expect(out.data.reports.cashflow.net).toBe(47500);

    // net worth split
    expect(out.data.netWorth.liquid).toBe(47500);
    expect(out.data.netWorth.tracking).toBe(100000);
    expect(out.data.netWorth.total).toBe(147500);

    // underfunded
    expect(out.data.goals.underfundedTotal).toBe(6000);
    expect(out.data.goals.topUnderfunded[0].name).toBe('Groceries');

    // top spending by envelope (positive spent)
    expect(out.data.reports.topSpending[0].name).toBe('Groceries');
    expect(out.data.reports.topSpending[0].spent).toBe(2500);
  });
});
