import { describe, expect, it } from 'vitest';
import { makeTempDbUrl, parseJsonOut, runCli } from './helpers.js';

async function setup(dbUrl: string) {
  await runCli(['init', '--local', '--config-dir', '/tmp/ignore', '--json'], { TURSO_DATABASE_URL: dbUrl });
  await runCli(['system', 'init', '--json'], { TURSO_DATABASE_URL: dbUrl });
  await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], { TURSO_DATABASE_URL: dbUrl });
}

describe('reconciliation (TDD)', () => {
  it('reconcile-preview computes cleared balance and delta vs statement balance', async () => {
    const { dbUrl } = await makeTempDbUrl();
    await setup(dbUrl);

    await runCli(
      ['tx', 'add', '--account', 'Checking', '--amount', '100000', '--date', '2026-02-01', '--envelope', 'To Be Budgeted', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );

    const res = await runCli(
      ['account', 'reconcile-preview', 'Checking', '--statement-balance', '120000', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );

    expect(res.exitCode).toBe(0);
    const out = parseJsonOut(res.stdout);
    expect(out.ok).toBe(true);
    expect(out.data.clearedBalance).toBe(100000);
    expect(out.data.statementBalance).toBe(120000);
    expect(out.data.delta).toBe(20000);
  });

  it('reconcile creates an adjustment transaction assigned to TBB and marks cleared tx as reconciled', async () => {
    const { dbUrl } = await makeTempDbUrl();
    await setup(dbUrl);

    // cleared inflow
    await runCli(
      ['tx', 'add', '--account', 'Checking', '--amount', '100000', '--date', '2026-02-01', '--envelope', 'To Be Budgeted', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );

    // Bank says cleared balance is 120000 => need +20000 adjustment
    const rec = await runCli(
      ['account', 'reconcile', 'Checking', '--statement-balance', '120000', '--date', '2026-02-28', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );

    expect(rec.exitCode).toBe(0);
    const recOut = parseJsonOut(rec.stdout);
    expect(recOut.ok).toBe(true);
    expect(recOut.data.adjustment.amount).toBe(20000);

    // list shows an Adjustment tx
    const list = await runCli(['tx', 'list', '--json'], { TURSO_DATABASE_URL: dbUrl });
    const listOut = parseJsonOut(list.stdout);
    const adj = listOut.data.find((t: any) => t.id === recOut.data.adjustment.id);
    expect(adj).toBeTruthy();
    expect(adj.amount).toBe(20000);

    // adjustment split should hit TBB envelope
    expect(adj.splits.some((s: any) => s.envelope === 'To Be Budgeted' && s.amount === 20000)).toBe(true);

    // all other tx should now be reconciled
    const nonAdj = listOut.data.filter((t: any) => t.id !== recOut.data.adjustment.id);
    expect(nonAdj.length).toBeGreaterThan(0);
    expect(nonAdj.every((t: any) => t.cleared === 'reconciled')).toBe(true);
  });
});
