import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import * as schema from './schema.js';

export type Db = ReturnType<typeof makeDb>;

type AgentBudgetConfig = { dbUrl: string; authToken?: string };

function defaultConfigDir() {
  const base = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
  return path.join(base, 'agentbudget');
}

function loadConfigSync(): AgentBudgetConfig | null {
  try {
    const dir = process.env.AGENTBUDGET_CONFIG_DIR ?? defaultConfigDir();
    const p = path.join(dir, 'config.json');
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function makeDb(opts?: { url?: string; authToken?: string }) {
  const cfg = loadConfigSync();

  const url =
    opts?.url ??
    process.env.TURSO_DATABASE_URL ??
    cfg?.dbUrl ??
    // fallback: relative local DB (mostly for repo dev)
    'file:./data/local.db';

  const authToken = opts?.authToken ?? process.env.TURSO_AUTH_TOKEN ?? cfg?.authToken;

  const client = createClient({ url, authToken });
  const db = drizzle(client, { schema });
  return { client, db };
}
