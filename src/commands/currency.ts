import { Command } from 'commander';
import { print, printError } from '../lib/output.js';
import { readConfig, writeConfig } from '../lib/config.js';

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
    .option('--config-dir <dir>', 'Where config.json is stored (advanced)')
    .action(async function (currencyArg: string) {
      const cmd = this as Command;
      try {
        const opts = cmd.opts();
        const configDir = opts.configDir ? String(opts.configDir) : process.env.AGENTBUDGET_CONFIG_DIR;

        const existing = await readConfig(configDir);
        if (!existing?.dbUrl) {
          throw new Error('No config found. Run: agentbudget init --local (or --remote)');
        }

        const currencyCode = normalizeCurrency(currencyArg);
        const cfg = { ...existing, currency: currencyCode };
        const p = await writeConfig(cfg, configDir);

        // Make it available immediately in the process (helpful for chained commands)
        process.env.AGENTBUDGET_CURRENCY = currencyCode;

        print(cmd, `Currency set: ${currencyCode} (config: ${p})`, { currency: currencyCode, configPath: p });
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  currency
    .command('show')
    .description('Show the configured budget currency')
    .option('--config-dir <dir>', 'Where config.json is stored (advanced)')
    .action(async function () {
      const cmd = this as Command;
      try {
        const opts = cmd.opts();
        const configDir = opts.configDir ? String(opts.configDir) : process.env.AGENTBUDGET_CONFIG_DIR;
        const cfg = await readConfig(configDir);
        const currencyCode = cfg?.currency ?? process.env.AGENTBUDGET_CURRENCY ?? 'MYR';
        print(cmd, `Currency: ${currencyCode}`, { currency: currencyCode });
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });
}
