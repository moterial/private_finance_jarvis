import { NextRequest, NextResponse } from 'next/server';
import { chatJSON, getLanguageInstruction } from '@/lib/services/ai';
import { yahooFetch, YF_BASE } from '@/lib/services/yahoo';
import { withCache, cacheKey } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') || 'en';

  try {
    const body = await request.json();
    const { ticker, strategy, period } = body;

    if (!ticker || !strategy) {
      return NextResponse.json({ success: false, error: 'Missing ticker or strategy' }, { status: 400 });
    }

    // Fetch historical data from Yahoo
    const periodMap: Record<string, string> = { '3mo': '3mo', '6mo': '6mo', '1y': '1y', '2y': '2y' };
    const range = periodMap[period] || '6mo';

    const res = await yahooFetch(
      `${YF_BASE}/v8/finance/chart/${ticker}?range=${range}&interval=1d`
    );

    let historicalPrices: { date: string; close: number }[] = [];
    if (res.ok) {
      const data = await res.json();
      const result = data.chart?.result?.[0];
      if (result) {
        const timestamps = result.timestamp || [];
        const closes = result.indicators?.quote?.[0]?.close || [];
        historicalPrices = timestamps.map((ts: number, i: number) => ({
          date: new Date(ts * 1000).toISOString().split('T')[0],
          close: closes[i] != null ? parseFloat(closes[i].toFixed(2)) : null,
        })).filter((p: any) => p.close != null);
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const systemPrompt = `You are JARVIS — a quantitative analyst running a backtest simulation.
Given historical price data, simulate the ${strategy} strategy and calculate performance metrics.

Return JSON:
{
  "strategyName": "${strategy}",
  "ticker": "${ticker}",
  "period": "${period}",
  "trades": [
    { "date": "2024-01-15", "action": "BUY", "price": 150.00, "reasoning": "signal triggered" },
    { "date": "2024-02-20", "action": "SELL", "price": 165.00, "reasoning": "target hit" }
  ],
  "metrics": {
    "totalReturn": 12.5,
    "winRate": 66.7,
    "totalTrades": 6,
    "winningTrades": 4,
    "losingTrades": 2,
    "avgWin": 5.2,
    "avgLoss": -2.1,
    "maxDrawdown": -8.3,
    "sharpeRatio": 1.4,
    "profitFactor": 2.48
  },
  "summary": "2-3 sentence assessment of the strategy performance"
}

Generate 4-10 realistic trades based on the price data. All metrics must be mathematically consistent.${getLanguageInstruction(locale)}`;

    const pricesSummary = historicalPrices.length > 0
      ? `Price range: $${Math.min(...historicalPrices.map(p => p.close)).toFixed(2)} - $${Math.max(...historicalPrices.map(p => p.close)).toFixed(2)}
Start: $${historicalPrices[0].close} (${historicalPrices[0].date})
End: $${historicalPrices[historicalPrices.length - 1].close} (${historicalPrices[historicalPrices.length - 1].date})
Total data points: ${historicalPrices.length}
Key prices (sampled): ${historicalPrices.filter((_, i) => i % Math.max(1, Math.floor(historicalPrices.length / 10)) === 0).map(p => `${p.date}:$${p.close}`).join(', ')}`
      : 'No historical data available — simulate realistic trades based on typical price action.';

    const userPrompt = `TODAY: ${today}
Backtest "${strategy}" strategy on ${ticker} over ${period}:

${pricesSummary}

Simulate this strategy with realistic entries and exits. Calculate all performance metrics accurately.`;

    const result = await withCache(
      cacheKey('backtest', ticker, strategy, period, locale),
      () => chatJSON<any>(systemPrompt, userPrompt, 1500),
      15 * 60 * 1000,
    );

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        historicalPrices: historicalPrices.filter((_, i) => i % Math.max(1, Math.floor(historicalPrices.length / 5)) === 0),
      },
    });
  } catch (error) {
    console.error('[Backtest API] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to run backtest' }, { status: 500 });
  }
}
