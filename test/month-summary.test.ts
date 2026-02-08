import { describe, expect, it } from 'vitest';
import { makeTempDbUrl, parseJsonOut, runCli } from './helpers.js';

function ymd(date: string) {
  return date;
}

describe('month summary (TDD)', () => {
  it('returns friendly error when TBB is missing', async () => {
    const { dbUrl } = await makeTempDbUrl();

    const res = await runCli(['month', 'summary', '2026-02', '--json'], {
      TURSO_DATABASE_URL: dbUrl,
    });

    expect(res.exitCode).not.toBe(0);
    const out = parseJsonOut(res.stderr || res.stdout);

    expect(out.ok).toBe(false);
    expect(out.error.code).toBe('MISSING_TBB');
    expect(out.error.message).toMatch(/system init/i);
  });

  it('includes rollover from previous month activity in availableStart/available', async () => {
    const { dbUrl } = await makeTempDbUrl();

    await runCli(['system', 'init', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['account', 'create', 'Maybank', '--type', 'checking', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['envelope', 'create', 'Groceries', '--group', 'Living', '--json'], { TURSO_DATABASE_URL: dbUrl });

    // January spending
    await runCli(
      ['tx', 'add', '--account', 'Maybank', '--amount', '-2500', '--date', ymd('2026-01-15'), '--envelope', 'Groceries', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );

    const res = await runCli(['month', 'summary', '2026-02', '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(res.exitCode).toBe(0);
    const out = parseJsonOut(res.stdout);
    expect(out.ok).toBe(true);

    const groceries = out.data.envelopes.find((e: any) => e.name === 'Groceries');
    expect(groceries).toBeTruthy();
    expect(groceries.availableStart).toBe(-2500);
    expect(groceries.budgeted).toBe(0);
    expect(groceries.activity).toBe(0);
    expect(groceries.available).toBe(-2500);
  });
});
