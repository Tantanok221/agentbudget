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
import { printError } from './lib/output.js';

const program = new Command();

program
  .name('agentbudget')
  .description('Agent-first zero-based envelope budgeting CLI')
  .showHelpAfterError(true)
  .showSuggestionAfterError(true)
  .helpOption('-h, --help', 'Display help for command')
  .option('--json', 'machine-readable JSON output')
  .option('--db <url>', 'Override TURSO_DATABASE_URL (e.g. file:./data/local.db)');

program.hook('preAction', async (thisCommand) => {
  const opts = thisCommand.optsWithGlobals();
  if (opts?.db) process.env.TURSO_DATABASE_URL = String(opts.db);
  await ensureMigrated();
});

program
  .command('ping')
  .description('Health check')
  .action(async function () {
    // preAction already migrates
    console.log('ok');
  });

registerSystemCommands(program);
registerEnvelopeCommands(program);
registerAccountCommands(program);
registerTxCommands(program);
registerMonthCommands(program);
registerBudgetCommands(program);

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
