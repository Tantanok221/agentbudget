import type { Command } from 'commander';

export type JsonResult = { ok: true; data?: unknown } | { ok: false; error: { message: string; code?: string; details?: unknown } };

export function wantsJson(cmd: Command): boolean {
  // commander: optsWithGlobals includes parent opts
  const anyCmd = cmd as unknown as { optsWithGlobals?: () => any; opts: () => any };
  const o = typeof anyCmd.optsWithGlobals === 'function' ? anyCmd.optsWithGlobals() : anyCmd.opts();
  return Boolean(o?.json);
}

export function print(cmd: Command, human: string, jsonData: unknown) {
  if (wantsJson(cmd)) {
    const out: JsonResult = { ok: true, data: jsonData };
    process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  } else {
    process.stdout.write(human.endsWith('\n') ? human : human + '\n');
  }
}

export function printError(cmd: Command, err: unknown, code?: string, details?: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  if (wantsJson(cmd)) {
    const out: JsonResult = { ok: false, error: { message, code, details } };
    process.stderr.write(JSON.stringify(out, null, 2) + '\n');
  } else {
    process.stderr.write(message + '\n');
  }
}
