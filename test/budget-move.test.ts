import { describe, expect, it } from 'vitest';
import { makeTempDbUrl, parseJsonOut, runCli } from './helpers.js';

describe('budget move (TDD)', () => {
  it('moves available between envelopes within the month; does not affect activity', async () => {
    const { dbUrl } = await makeTempDbUrl();

    await runCli(['system', 'init', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['account', 'create', 'Maybank', '--type', 'checking', '--json'], { TURSO_DATABASE_URL: dbUrl });

    await runCli(['envelope', 'create', 'Groceries', '--group', 'Living', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['envelope', 'create', 'Fun', '--group', 'Lifestyle', '--json'], { TURSO_DATABASE_URL: dbUrl });

    // fund TBB and allocate to Groceries
    await runCli(
      ['tx', 'add', '--account', 'Maybank', '--amount', '200000', '--date', '2026-02-01', '--envelope', 'To Be Budgeted', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );

    // allocate 80000 to Groceries
    // write temp allocations file
    const fs = await import('node:fs/promises');
    const os = await import('node:os');
    const path = await import('node:path');
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentbudget-alloc-'));
    const allocFile = path.join(dir, 'alloc.json');
    await fs.writeFile(allocFile, JSON.stringify({ allocations: [{ envelope: 'Groceries', amount: 80000 }] }, null, 2), 'utf-8');

    await runCli(['budget', 'allocate', '2026-02', '--from-json', allocFile, '--json'], { TURSO_DATABASE_URL: dbUrl });

    // move 10000 from Groceries to Fun
    const moveRes = await runCli(
      ['budget', 'move', '2026-02', '--from', 'Groceries', '--to', 'Fun', '--amount', '10000', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );
    expect(moveRes.exitCode).toBe(0);
    const moveOut = parseJsonOut(moveRes.stdout);
    expect(moveOut.ok).toBe(true);

    const sumRes = await runCli(['month', 'summary', '2026-02', '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(sumRes.exitCode).toBe(0);
    const out = parseJsonOut(sumRes.stdout);

    const groceries = out.data.envelopes.find((e: any) => e.name === 'Groceries');
    const fun = out.data.envelopes.find((e: any) => e.name === 'Fun');

    expect(groceries.activity).toBe(0);
    expect(fun.activity).toBe(0);

    expect(groceries.movedOut).toBe(10000);
    expect(fun.movedIn).toBe(10000);

    expect(groceries.available).toBe(70000);
    expect(fun.available).toBe(10000);
  });
});
