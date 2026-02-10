import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runCli, parseJsonOut } from './helpers.js';

async function readJson(p: string) {
  return JSON.parse(await fs.readFile(p, 'utf-8'));
}

describe('currency (TDD)', () => {
  it('currency set updates config and month summary returns configured currency', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'agentbudget-currency-'));
    const configDir = path.join(tmp, 'cfg');

    // isolate init local DB path
    const env = { HOME: tmp, TURSO_DATABASE_URL: '', TURSO_AUTH_TOKEN: '' };

    // init config
    const initRes = await runCli(['init', '--local', '--config-dir', configDir, '--json'], env);
    expect(initRes.exitCode).toBe(0);

    // set currency (accepts RM alias)
    const setRes = await runCli(['currency', 'set', 'RM', '--config-dir', configDir, '--json'], env);
    expect(setRes.exitCode).toBe(0);
    const setOut = parseJsonOut(setRes.stdout);
    expect(setOut.ok).toBe(true);
    expect(setOut.data.currency).toBe('MYR');

    const cfg = await readJson(path.join(configDir, 'config.json'));
    expect(cfg.currency).toBe('MYR');

    // bootstrap system so month summary can run
    const sysRes = await runCli(['system', 'init', '--json'], { ...env, AGENTBUDGET_CONFIG_DIR: configDir });
    expect(sysRes.exitCode).toBe(0);

    const sumRes = await runCli(['month', 'summary', '2026-02', '--json'], { ...env, AGENTBUDGET_CONFIG_DIR: configDir });
    expect(sumRes.exitCode).toBe(0);
    const sumOut = parseJsonOut(sumRes.stdout);
    expect(sumOut.ok).toBe(true);
    expect(sumOut.data.currency).toBe('MYR');
  });
});
