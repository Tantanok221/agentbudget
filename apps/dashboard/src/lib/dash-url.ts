export function buildLegacyDashUrl(params: { month?: string; q?: string }) {
  const url = new URL('http://127.0.0.1:8788/dash');
  if (params.month) url.searchParams.set('month', params.month);
  if (params.q) url.searchParams.set('q', params.q);
  return url.toString();
}
