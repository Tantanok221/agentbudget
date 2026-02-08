import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { makeTempDbUrl, parseJsonOut, runCli } from './helpers.js';

async function writeAllocFile(obj: any) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentbudget-overview-'));
  const p = path.join(dir, 'alloc.json');
  await fs.writeFile(p, JSON.stringify(obj, null, 2), 'utf-8');
  return p;
}

describe('overview (TDD)', () => {
  it('shows overspent envelopes, overbudget (TBB negative), and account balances', async () => {
    const { dbUrl } = await makeTempDbUrl();

    await runCli(['system', 'init', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['account', 'create', 'Maybank', '--type', 'checking', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['envelope', 'create', 'Groceries', '--group', 'Living', '--json'], { TURSO_DATABASE_URL: dbUrl });

    // Fund TBB with 100000
    await runCli(
      ['tx', 'add', '--account', 'Maybank', '--amount', '100000', '--date', '2026-02-01', '--envelope', 'To Be Budgeted', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );

    // Overbudget: allocate 120000 -> TBB available should go negative
    const allocFile = await writeAllocFile({ allocations: [{ envelope: 'Groceries', amount: 120000 }] });
    await runCli(['budget', 'allocate', '2026-02', '--from-json', allocFile, '--json'], { TURSO_DATABASE_URL: dbUrl });

    // Overspend groceries by spending 130000
    await runCli(
      ['tx', 'add', '--account', 'Maybank', '--amount', '-130000', '--date', '2026-02-10', '--envelope', 'Groceries', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );

    const res = await runCli(['overview', '--month', '2026-02', '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(res.exitCode).toBe(0);
    const out = parseJsonOut(res.stdout);
    expect(out.ok).toBe(true);

    expect(out.data.month).toBe('2026-02');

    // account balance = 100000 - 130000 = -30000
    const maybank = out.data.accounts.find((a: any) => a.name === 'Maybank');
    expect(maybank.balance).toBe(-30000);

    // overbudget if TBB available < 0
    expect(out.data.flags.overbudget).toBe(true);
    expect(out.data.tbb.available).toBeLessThan(0);

    // overspent envelope
    expect(out.data.flags.overspent).toBe(true);
    expect(out.data.overspentEnvelopes.some((e: any) => e.name === 'Groceries')).toBe(true);
  });
});
