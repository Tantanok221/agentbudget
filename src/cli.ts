#!/usr/bin/env node
import { Command } from 'commander';
import { ensureMigrated } from './db/migrate.js';

const program = new Command();

program
  .name('agentbudget')
  .description('Agent-first zero-based envelope budgeting CLI')
  .option('--json', 'machine-readable JSON output')
  .option('--db <url>', 'override TURSO_DATABASE_URL (e.g. file:./data/local.db)');

// TODO: plumb --db into makeDb via env override per invocation

program
  .command('ping')
  .description('health check')
  .action(async () => {
    await ensureMigrated();
    console.log('ok');
  });

await program.parseAsync(process.argv);
