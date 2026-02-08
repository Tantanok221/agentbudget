import { describe, expect, it } from 'vitest';
import { makeTempDbUrl, parseJsonOut, runCli } from './helpers.js';

describe('account detail (TDD)', () => {
  it('returns balances, counts, and recent transactions; can compute reconcile delta with statement balance', async () => {
    const { dbUrl } = await makeTempDbUrl();

    await runCli(['system', 'init', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['envelope', 'create', 'Groceries', '--group', 'Living', '--json'], { TURSO_DATABASE_URL: dbUrl });

    await runCli(
      ['tx', 'add', '--account', 'Checking', '--amount', '100000', '--date', '2026-02-01', '--envelope', 'To Be Budgeted', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );

    await runCli(
      ['tx', 'add', '--account', 'Checking', '--amount', '-2500', '--date', '2026-02-02', '--envelope', 'Groceries', '--memo', 'spend', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );

    const res = await runCli(
      ['account', 'detail', 'Checking', '--statement-balance', '120000', '--limit', '5', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );

    expect(res.exitCode).toBe(0);
    const out = parseJsonOut(res.stdout);
    expect(out.ok).toBe(true);

    expect(out.data.account.name).toBe('Checking');

    // balance = 100000 - 2500
    expect(out.data.balances.balance).toBe(97500);
    expect(out.data.balances.clearedBalance).toBe(97500);

    expect(out.data.reconcile.statementBalance).toBe(120000);
    expect(out.data.reconcile.delta).toBe(22500);

    expect(out.data.recent.length).toBeLessThanOrEqual(5);
    expect(out.data.recent[0].postedAt >= out.data.recent[1].postedAt).toBe(true);
  });
});
