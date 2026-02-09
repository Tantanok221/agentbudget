import { describe, expect, it } from 'vitest';
import { makeTempDbUrl, parseJsonOut, runCli } from './helpers.js';

const ENV = (dbUrl: string) => ({ TURSO_DATABASE_URL: dbUrl });

describe('overview payee spend report (TDD)', () => {
  it('includes topSpendingByPayee (outflows, exclude transfers)', async () => {
    const { dbUrl } = await makeTempDbUrl();

    await runCli(['system', 'init', '--json'], ENV(dbUrl));
    await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], ENV(dbUrl));
    await runCli(['envelope', 'create', 'Groceries', '--group', 'Living', '--json'], ENV(dbUrl));
    await runCli(['envelope', 'create', 'Coffee', '--group', 'Living', '--json'], ENV(dbUrl));

    // Spending
    await runCli(
      ['tx', 'add', '--account', 'Checking', '--amount', '-25', '--date', '2026-03-02', '--envelope', 'Groceries', '--payee', 'Grab', '--json'],
      ENV(dbUrl),
    );
    await runCli(
      ['tx', 'add', '--account', 'Checking', '--amount', '-15', '--date', '2026-03-03', '--envelope', 'Coffee', '--payee', 'Starbucks', '--json'],
      ENV(dbUrl),
    );
    await runCli(
      ['tx', 'add', '--account', 'Checking', '--amount', '-20', '--date', '2026-03-04', '--envelope', 'Groceries', '--payee', 'Grab', '--json'],
      ENV(dbUrl),
    );

    // Transfer should not count
    await runCli(['account', 'create', 'Savings', '--type', 'savings', '--json'], ENV(dbUrl));
    await runCli(
      ['tx', 'transfer', '--from-account', 'Checking', '--to-account', 'Savings', '--amount', '99.99', '--date', '2026-03-05', '--memo', 'move', '--json'],
      ENV(dbUrl),
    );

    const ov = await runCli(['overview', '--month', '2026-03', '--json'], ENV(dbUrl));
    expect(ov.exitCode).toBe(0);

    const out = parseJsonOut(ov.stdout);
    const rows = out.data.reports.topSpendingByPayee;

    const grab = rows.find((r: any) => r.name === 'Grab');
    const starbucks = rows.find((r: any) => r.name === 'Starbucks');

    expect(grab.spent).toBe(4500);
    expect(starbucks.spent).toBe(1500);

    // ensure ordering: Grab first
    expect(rows[0].name).toBe('Grab');
  });
});
