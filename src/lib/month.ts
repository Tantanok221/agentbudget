export function parseMonthStrict(month: string) {
  const m = String(month).trim();
  if (!/^\d{4}-\d{2}$/.test(m)) throw new Error('Month must be in YYYY-MM format');
  const [y, mo] = m.split('-').map((x) => Number(x));
  const start = new Date(Date.UTC(y, mo - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, mo, 1, 0, 0, 0));
  const prevEnd = start; // exclusive end for previous
  return { month: m, startIso: start.toISOString(), endIso: end.toISOString(), prevEndIso: prevEnd.toISOString() };
}

export function compareMonth(a: string, b: string) {
  // both expected YYYY-MM
  return a.localeCompare(b);
}
