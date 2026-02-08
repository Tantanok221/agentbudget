export function parseDateToIsoUtc(input: string): string {
  // Accept ISO, YYYY-MM-DD, or anything Date can parse.
  // Store as ISO UTC.
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${input}`);
  return d.toISOString();
}
