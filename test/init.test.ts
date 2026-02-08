import { describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runCli, parseJsonOut } from './helpers.js';

async function readJson(p: string) {
  return JSON.parse(await fs.readFile(p, 'utf-8'));
}

describe('init (TDD)', () => {
  it('init --local writes config with dbUrl under an explicit config dir', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'agentbudget-init-'));
    const configDir = path.join(tmp, 'cfg');

    const res = await runCli(['init', '--local', '--config-dir', configDir, '--json']);
    expect(res.exitCode).toBe(0);

    const out = parseJsonOut(res.stdout);
    expect(out.ok).toBe(true);
    expect(out.data.mode).toBe('local');
    expect(out.data.dbUrl).toMatch(/^file:/);

    // directory for the db should exist
    const dbPath = out.data.dbUrl.replace(/^file:/, '');
    await fs.access(path.dirname(dbPath));

    const cfgPath = path.join(configDir, 'config.json');
    const cfg = await readJson(cfgPath);
    expect(cfg.dbUrl).toBe(out.data.dbUrl);
  });
});
