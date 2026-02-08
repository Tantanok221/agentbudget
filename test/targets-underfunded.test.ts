import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { makeTempDbUrl, parseJsonOut, runCli } from './helpers.js';

async function writeAlloc(obj: any) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentbudget-target-'));
  const p = path.join(dir, 'alloc.json');
  await fs.writeFile(p, JSON.stringify(obj, null, 2), 'utf-8');
  return p;
}

describe('targets + underfunded (TDD)', () => {
  it('monthly target: underfunded = max(0, target - budgetedThisMonth)', async () => {
    const { dbUrl } = await makeTempDbUrl();

    await runCli(['system', 'init', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['envelope', 'create', 'Subscriptions', '--group', 'Bills', '--json'], { TURSO_DATABASE_URL: dbUrl });

    // Set monthly target 10000
    const set = await runCli(['target', 'set', 'Subscriptions', '--type', 'monthly', '--amount', '10000', '--json'], {
      TURSO_DATABASE_URL: dbUrl,
    });
    expect(set.exitCode).toBe(0);

    // Fund TBB and budget 4000 to Subscriptions in Feb
    await runCli(
      ['tx', 'add', '--account', 'Checking', '--amount', '50000', '--date', '2026-02-01', '--envelope', 'To Be Budgeted', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );
    const alloc = await writeAlloc({ allocations: [{ envelope: 'Subscriptions', amount: 4000 }] });
    await runCli(['budget', 'allocate', '2026-02', '--from-json', alloc, '--json'], { TURSO_DATABASE_URL: dbUrl });

    const uf = await runCli(['budget', 'underfunded', '2026-02', '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(uf.exitCode).toBe(0);
    const out = parseJsonOut(uf.stdout);

    const row = out.data.items.find((i: any) => i.envelope.name === 'Subscriptions');
    expect(row.target.type).toBe('monthly');
    expect(row.underfunded).toBe(6000);
  });

  it('needed-for-spending: underfunded tops up availableStart+budgeted to amount', async () => {
    const { dbUrl } = await makeTempDbUrl();

    await runCli(['system', 'init', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['envelope', 'create', 'Groceries', '--group', 'Living', '--json'], { TURSO_DATABASE_URL: dbUrl });

    await runCli(['target', 'set', 'Groceries', '--type', 'needed-for-spending', '--amount', '10000', '--json'], {
      TURSO_DATABASE_URL: dbUrl,
    });

    // January: allocate 8000 to Groceries so Feb availableStart = 8000
    await runCli(
      ['tx', 'add', '--account', 'Checking', '--amount', '50000', '--date', '2026-01-01', '--envelope', 'To Be Budgeted', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );
    const allocJan = await writeAlloc({ allocations: [{ envelope: 'Groceries', amount: 8000 }] });
    await runCli(['budget', 'allocate', '2026-01', '--from-json', allocJan, '--json'], { TURSO_DATABASE_URL: dbUrl });

    // Feb: no budgeting yet => underfunded should be 2000
    const uf = await runCli(['budget', 'underfunded', '2026-02', '--json'], { TURSO_DATABASE_URL: dbUrl });
    const out = parseJsonOut(uf.stdout);
    const row = out.data.items.find((i: any) => i.envelope.name === 'Groceries');
    expect(row.underfunded).toBe(2000);
  });

  it('by-date: evenly spread remaining needed by target month (includes current month)', async () => {
    const { dbUrl } = await makeTempDbUrl();

    await runCli(['system', 'init', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['envelope', 'create', 'Insurance', '--group', 'Bills', '--json'], { TURSO_DATABASE_URL: dbUrl });

    // Target 12000 by 2026-04, start 2026-02. For Feb: months remaining including Feb = 3 (Feb,Mar,Apr) => 4000
    await runCli(
      ['target', 'set', 'Insurance', '--type', 'by-date', '--target-amount', '12000', '--target-month', '2026-04', '--start-month', '2026-02', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );

    const ufFeb = await runCli(['budget', 'underfunded', '2026-02', '--json'], { TURSO_DATABASE_URL: dbUrl });
    const outFeb = parseJsonOut(ufFeb.stdout);
    const rowFeb = outFeb.data.items.find((i: any) => i.envelope.name === 'Insurance');
    expect(rowFeb.underfunded).toBe(4000);

    // If we budget 4000 in Feb, then Mar underfunded should still be 4000 (remaining 8000 over 2 months)
    await runCli(
      ['tx', 'add', '--account', 'Checking', '--amount', '50000', '--date', '2026-02-01', '--envelope', 'To Be Budgeted', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );
    const allocFeb = await writeAlloc({ allocations: [{ envelope: 'Insurance', amount: 4000 }] });
    await runCli(['budget', 'allocate', '2026-02', '--from-json', allocFeb, '--json'], { TURSO_DATABASE_URL: dbUrl });

    const ufMar = await runCli(['budget', 'underfunded', '2026-03', '--json'], { TURSO_DATABASE_URL: dbUrl });
    const outMar = parseJsonOut(ufMar.stdout);
    const rowMar = outMar.data.items.find((i: any) => i.envelope.name === 'Insurance');
    expect(rowMar.underfunded).toBe(4000);
  });
});
