import { describe, expect, it } from 'vitest';
import { makeTempDbUrl, parseJsonOut, runCli } from './helpers.js';

const ENV = (dbUrl: string) => ({ TURSO_DATABASE_URL: dbUrl });

describe('schedule multi-weekday + end date (TDD)', () => {
  it('weekly supports multiple weekdays via comma list', async () => {
    const { dbUrl } = await makeTempDbUrl();
    await runCli(['system', 'init', '--json'], ENV(dbUrl));
    await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], ENV(dbUrl));
    await runCli(['envelope', 'create', 'Chores', '--group', 'Home', '--json'], ENV(dbUrl));

    // 2026-03-02 is Monday.
    const c = await runCli(
      [
        'schedule',
        'create',
        'Chores',
        '--account',
        'Checking',
        '--amount',
        '-100',
        '--payee',
        'Self',
        '--envelope',
        'Chores',
        '--freq',
        'weekly',
        '--interval',
        '1',
        '--weekday',
        'mon,thu',
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

    // Mon: 3/2, 3/9 ; Thu: 3/5, 3/12
    expect(out.data.map((d: any) => d.occurrenceDate)).toEqual(['2026-03-02', '2026-03-05', '2026-03-09', '2026-03-12']);
  });

  it('end date clamps due occurrences (applies to any freq)', async () => {
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
        '-1500',
        '--payee',
        'Cafe',
        '--envelope',
        'Coffee',
        '--freq',
        'daily',
        '--interval',
        '1',
        '--start',
        '2026-03-01',
        '--end',
        '2026-03-03',
        '--json',
      ],
      ENV(dbUrl),
    );
    expect(c.exitCode).toBe(0);

    const due = await runCli(['schedule', 'due', '--from', '2026-03-01', '--to', '2026-03-10', '--json'], ENV(dbUrl));
    expect(due.exitCode).toBe(0);
    const out = parseJsonOut(due.stdout);
    expect(out.data.map((d: any) => d.occurrenceDate)).toEqual(['2026-03-01', '2026-03-02', '2026-03-03']);
  });
});
