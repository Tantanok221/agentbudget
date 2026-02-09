import { describe, expect, it } from 'vitest';
import { makeTempDbUrl, parseJsonOut, runCli } from './helpers.js';

function env(dbUrl: string) {
  return { TURSO_DATABASE_URL: dbUrl, AGENTBUDGET_TODAY: '2026-03-05' };
}

describe('overview schedules (TDD)', () => {
  it('includes schedule due summary based on local date (AGENTBUDGET_TODAY)', async () => {
    const { dbUrl } = await makeTempDbUrl();

    await runCli(['system', 'init', '--json'], env(dbUrl));
    await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], env(dbUrl));
    await runCli(['envelope', 'create', 'Rent', '--group', 'Bills', '--json'], env(dbUrl));

    // Monthly on 1st; by 2026-03-05 this is overdue (3/1).
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
        '2026-03-01',
        '--json',
      ],
      env(dbUrl),
    );

    const ov = await runCli(['overview', '--month', '2026-03', '--json'], env(dbUrl));
    expect(ov.exitCode).toBe(0);
    const out = parseJsonOut(ov.stdout);

    expect(out.data.schedules.window.from).toBe('2026-03-05');
    expect(out.data.schedules.window.to).toBe('2026-03-12');

    expect(out.data.schedules.counts.overdue).toBe(1);
    expect(out.data.schedules.counts.dueSoon).toBe(0);

    expect(out.data.schedules.topDue[0].date).toBe('2026-03-01');
    expect(out.data.schedules.topDue[0].name).toBe('Rent');
  });
});
