import { describe, expect, it } from 'vitest';
import { makeTempDbUrl, parseJsonOut, runCli } from './helpers.js';

function iso(d: string) {
  // keep as YYYY-MM-DD for schedule inputs
  return d;
}

describe('schedule (TDD)', () => {
  it('create + list works (monthly on day 1)', async () => {
    const { dbUrl } = await makeTempDbUrl();

    await runCli(['system', 'init', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['envelope', 'create', 'Rent', '--group', 'Bills', '--json'], { TURSO_DATABASE_URL: dbUrl });

    const c = await runCli(
      [
        'schedule',
        'create',
        'Rent',
        '--account',
        'Checking',
        '--amount',
        '-2000',
        '--payee',
        'Landlord',
        '--envelope',
        'Rent',
        '--freq',
        'monthly',
        '--interval',
        '1',
        '--month-day',
        '1',
        '--start',
        iso('2026-03-01'),
        '--json',
      ],
      { TURSO_DATABASE_URL: dbUrl },
    );
    expect(c.exitCode).toBe(0);
    const outC = parseJsonOut(c.stdout);
    expect(outC.ok).toBe(true);
    expect(outC.data.name).toBe('Rent');
    expect(outC.data.rule.freq).toBe('monthly');

    const l = await runCli(['schedule', 'list', '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(l.exitCode).toBe(0);
    const outL = parseJsonOut(l.stdout);
    expect(outL.data.length).toBe(1);
    expect(outL.data[0].name).toBe('Rent');
  });

  it('due lists occurrences in range; post converts an occurrence into a real tx and marks it posted', async () => {
    const { dbUrl } = await makeTempDbUrl();

    await runCli(['system', 'init', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], { TURSO_DATABASE_URL: dbUrl });
    await runCli(['envelope', 'create', 'Rent', '--group', 'Bills', '--json'], { TURSO_DATABASE_URL: dbUrl });

    await runCli(
      [
        'schedule',
        'create',
        'Rent',
        '--account',
        'Checking',
        '--amount',
        '-2000',
        '--payee',
        'Landlord',
        '--envelope',
        'Rent',
        '--freq',
        'monthly',
        '--interval',
        '1',
        '--month-day',
        '1',
        '--start',
        iso('2026-03-01'),
        '--json',
      ],
      { TURSO_DATABASE_URL: dbUrl },
    );

    const due = await runCli(
      ['schedule', 'due', '--from', iso('2026-03-01'), '--to', iso('2026-03-31'), '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );
    expect(due.exitCode).toBe(0);
    const outD = parseJsonOut(due.stdout);
    expect(outD.data.length).toBe(1);
    expect(outD.data[0].occurrenceDate).toBe('2026-03-01');

    const occId = outD.data[0].occurrenceId;

    const post = await runCli(['schedule', 'post', occId, '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(post.exitCode).toBe(0);
    const outP = parseJsonOut(post.stdout);
    expect(outP.data.transaction.id).toMatch(/^tx_/);
    expect(outP.data.occurrence.occurrenceDate).toBe('2026-03-01');

    // tx should have payeeId populated
    const txList = await runCli(['tx', 'list', '--json'], { TURSO_DATABASE_URL: dbUrl });
    const tx = parseJsonOut(txList.stdout).data[0];
    expect(tx.payeeName).toBe('Landlord');
    expect(tx.payeeId).toMatch(/^payee_/);

    // now due should be empty for same range
    const due2 = await runCli(
      ['schedule', 'due', '--from', iso('2026-03-01'), '--to', iso('2026-03-31'), '--json'],
      { TURSO_DATABASE_URL: dbUrl },
    );
    const outD2 = parseJsonOut(due2.stdout);
    expect(outD2.data.length).toBe(0);
  });
});
