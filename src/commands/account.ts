import { Command } from 'commander';
import { makeDb } from '../db/client.js';
import { accounts } from '../db/schema.js';
import { print, printError } from '../lib/output.js';
import { newId, nowIsoUtc, requireNonEmpty } from '../lib/util.js';

export function registerAccountCommands(program: Command) {
  const account = program.command('account').description('Manage accounts');

  account.action(function () {
    (this as Command).outputHelp();
    process.exit(0);
  });

  account
    .command('list')
    .description('List accounts')
    .action(async function () {
      const cmd = this as Command;
      try {
        const { db } = makeDb();
        const rows = await db.select().from(accounts);
        print(cmd, rows.map((a) => `- ${a.name} (${a.type})`).join('\n') || '(none)', rows);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  account
    .command('create')
    .description('Create an account')
    .argument('<name>', 'Account name')
    .requiredOption('--type <type>', 'checking|savings|cash|tracking')
    .option('--currency <ccy>', 'Currency', 'MYR')
    .action(async function (name: string) {
      const cmd = this as Command;
      try {
        const cleanName = requireNonEmpty(name, 'Account name is required');
        const { type, currency } = cmd.opts();

        const row = {
          id: newId('acct'),
          name: cleanName,
          type: String(type) as 'checking' | 'savings' | 'cash' | 'tracking',
          currency: String(currency ?? 'MYR'),
          openedAt: nowIsoUtc(),
          closedAt: null,
        };

        const { db } = makeDb();
        await db.insert(accounts).values(row);
        print(cmd, `Created account: ${row.name} (${row.type})`, row);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });
}
