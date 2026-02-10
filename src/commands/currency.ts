import { Command } from 'commander';
import { print, printError } from '../lib/output.js';
import { makeDb } from '../db/client.js';
import { getBudgetCurrency, setSetting } from '../lib/settings.js';

function normalizeCurrency(inputRaw: string): string {
  const raw = String(inputRaw ?? '').trim();
  if (!raw) throw new Error('Currency is required');

  // Single-currency mode: store whatever the user chooses (symbol or code).
  // Examples: "RM", "MYR", "$", "USD".
  // Keep a tiny bit of validation so config isn't garbage.
  if (raw.length > 8) throw new Error('Currency is too long (max 8 chars)');
  return raw;
}

export function registerCurrencyCommands(program: Command) {
  const currency = program.command('currency').description('Configure budget currency').addHelpCommand(false);

  currency.action(function () {
    (this as Command).outputHelp();
    process.exit(0);
  });

  currency
    .command('set <currency>')
    .description('Set the single budget currency symbol/code (e.g. RM, MYR, USD, $)')
    .action(async function (currencyArg: string) {
      const cmd = this as Command;
      try {
        const currencyCode = normalizeCurrency(currencyArg);

        // Requires DB (preAction ensures migrations + db connection)
        const { db } = makeDb();
        await setSetting(db, 'currency', currencyCode);

        // Make it available immediately in the process (helpful for chained commands)
        process.env.AGENTBUDGET_CURRENCY = currencyCode;

        print(cmd, `Currency set: ${currencyCode}`, { currency: currencyCode });
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  currency
    .command('show')
    .description('Show the configured budget currency')
    .action(async function () {
      const cmd = this as Command;
      try {
        const { db } = makeDb();
        const currencyCode = await getBudgetCurrency(db);
        print(cmd, `Currency: ${currencyCode}`, { currency: currencyCode });
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });
}
