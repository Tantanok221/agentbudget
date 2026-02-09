import { NextResponse } from 'next/server';
import { getOverviewV2 } from '../../../../../../dist/lib/overview_v2.js';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const month = url.searchParams.get('month') ?? '';
  if (!month) {
    return NextResponse.json({ ok: false, error: 'month is required (YYYY-MM)' }, { status: 400 });
  }

  try {
    const overview = await getOverviewV2(month);
    return NextResponse.json({ ok: true, month, overview });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
