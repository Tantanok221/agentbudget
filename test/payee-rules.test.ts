import { describe, expect, it } from 'vitest';
import { makeTempDbUrl, parseJsonOut, runCli } from './helpers.js';

const ENV = (dbUrl: string) => ({ TURSO_DATABASE_URL: dbUrl });

describe('payee rules (TDD)', () => {
  it('payee rule contains normalizes imported payee text to canonical payeeId + payeeName', async () => {
    const { dbUrl } = await makeTempDbUrl();

    await runCli(['system', 'init', '--json'], ENV(dbUrl));
    await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], ENV(dbUrl));
    await runCli(['envelope', 'create', 'Groceries', '--group', 'Living', '--json'], ENV(dbUrl));

    const grab = parseJsonOut((await runCli(['payee', 'create', 'Grab', '--json'], ENV(dbUrl))).stdout).data;

    // Add a rule that maps messy strings to canonical Grab
    const r = await runCli(
      ['payee', 'rule', 'add', '--match', 'contains', '--pattern', 'GRAB*FOOD', '--to', 'Grab', '--json'],
      ENV(dbUrl),
    );
    expect(r.exitCode).toBe(0);

    // Add a tx with messy payee string
    const add = await runCli(
      ['tx', 'add', '--account', 'Checking', '--amount', '-2500', '--date', '2026-02-02', '--envelope', 'Groceries', '--payee', 'GRAB*FOOD 1234', '--json'],
      ENV(dbUrl),
    );
    expect(add.exitCode).toBe(0);

    const txList = await runCli(['tx', 'list', '--json'], ENV(dbUrl));
    const tx = parseJsonOut(txList.stdout).data[0];

    expect(tx.payeeId).toBe(grab.id);
    expect(tx.payeeName).toBe('Grab');

    // Ensure no new payee was created
    const payees = parseJsonOut((await runCli(['payee', 'list', '--json'], ENV(dbUrl))).stdout).data;
    expect(payees.length).toBe(1);
    expect(payees[0].name).toBe('Grab');
  });
});
