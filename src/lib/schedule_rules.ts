export type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type ScheduleRule =
  | { freq: 'daily'; interval: number }
  | { freq: 'weekly'; interval: number; weekday: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun' }
  | { freq: 'monthly'; interval: number; monthDay: number | 'last' }
  | { freq: 'yearly'; interval: number; month: number; monthDay: number | 'last' };

export function parseIsoDateOnly(s: string): { y: number; m: number; d: number } {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(s);
  if (!m) throw new Error(`Invalid date (expected YYYY-MM-DD): ${s}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) throw new Error(`Invalid date: ${s}`);
  if (mo < 1 || mo > 12) throw new Error(`Invalid month in date: ${s}`);
  if (d < 1 || d > 31) throw new Error(`Invalid day in date: ${s}`);
  return { y, m: mo, d };
}

export function fmtIsoDateOnly(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function daysInMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const idx = (y * 12 + (m - 1)) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return { y: ny, m: nm };
}

export function compareIsoDateOnly(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function toUtcDate(iso: string) {
  const { y, m, d } = parseIsoDateOnly(iso);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtcDate(d: Date): string {
  return fmtIsoDateOnly(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function generateDailyOccurrences(startDate: string, interval: number, from: string, to: string): string[] {
  const s = parseIsoDateOnly(startDate);
  const f = parseIsoDateOnly(from);
  const t = parseIsoDateOnly(to);
  const startIso = fmtIsoDateOnly(s.y, s.m, s.d);
  const fromIso = fmtIsoDateOnly(f.y, f.m, f.d);
  const toIso = fmtIsoDateOnly(t.y, t.m, t.d);

  const startD = toUtcDate(startIso);
  const fromD = toUtcDate(fromIso);
  const toD = toUtcDate(toIso);

  const base = startD.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  // Find first occurrence >= from.
  let cur = fromD.getTime();
  if (cur < base) cur = base;

  const offsetDays = Math.floor((cur - base) / dayMs);
  const mod = ((offsetDays % interval) + interval) % interval;
  if (mod !== 0) cur += (interval - mod) * dayMs;

  const out: string[] = [];
  while (cur <= toD.getTime()) {
    const occ = fromUtcDate(new Date(cur));
    if (occ >= startIso && occ >= fromIso) out.push(occ);
    cur += interval * dayMs;
  }

  return out;
}

const weekdayToIdx: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

export function generateWeeklyOccurrences(
  startDate: string,
  weekday: 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun',
  interval: number,
  from: string,
  to: string,
): string[] {
  const s = parseIsoDateOnly(startDate);
  const f = parseIsoDateOnly(from);
  const t = parseIsoDateOnly(to);
  const startIso = fmtIsoDateOnly(s.y, s.m, s.d);
  const fromIso = fmtIsoDateOnly(f.y, f.m, f.d);
  const toIso = fmtIsoDateOnly(t.y, t.m, t.d);

  const startD = toUtcDate(startIso);
  const fromD = toUtcDate(fromIso);
  const toD = toUtcDate(toIso);

  // Find first date >= max(start, from) that matches weekday.
  let cur = new Date(Math.max(startD.getTime(), fromD.getTime()));
  const targetIdx = weekdayToIdx[weekday];
  while (cur.getUTCDay() !== targetIdx) cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);

  // Align week interval grid relative to startDate's week.
  const dayMs = 24 * 60 * 60 * 1000;
  const weekMs = 7 * dayMs;
  // compute week index since startD for cur
  const weeksSinceStart = Math.floor((cur.getTime() - startD.getTime()) / weekMs);
  const mod = ((weeksSinceStart % interval) + interval) % interval;
  if (mod !== 0) cur = new Date(cur.getTime() + (interval - mod) * weekMs);

  const out: string[] = [];
  while (cur.getTime() <= toD.getTime()) {
    const occ = fromUtcDate(cur);
    if (occ >= startIso && occ >= fromIso && occ <= toIso) out.push(occ);
    cur = new Date(cur.getTime() + interval * weekMs);
  }
  return out;
}

export function generateMonthlyOccurrences(startDate: string, monthDay: number | 'last', interval: number, from: string, to: string): string[] {
  const s = parseIsoDateOnly(startDate);
  const f = parseIsoDateOnly(from);
  const t = parseIsoDateOnly(to);

  const fromIso = fmtIsoDateOnly(f.y, f.m, f.d);
  const toIso = fmtIsoDateOnly(t.y, t.m, t.d);
  const startIso = fmtIsoDateOnly(s.y, s.m, s.d);

  const startMonthIdx = s.y * 12 + (s.m - 1);
  const fromMonthIdx = f.y * 12 + (f.m - 1);
  let monthIdx = Math.max(startMonthIdx, fromMonthIdx);

  const offset = monthIdx - startMonthIdx;
  const mod = ((offset % interval) + interval) % interval;
  if (mod !== 0) monthIdx += interval - mod;

  const out: string[] = [];
  while (true) {
    const y = Math.floor(monthIdx / 12);
    const m = (monthIdx % 12) + 1;
    const dim = daysInMonth(y, m);
    const day = monthDay === 'last' ? dim : Math.min(monthDay, dim);
    const occ = fmtIsoDateOnly(y, m, day);

    if (occ > toIso) break;
    if (occ >= fromIso && occ >= startIso) out.push(occ);

    monthIdx += interval;
  }
  return out;
}

export function generateYearlyOccurrences(
  startDate: string,
  month: number,
  monthDay: number | 'last',
  interval: number,
  from: string,
  to: string,
): string[] {
  const s = parseIsoDateOnly(startDate);
  const f = parseIsoDateOnly(from);
  const t = parseIsoDateOnly(to);

  const fromIso = fmtIsoDateOnly(f.y, f.m, f.d);
  const toIso = fmtIsoDateOnly(t.y, t.m, t.d);
  const startIso = fmtIsoDateOnly(s.y, s.m, s.d);

  let y = Math.max(s.y, f.y);
  // align year to interval grid
  const offset = y - s.y;
  const mod = ((offset % interval) + interval) % interval;
  if (mod !== 0) y += interval - mod;

  const out: string[] = [];
  while (true) {
    const dim = daysInMonth(y, month);
    const day = monthDay === 'last' ? dim : Math.min(monthDay, dim);
    const occ = fmtIsoDateOnly(y, month, day);

    if (occ > toIso) break;
    if (occ >= fromIso && occ >= startIso) out.push(occ);

    y += interval;
  }
  return out;
}
