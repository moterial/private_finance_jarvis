import { NextRequest, NextResponse } from 'next/server';
import { scanUnusualOptions } from '@/lib/services/options-flow';
import { withCache, cacheKey } from '@/lib/cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Same universe as the signal scanner
const DEFAULT_TICKERS = ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AMD', 'PLTR', 'INTC', 'JPM', 'NFLX', 'COIN', 'DIS'];

const FLOW_TTL = 10 * 60 * 1000; // 10 min — Yahoo options data is ~15min delayed anyway

export async function GET(request: NextRequest) {
  const tickersParam = request.nextUrl.searchParams.get('tickers');
  const tickers = tickersParam
    ? tickersParam.split(',').map(t => t.trim().toUpperCase()).filter(Boolean).slice(0, 20)
    : DEFAULT_TICKERS;

  try {
    const result = await withCache(
      cacheKey('options:flow', tickers.join(',')),
      () => scanUnusualOptions(tickers),
      FLOW_TTL,
    );
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Options Flow API] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to scan options flow' }, { status: 500 });
  }
}
