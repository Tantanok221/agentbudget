import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { makeTempDbUrl, parseJsonOut, runCli } from './helpers.js';

async function writeTempJson(obj: any) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentbudget-json-'));
  const p = path.join(dir, 'alloc.json');
  await fs.writeFile(p, JSON.stringify(obj, null, 2), 'utf-8');
  return p;
}

describe('budget allocate (TDD)', () => {
  it('allocating decreases TBB budgeted and increases envelope budgeted; month summary reflects it', async () => {
    const { dbUrl } = await makeTempDbUrl();

    await runCli(['system', 'init', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['account', 'create', 'Maybank', '--type', 'checking', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['envelope', 'create', 'Groceries', '--group', 'Living', '--json'], { TURSO_DATABASE_URL: dbUrl });

    // Inflow must be assigned to TBB explicitly
    await runCli(
      ['tx', 'add', '--account', 'Maybank', '--amount', '200000', '--date', '2026-02-01', '--envelope', 'To Be Budgeted', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );

    const allocPath = await writeTempJson({
      allocations: [{ envelope: 'Groceries', amount: 80000 }],
      note: 'paycheck',
    });

    const allocRes = await runCli(['budget', 'allocate', '2026-02', '--from-json', allocPath, '--json'], {
      TURSO_DATABASE_URL: dbUrl,
    });

    expect(allocRes.exitCode).toBe(0);
    const allocOut = parseJsonOut(allocRes.stdout);
    expect(allocOut.ok).toBe(true);

    const sumRes = await runCli(['month', 'summary', '2026-02', '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(sumRes.exitCode).toBe(0);
    const out = parseJsonOut(sumRes.stdout);

    expect(out.ok).toBe(true);

    // TBB: activity +200000, budgeted -80000 => available 120000
    expect(out.data.tbb.activity).toBe(200000);
    expect(out.data.tbb.budgeted).toBe(-80000);
    expect(out.data.tbb.available).toBe(120000);

    const groceries = out.data.envelopes.find((e: any) => e.name === 'Groceries');
    expect(groceries.budgeted).toBe(80000);
    expect(groceries.activity).toBe(0);
    expect(groceries.available).toBe(80000);
  });
});
