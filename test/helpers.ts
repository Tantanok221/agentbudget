import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';
import { execa } from 'execa';

export async function makeTempDbUrl() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agentbudget-'));
  const dbPath = path.join(dir, 'test.db');
  return { dir, dbUrl: `file:${dbPath}` };
}

export async function runCli(args: string[], env?: Record<string, string>) {
  const cmdEnv = {
    ...process.env,
    ...env,
  };

  // Allow callers to explicitly clear vars by passing empty string.
  if (env && 'TURSO_DATABASE_URL' in env && !env.TURSO_DATABASE_URL) delete cmdEnv.TURSO_DATABASE_URL;
  if (env && 'TURSO_AUTH_TOKEN' in env && !env.TURSO_AUTH_TOKEN) delete cmdEnv.TURSO_AUTH_TOKEN;

  const res = await execa('npx', ['-y', 'tsx', 'src/cli.ts', ...args], {
    cwd: path.resolve(process.cwd()),
    env: cmdEnv,
    reject: false,
  });

  return {
    exitCode: res.exitCode,
    stdout: res.stdout,
    stderr: res.stderr,
  };
}

export function parseJsonOut(stdout: string) {
  return JSON.parse(stdout);
}
