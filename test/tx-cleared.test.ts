import { describe, expect, it } from 'vitest';
import { makeTempDbUrl, parseJsonOut, runCli } from './helpers.js';

describe('tx cleared/pending workflow (TDD)', () => {
  it('tx unclear marks transaction as pending; tx clear marks it as cleared', async () => {
    const { dbUrl } = await makeTempDbUrl();

    await runCli(['system', 'init', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['envelope', 'create', 'Groceries', '--group', 'Living', '--json'], { TURSO_DATABASE_URL: dbUrl });

    const add = await runCli(
      ['tx', 'add', '--account', 'Checking', '--amount', '-2500', '--date', '2026-02-02', '--envelope', 'Groceries', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );
    const txId = parseJsonOut(add.stdout).data.transaction.id;

    const un = await runCli(['tx', 'unclear', txId, '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(un.exitCode).toBe(0);
    expect(parseJsonOut(un.stdout).data.cleared).toBe('pending');

    const cl = await runCli(['tx', 'clear', txId, '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(cl.exitCode).toBe(0);
    expect(parseJsonOut(cl.stdout).data.cleared).toBe('cleared');

    const list = await runCli(['tx', 'list', '--json'], { TURSO_DATABASE_URL: dbUrl });
    const row = parseJsonOut(list.stdout).data.find((t: any) => t.id === txId);
    expect(row.cleared).toBe('cleared');
  });
});
