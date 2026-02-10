import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

export type AgentBudgetConfig = {
  dbUrl: string;
  authToken?: string;
};

export function defaultConfigDir() {
  // Follow XDG-ish convention
  const base = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
  return path.join(base, 'agentbudget');
}

export function configPath(configDir?: string) {
  return path.join(configDir ?? defaultConfigDir(), 'config.json');
}

export async function writeConfig(cfg: AgentBudgetConfig, configDir?: string) {
  const dir = configDir ?? defaultConfigDir();
  await fs.mkdir(dir, { recursive: true });
  const p = configPath(dir);
  await fs.writeFile(p, JSON.stringify(cfg, null, 2) + '\n', { encoding: 'utf-8', mode: 0o600 });
  return p;
}

export async function readConfig(configDir?: string): Promise<AgentBudgetConfig | null> {
  try {
    const p = configPath(configDir);
    const raw = await fs.readFile(p, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
