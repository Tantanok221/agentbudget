#!/usr/bin/env node
import 'dotenv/config';
import { Command } from 'commander';
import { ensureMigrated } from './db/migrate.js';
import { registerEnvelopeCommands } from './commands/envelope.js';
import { registerAccountCommands } from './commands/account.js';
import { registerTxCommands } from './commands/tx.js';
import { registerSystemCommands } from './commands/system.js';
import { registerMonthCommands } from './commands/month.js';
import { registerBudgetCommands } from './commands/budget.js';
import { registerInitCommand } from './commands/init.js';
import { registerOverviewCommand } from './commands/overview.js';
import { printError } from './lib/output.js';

const program = new Command();

program
  .name('agentbudget')
  .description('Agent-first zero-based envelope budgeting CLI')
  .showHelpAfterError(true)
  .showSuggestionAfterError(true)
  .addHelpCommand(false)
  .helpOption('-h, --help', 'Display help for command')
  .option('--json', 'machine-readable JSON output')
  .option('--db <url>', 'Override TURSO_DATABASE_URL (e.g. file:./data/local.db)');

program.configureHelp({
  subcommandTerm: (cmd) => {
    // Render like: "create <name> [options]" (instead of "create [options] <name>")
    const name = cmd.name();
    let args = cmd.usage();
    const hasOpts = (cmd.options?.length ?? 0) > 0;

    if (!args || args === '[options]') return name;

    // commander often puts [options] first; strip it so we can append consistently
    args = args.replace(/^\[options\]\s*/g, '');
    args = args.replace(/\s*\[options\]\s*$/g, '');

    return `${name} ${args}${hasOpts ? ' [options]' : ''}`.trim();
  },
});

program.hook('preAction', async (_thisCommand, actionCommand) => {
  // Do not require DB connectivity for top-level `agentbudget init` (it bootstraps config)
  if (actionCommand?.name?.() === 'init' && actionCommand.parent?.name?.() === 'agentbudget') return;

  const opts = _thisCommand.optsWithGlobals();
  if (opts?.db) process.env.TURSO_DATABASE_URL = String(opts.db);

  // Load config if env not set
  if (!process.env.TURSO_DATABASE_URL) {
    const { readConfig } = await import('./lib/config.js');
    const cfgDir = process.env.AGENTBUDGET_CONFIG_DIR;
    const cfg = await readConfig(cfgDir);
    if (cfg?.dbUrl) process.env.TURSO_DATABASE_URL = cfg.dbUrl;
    if (cfg?.authToken && !process.env.TURSO_AUTH_TOKEN) process.env.TURSO_AUTH_TOKEN = cfg.authToken;
  }

  await ensureMigrated();
});

program
  .command('ping')
  .description('Health check')
  .action(async function () {
    // preAction already migrates
    console.log('ok');
  });

registerInitCommand(program);
registerSystemCommands(program);
registerEnvelopeCommands(program);
registerAccountCommands(program);
registerTxCommands(program);
registerMonthCommands(program);
registerBudgetCommands(program);
registerOverviewCommand(program);

// If invoked with no args, show help (agent + human friendly)
if (process.argv.length <= 2) {
  program.outputHelp();
  process.exit(0);
}

try {
  await program.parseAsync(process.argv);
} catch (err) {
  // Commander throws on unknown commands in some cases
  printError(program as unknown as Command, err);
  process.exit(2);
}
