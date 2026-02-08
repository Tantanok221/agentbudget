import { describe, expect, it } from 'vitest';
import { makeTempDbUrl, parseJsonOut, runCli } from './helpers.js';

const ENV = (dbUrl: string) => ({ TURSO_DATABASE_URL: dbUrl });

describe('schedule update + archive (TDD)', () => {
  it('schedule update can change rule + end date', async () => {
    const { dbUrl } = await makeTempDbUrl();
    await runCli(['system', 'init', '--json'], ENV(dbUrl));
    await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], ENV(dbUrl));
    await runCli(['envelope', 'create', 'Coffee', '--group', 'Living', '--json'], ENV(dbUrl));

    const created = await runCli(
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
        '--json',
      ],
      ENV(dbUrl),
    );
    const schedId = parseJsonOut(created.stdout).data.id;

    // Update to weekly mon,thu and add end date
    const upd = await runCli(
      [
        'schedule',
        'update',
        schedId,
        '--freq',
        'weekly',
        '--interval',
        '1',
        '--weekday',
        'mon,thu',
        '--end',
        '2026-03-10',
        '--json',
      ],
      ENV(dbUrl),
    );
    expect(upd.exitCode).toBe(0);

    const list = await runCli(['schedule', 'list', '--json'], ENV(dbUrl));
    const row = parseJsonOut(list.stdout).data.find((s: any) => s.id === schedId);
    expect(row.rule.freq).toBe('weekly');
    expect(row.rule.weekdays).toEqual(['mon', 'thu']);
    expect(row.endDate).toBe('2026-03-10');

    const due = await runCli(['schedule', 'due', '--from', '2026-03-01', '--to', '2026-03-31', '--json'], ENV(dbUrl));
    const dates = parseJsonOut(due.stdout).data.map((d: any) => d.occurrenceDate);
    // Mondays: 3/2, 3/9 ; Thursdays: 3/5 (3/12 is beyond end date)
    expect(dates).toEqual(['2026-03-02', '2026-03-05', '2026-03-09']);
  });

  it('schedule archive hides from list and due', async () => {
    const { dbUrl } = await makeTempDbUrl();
    await runCli(['system', 'init', '--json'], ENV(dbUrl));
    await runCli(['account', 'create', 'Checking', '--type', 'checking', '--json'], ENV(dbUrl));
    await runCli(['envelope', 'create', 'Rent', '--group', 'Bills', '--json'], ENV(dbUrl));

    const created = await runCli(
      [
        'schedule',
        'create',
        'Rent',
        '--account',
        'Checking',
        '--amount',
        '-200000',
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
      ENV(dbUrl),
    );
    const schedId = parseJsonOut(created.stdout).data.id;

    const arch = await runCli(['schedule', 'archive', schedId, '--json'], ENV(dbUrl));
    expect(arch.exitCode).toBe(0);

    const list = await runCli(['schedule', 'list', '--json'], ENV(dbUrl));
    expect(parseJsonOut(list.stdout).data.length).toBe(0);

    const due = await runCli(['schedule', 'due', '--from', '2026-03-01', '--to', '2026-03-31', '--json'], ENV(dbUrl));
    expect(parseJsonOut(due.stdout).data.length).toBe(0);
  });
});
