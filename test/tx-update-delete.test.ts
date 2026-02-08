import { describe, expect, it } from 'vitest';
import { makeTempDbUrl, parseJsonOut, runCli } from './helpers.js';

async function setupBase(dbUrl: string) {
  await runCli(['system', 'init', '--json'], { TURSO_DATABASE_URL: dbUrl });
  await runCli(['account', 'create', 'Maybank', '--type', 'checking', '--json'], { TURSO_DATABASE_URL: dbUrl });
  await runCli(['envelope', 'create', 'Groceries', '--group', 'Living', '--json'], { TURSO_DATABASE_URL: dbUrl });
}

describe('tx update/delete (TDD)', () => {
  it('tx update can change memo and splits; tx list reflects changes', async () => {
    const { dbUrl } = await makeTempDbUrl();
    await setupBase(dbUrl);

    const addRes = await runCli(
      ['tx', 'add', '--account', 'Maybank', '--amount', '-2500', '--date', '2026-02-08', '--envelope', 'Groceries', '--memo', 'old', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );
    expect(addRes.exitCode).toBe(0);
    const addOut = parseJsonOut(addRes.stdout);
    const txId = addOut.data.transaction.id;

    const updRes = await runCli(
      [
        'tx',
        'update',
        txId,
        '--memo',
        'new',
        '--splits-json',
        '[{"envelope":"Groceries","amount":-2500,"note":"splitnote"}]',
        '--json',
      ],
      { TURSO_DATABASE_URL: dbUrl },
    );
    expect(updRes.exitCode).toBe(0);
    const updOut = parseJsonOut(updRes.stdout);
    expect(updOut.ok).toBe(true);

    const listRes = await runCli(['tx', 'list', '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(listRes.exitCode).toBe(0);
    const listOut = parseJsonOut(listRes.stdout);
    const row = listOut.data.find((t: any) => t.id === txId);
    expect(row.memo).toBe('new');
    expect(row.splits.length).toBe(1);
    expect(row.splits[0].note).toBe('splitnote');
  });

  it('tx delete removes transaction; tx list no longer includes it', async () => {
    const { dbUrl } = await makeTempDbUrl();
    await setupBase(dbUrl);

    const addRes = await runCli(
      ['tx', 'add', '--account', 'Maybank', '--amount', '-2500', '--date', '2026-02-08', '--envelope', 'Groceries', '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );
    const txId = parseJsonOut(addRes.stdout).data.transaction.id;

    const delRes = await runCli(['tx', 'delete', txId, '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(delRes.exitCode).toBe(0);
    expect(parseJsonOut(delRes.stdout).ok).toBe(true);

    const listRes = await runCli(['tx', 'list', '--json'], { TURSO_DATABASE_URL: dbUrl });
    const listOut = parseJsonOut(listRes.stdout);
    expect(listOut.data.find((t: any) => t.id === txId)).toBeFalsy();
  });
});
