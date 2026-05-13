import { NextRequest, NextResponse } from 'next/server';
import { getBatchQuotes } from '@/lib/services/stockdata';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const tickers = request.nextUrl.searchParams.get('tickers');
  if (!tickers) {
    return NextResponse.json({ success: false, error: 'tickers param required' }, { status: 400 });
  }

  const symbols = tickers.split(',').map(s => s.trim().toUpperCase()).filter(Boolean).slice(0, 30);
  if (symbols.length === 0) {
    return NextResponse.json({ success: false, error: 'no valid tickers' }, { status: 400 });
  }

  try {
    const quotes = await getBatchQuotes(symbols);
    const result: Record<string, { price: number; change: number; changePercent: number }> = {};
    for (const [ticker, q] of quotes) {
      result[ticker] = { price: q.currentPrice, change: q.change, changePercent: q.changePercent };
    }
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Quotes API] Failed:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch quotes' }, { status: 500 });
  }
}
