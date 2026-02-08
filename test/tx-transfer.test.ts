import { describe, expect, it } from 'vitest';
import { makeTempDbUrl, parseJsonOut, runCli } from './helpers.js';

describe('tx transfer (TDD)', () => {
  it('creates two linked transactions and does not affect envelopes', async () => {
    const { dbUrl } = await makeTempDbUrl();

    await runCli(['system', 'init', '--json'], { TURSO_DATABASE_URL: dbUrl });

    await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['account', 'create', 'Savings', '--type', 'savings', '--json'], { TURSO_DATABASE_URL: dbUrl });

    await runCli(['envelope', 'create', 'Groceries', '--group', 'Living', '--json'], { TURSO_DATABASE_URL: dbUrl });

    // Fund checking (assigned to TBB just to keep budget consistent)
    await runCli(
      ['tx', 'add', '--account', 'Checking', '--amount', '100000', '--date', '2026-02-01', '--envelope', 'To Be Budgeted', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );

    const res = await runCli(
      [
        'tx',
        'transfer',
        '--from-account',
        'Checking',
        '--to-account',
        'Savings',
        '--amount',
        '25000',
        '--date',
        '2026-02-05',
        '--memo',
        'move money',
        '--json',
      ],
      { TURSO_DATABASE_URL: dbUrl },
    );

    expect(res.exitCode).toBe(0);
    const out = parseJsonOut(res.stdout);
    expect(out.ok).toBe(true);
    expect(out.data.from.amount).toBe(-25000);
    expect(out.data.to.amount).toBe(25000);
    expect(out.data.from.transferGroupId).toBeTruthy();
    expect(out.data.from.transferGroupId).toBe(out.data.to.transferGroupId);

    // Account balances reflect transfer
    const ov = await runCli(['overview', '--month', '2026-02', '--json'], { TURSO_DATABASE_URL: dbUrl });
    const ovOut = parseJsonOut(ov.stdout);

    const checking = ovOut.data.accounts.list.find((a: any) => a.name === 'Checking');
    const savings = ovOut.data.accounts.list.find((a: any) => a.name === 'Savings');
    expect(checking.balance).toBe(75000);
    expect(savings.balance).toBe(25000);

    // Envelope is unaffected by transfer (no new activity)
    const ms = await runCli(['month', 'summary', '2026-02', '--json'], { TURSO_DATABASE_URL: dbUrl });
    const msOut = parseJsonOut(ms.stdout);
    const groceries = msOut.data.envelopes.find((e: any) => e.name === 'Groceries');
    expect(groceries.activity).toBe(0);
  });
});
