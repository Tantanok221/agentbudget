import crypto from 'node:crypto';

export function nowIsoUtc() {
  return new Date().toISOString();
}

export function newId(prefix?: string) {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

export function requireNonEmpty(value: string | undefined, msg: string): string {
  if (!value || !value.trim()) throw new Error(msg);
  return value.trim();
}
