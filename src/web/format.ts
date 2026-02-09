export function fmtMoneyMYR(amountMinor: number) {
  // agentbudget uses minor units internally.
  const v = (amountMinor ?? 0) / 100;
  return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR' }).format(v);
}

export function fmtMonthLabel(month: string) {
  // month is YYYY-MM
  const [y, m] = month.split('-').map((x) => Number(x));
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, 1));
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dt);
}
