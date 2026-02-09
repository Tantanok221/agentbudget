import { NextResponse } from 'next/server';
import { getOverviewV2 } from '../../../../../../dist/lib/overview_v2.js';
import { buildAdvice } from '../../../lib/advice.ts';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const month = url.searchParams.get('month') ?? '';
  const q = url.searchParams.get('q') ?? '';
  if (!month) {
    return NextResponse.json({ ok: false, error: 'month is required (YYYY-MM)' }, { status: 400 });
  }

  try {
    const overview = await getOverviewV2(month);
    const advice = buildAdvice({ question: q, month, overview });
    return NextResponse.json({ ok: true, month, advice });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
