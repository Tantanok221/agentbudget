import { describe, expect, it } from 'vitest';
import { makeTempDbUrl, parseJsonOut, runCli } from './helpers.js';

describe('tx delete (transfer-aware) (TDD)', () => {
  it('deleting one side of a transfer deletes both linked transactions', async () => {
    const { dbUrl } = await makeTempDbUrl();

    await runCli(['system', 'init', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['account', 'create', 'Savings', '--type', 'savings', '--json'], { TURSO_DATABASE_URL: dbUrl });

    const xfer = await runCli(
      [
        'tx',
        'transfer',
        '--from-account',
        'Checking',
        '--to-account',
        'Savings',
        '--amount',
        '25000',
        '--date',
        '2026-02-05',
        '--json',
      ],
      { TURSO_DATABASE_URL: dbUrl },
    );

    const xferOut = parseJsonOut(xfer.stdout);
    const fromId = xferOut.data.from.id;
    const toId = xferOut.data.to.id;

    const del = await runCli(['tx', 'delete', fromId, '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(del.exitCode).toBe(0);
    const delOut = parseJsonOut(del.stdout);
    expect(delOut.ok).toBe(true);
    expect(delOut.data.deletedIds.sort()).toEqual([fromId, toId].sort());

    const list = await runCli(['tx', 'list', '--json'], { TURSO_DATABASE_URL: dbUrl });
    const listOut = parseJsonOut(list.stdout);
    expect(listOut.data.find((t: any) => t.id === fromId)).toBeFalsy();
    expect(listOut.data.find((t: any) => t.id === toId)).toBeFalsy();
  });
});
