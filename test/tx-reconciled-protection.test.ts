import { describe, expect, it } from 'vitest';
import { makeTempDbUrl, parseJsonOut, runCli } from './helpers.js';

describe('reconciled tx protections (TDD)', () => {
  it('blocks tx update/delete for reconciled transactions unless --force is provided', async () => {
    const { dbUrl } = await makeTempDbUrl();

    await runCli(['system', 'init', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['envelope', 'create', 'Groceries', '--group', 'Living', '--json'], { TURSO_DATABASE_URL: dbUrl });

    // add and clear tx
    const add = await runCli(
      ['tx', 'add', '--account', 'Checking', '--amount', '-25', '--date', '2026-02-02', '--envelope', 'Groceries', '--memo', 'old', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );
    const txId = parseJsonOut(add.stdout).data.transaction.id;

    // reconcile account (marks cleared tx as reconciled)
    await runCli(
      ['account', 'reconcile', 'Checking', '--statement-balance', '-25', '--date', '2026-02-28', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );

    const upd = await runCli(['tx', 'update', txId, '--memo', 'new', '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(upd.exitCode).not.toBe(0);

    const del = await runCli(['tx', 'delete', txId, '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(del.exitCode).not.toBe(0);

    const updForce = await runCli(['tx', 'update', txId, '--memo', 'new', '--force', '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(updForce.exitCode).toBe(0);

    const delForce = await runCli(['tx', 'delete', txId, '--force', '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(delForce.exitCode).toBe(0);
    expect(parseJsonOut(delForce.stdout).ok).toBe(true);
  });
});
