import { describe, expect, it } from 'vitest';
import { makeTempDbUrl, parseJsonOut, runCli } from './helpers.js';

const ENV = (dbUrl: string) => ({ TURSO_DATABASE_URL: dbUrl });

describe('schedule frequencies (TDD)', () => {
  it('daily: due generates each day in range (respects start)', async () => {
    const { dbUrl } = await makeTempDbUrl();
    await runCli(['system', 'init', '--json'], ENV(dbUrl));
    await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], ENV(dbUrl));
    await runCli(['envelope', 'create', 'Coffee', '--group', 'Living', '--json'], ENV(dbUrl));

    const c = await runCli(
      [
        'schedule',
        'create',
        'Coffee',
        '--account',
        'Checking',
        '--amount',
        '-15',
        '--payee',
        'Starbucks',
        '--envelope',
        'Coffee',
        '--freq',
        'daily',
        '--interval',
        '1',
        '--start',
        '2026-03-02',
        '--json',
      ],
      ENV(dbUrl),
    );
    expect(c.exitCode).toBe(0);

    const due = await runCli(['schedule', 'due', '--from', '2026-03-01', '--to', '2026-03-03', '--json'], ENV(dbUrl));
    expect(due.exitCode).toBe(0);
    const out = parseJsonOut(due.stdout);
    expect(out.data.map((d: any) => d.occurrenceDate)).toEqual(['2026-03-02', '2026-03-03']);
  });

  it('weekly: due generates on a specific weekday (interval 1)', async () => {
    const { dbUrl } = await makeTempDbUrl();
    await runCli(['system', 'init', '--json'], ENV(dbUrl));
    await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], ENV(dbUrl));
    await runCli(['envelope', 'create', 'Gym', '--group', 'Health', '--json'], ENV(dbUrl));

    // 2026-03-02 is Monday. We want every week on Monday.
    const c = await runCli(
      [
        'schedule',
        'create',
        'Gym',
        '--account',
        'Checking',
        '--amount',
        '-50',
        '--payee',
        'Gym',
        '--envelope',
        'Gym',
        '--freq',
        'weekly',
        '--interval',
        '1',
        '--weekday',
        'mon',
        '--start',
        '2026-03-02',
        '--json',
      ],
      ENV(dbUrl),
    );
    expect(c.exitCode).toBe(0);

    const due = await runCli(['schedule', 'due', '--from', '2026-03-01', '--to', '2026-03-15', '--json'], ENV(dbUrl));
    expect(due.exitCode).toBe(0);
    const out = parseJsonOut(due.stdout);
    expect(out.data.map((d: any) => d.occurrenceDate)).toEqual(['2026-03-02', '2026-03-09']);
  });

  it('yearly: due generates on a month+day (supports last day)', async () => {
    const { dbUrl } = await makeTempDbUrl();
    await runCli(['system', 'init', '--json'], ENV(dbUrl));
    await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], ENV(dbUrl));
    await runCli(['envelope', 'create', 'Insurance', '--group', 'Bills', '--json'], ENV(dbUrl));

    const c = await runCli(
      [
        'schedule',
        'create',
        'Insurance',
        '--account',
        'Checking',
        '--amount',
        '-1200',
        '--payee',
        'Insurer',
        '--envelope',
        'Insurance',
        '--freq',
        'yearly',
        '--interval',
        '1',
        '--month',
        '2',
        '--month-day',
        'last',
        '--start',
        '2026-02-01',
        '--json',
      ],
      ENV(dbUrl),
    );
    expect(c.exitCode).toBe(0);

    const due = await runCli(['schedule', 'due', '--from', '2027-02-01', '--to', '2027-02-28', '--json'], ENV(dbUrl));
    expect(due.exitCode).toBe(0);
    const out = parseJsonOut(due.stdout);

    // 2027-02 has 28 days
    expect(out.data.map((d: any) => d.occurrenceDate)).toEqual(['2027-02-28']);
  });
});
