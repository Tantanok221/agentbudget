export function parseMajorToMinor(inputRaw: string): number {
  const input = String(inputRaw).trim();
  if (!input) throw new Error('Invalid amount');

  // Accept: 319, -25, 3.19, -0.05
  const m = /^(-)?([0-9]+)(?:\.([0-9]{1,2}))?$/.exec(input);
  if (!m) throw new Error(`Invalid amount (expected major units, e.g. 319 or 3.19): ${input}`);

  const sign = m[1] ? -1 : 1;
  const whole = Number(m[2]);
  const fracRaw = m[3] ?? '';
  const frac = Number((fracRaw + '00').slice(0, 2));

  const minor = whole * 100 + frac;
  // Keep safe integer range
  const out = sign * minor;
  if (!Number.isSafeInteger(out)) throw new Error('Amount is too large');
  return out;
}

export function formatMinor(minorUnits: number, currency: string, locale = 'en-MY'): string {
  const major = minorUnits / 100;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    currencyDisplay: 'symbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(major);
}

export function formatMinorPlain(minorUnits: number): string {
  const sign = minorUnits < 0 ? '-' : '';
  const abs = Math.abs(minorUnits);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}
