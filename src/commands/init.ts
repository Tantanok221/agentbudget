import { Command } from 'commander';
import path from 'node:path';
import os from 'node:os';
import { print, printError } from '../lib/output.js';
import { writeConfig } from '../lib/config.js';

export function registerInitCommand(program: Command) {
  program
    .command('init')
    .description('Initialize agentbudget configuration (choose local or remote DB)')
    .option('--local', 'Use a local SQLite DB file', false)
    .option('--remote', 'Use a remote Turso/libSQL DB (expects TURSO_DATABASE_URL/TURSO_AUTH_TOKEN)', false)
    .option('--config-dir <dir>', 'Where to write config.json (advanced)')
    .action(async function () {
      const cmd = this as Command;
      try {
        const opts = cmd.opts();
        const local = Boolean(opts.local);
        const remote = Boolean(opts.remote);
        if ((local && remote) || (!local && !remote)) {
          throw new Error('Choose exactly one: --local or --remote');
        }

        const configDir = opts.configDir ? String(opts.configDir) : undefined;

        if (local) {
          const filePath = path.join(os.homedir(), '.agentbudget', 'agentbudget.db');
          const fs = await import('node:fs/promises');
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          const dbUrl = `file:${filePath}`;
          const cfgPath = await writeConfig({ dbUrl }, configDir);
          print(cmd, `Initialized local DB config at ${cfgPath}\nDB: ${dbUrl}`, { mode: 'local', dbUrl, configPath: cfgPath });
          return;
        }

        // remote
        const dbUrl = process.env.TURSO_DATABASE_URL;
        const authToken = process.env.TURSO_AUTH_TOKEN;
        if (!dbUrl || !authToken) {
          throw new Error('Remote mode requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the environment');
        }
        const cfgPath = await writeConfig({ dbUrl, authToken }, configDir);
        print(cmd, `Initialized remote DB config at ${cfgPath}\nDB: ${dbUrl}`, { mode: 'remote', dbUrl, configPath: cfgPath });
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });
}
