import { Command } from 'commander';
import { eq } from 'drizzle-orm';
import { makeDb } from '../db/client.js';
import { envelopes } from '../db/schema.js';
import { print, printError } from '../lib/output.js';
import { newId, nowIsoUtc, requireNonEmpty } from '../lib/util.js';

export function registerEnvelopeCommands(program: Command) {
  const envelope = program.command('envelope').description('Manage envelopes/categories').addHelpCommand(false);

  envelope.action(function () {
    (this as Command).outputHelp();
    process.exit(0);
  });

  envelope
    .command('list')
    .description('List envelopes')
    .option('--hidden', 'include hidden envelopes', false)
    .action(async function () {
      const cmd = this as Command;
      try {
        const { db } = makeDb();
        const includeHidden = Boolean(cmd.opts().hidden);
        const list = includeHidden
          ? await db.select().from(envelopes)
          : await db.select().from(envelopes).where(eq(envelopes.isHidden, false));
        print(cmd, list.map((e) => `- ${e.name} (${e.groupName})${e.isHidden ? ' [hidden]' : ''}`).join('\n') || '(none)', list);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });

  envelope
    .command('create <name>')
    .description('Create an envelope')
    .option('--group <group>', 'Group name', 'General')
    .option('--hidden', 'Create as hidden', false)
    .action(async function (name: string) {
      const cmd = this as Command;
      try {
        const cleanName = requireNonEmpty(name, 'Envelope name is required');
        const { group, hidden } = cmd.opts();

        const row = {
          id: newId('env'),
          name: cleanName,
          groupName: String(group ?? 'General'),
          isHidden: Boolean(hidden),
          isSystem: false,
          createdAt: nowIsoUtc(),
        };

        const { db } = makeDb();
        await db.insert(envelopes).values(row);

        print(cmd, `Created envelope: ${row.name} (${row.groupName})`, row);
      } catch (err) {
        printError(cmd, err);
        process.exitCode = 2;
      }
    });
}
