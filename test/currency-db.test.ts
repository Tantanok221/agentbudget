import { describe, expect, it } from 'vitest';
import { runCli, parseJsonOut, makeTempDbUrl } from './helpers.js';

// DB-backed currency should persist in the database (not config/env).

describe('currency (DB-backed)', () => {
  it('currency set persists to DB and month summary/overview return it', async () => {
    const { dbUrl } = await makeTempDbUrl();

    // Migrate + create required system entities
    const sysRes = await runCli(['system', 'init', '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(sysRes.exitCode).toBe(0);

    const setRes = await runCli(['currency', 'set', 'RM', '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(setRes.exitCode).toBe(0);
    const setOut = parseJsonOut(setRes.stdout);
    expect(setOut.ok).toBe(true);
    expect(setOut.data.currency).toBe('RM');

    const sumRes = await runCli(['month', 'summary', '2026-02', '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(sumRes.exitCode).toBe(0);
    const sumOut = parseJsonOut(sumRes.stdout);
    expect(sumOut.ok).toBe(true);
    expect(sumOut.data.currency).toBe('RM');

    const ovRes = await runCli(['overview', '--month', '2026-02', '--json'], { TURSO_DATABASE_URL: dbUrl });
    expect(ovRes.exitCode).toBe(0);
    const ovOut = parseJsonOut(ovRes.stdout);
    expect(ovOut.ok).toBe(true);
    expect(ovOut.data.currency).toBe('RM');
  });
});
