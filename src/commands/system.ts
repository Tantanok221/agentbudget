import { Command } from 'commander';
import { eq } from 'drizzle-orm';
import { makeDb } from '../db/client.js';
import { envelopes } from '../db/schema.js';
import { print, printError } from '../lib/output.js';
import { newId, nowIsoUtc } from '../lib/util.js';

export const SYSTEM_GROUP = 'System';
export const TBB_NAME_DEFAULT = 'To Be Budgeted';

export function registerSystemCommands(program: Command) {
  const system = program.command('system').description('System initialization and maintenance');

  system.action(function () {
    (this as Command).outputHelp();
    process.exit(0);
  });

  system
    .command('init')
    .description('Initialize required system entities (e.g. To Be Budgeted envelope)')
    .option('--tbb-name <name>', 'Name for the TBB envelope', TBB_NAME_DEFAULT)
    .action(async function () {
      const cmd = this as Command;
      try {
        const { db } = makeDb();
        const tbbName = String(cmd.opts().tbbName ?? TBB_NAME_DEFAULT).trim();

        if (!tbbName) throw new Error('tbb-name must be non-empty');

        // If any system envelope exists with this name, return it.
        const existing = await db.select().from(envelopes).where(eq(envelopes.name, tbbName)).limit(1);
        if (existing[0]) {
          print(cmd, `System already initialized (TBB exists): ${existing[0].name}`, existing[0]);
          return;
        }

        const row = {
          id: newId('env'),
          name: tbbName,
          groupName: SYSTEM_GROUP,
          isHidden: false,
          isSystem: true,
          createdAt: nowIsoUtc(),
        };

        await db.insert(envelopes).values(row);
        print(cmd, `Initialized system envelope: ${row.name}`, row);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });
}
