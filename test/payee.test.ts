import { describe, expect, it } from 'vitest';
import { makeTempDbUrl, parseJsonOut, runCli } from './helpers.js';

describe('payees (TDD)', () => {
  it('payee create/list works', async () => {
    const { dbUrl } = await makeTempDbUrl();

    const c = await runCli(['payee', 'create', 'Grab', '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(c.exitCode).toBe(0);
    const outC = parseJsonOut(c.stdout);
    expect(outC.ok).toBe(true);
    expect(outC.data.name).toBe('Grab');

    const l = await runCli(['payee', 'list', '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(l.exitCode).toBe(0);
    const outL = parseJsonOut(l.stdout);
    expect(outL.data.some((p: any) => p.name === 'Grab')).toBe(true);
  });

  it('payee rename changes the canonical name', async () => {
    const { dbUrl } = await makeTempDbUrl();

    await runCli(['payee', 'create', 'GrabFood', '--json'], { TURSO_DATABASE_URL: dbUrl });
    const r = await runCli(['payee', 'rename', 'GrabFood', 'Grab', '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(r.exitCode).toBe(0);

    const l = await runCli(['payee', 'list', '--json'], { TURSO_DATABASE_URL: dbUrl });
    const outL = parseJsonOut(l.stdout);
    expect(outL.data.some((p: any) => p.name === 'Grab')).toBe(true);
    expect(outL.data.some((p: any) => p.name === 'GrabFood')).toBe(false);
  });

  it('payee merge updates transactions payeeId and deletes the source payee', async () => {
    const { dbUrl } = await makeTempDbUrl();

    await runCli(['system', 'init', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['envelope', 'create', 'Groceries', '--group', 'Living', '--json'], { TURSO_DATABASE_URL: dbUrl });

    const p1 = parseJsonOut((await runCli(['payee', 'create', 'Grab', '--json'], { TURSO_DATABASE_URL: dbUrl })).stdout).data;
    const p2 = parseJsonOut((await runCli(['payee', 'create', 'GRAB*FOOD', '--json'], { TURSO_DATABASE_URL: dbUrl })).stdout).data;

    // Create a tx using the source payee
    const add = await runCli(
      ['tx', 'add', '--account', 'Checking', '--amount', '-2500', '--date', '2026-02-02', '--envelope', 'Groceries', '--payee', 'GRAB*FOOD', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );
    expect(add.exitCode).toBe(0);
    const txId = parseJsonOut(add.stdout).data.transaction.id;

    const m = await runCli(['payee', 'merge', p2.id, '--into', p1.id, '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(m.exitCode).toBe(0);

    // tx should now reference target payeeId
    const listTx = await runCli(['tx', 'list', '--json'], { TURSO_DATABASE_URL: dbUrl });
    const txRow = parseJsonOut(listTx.stdout).data.find((t: any) => t.id === txId);
    expect(txRow.payeeId).toBe(p1.id);

    // source payee should be gone
    const l = await runCli(['payee', 'list', '--json'], { TURSO_DATABASE_URL: dbUrl });
    const outL = parseJsonOut(l.stdout);
    expect(outL.data.some((p: any) => p.id === p2.id)).toBe(false);
  });
});
