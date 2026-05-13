import { NextRequest, NextResponse } from 'next/server';
import { fetchOptionsChain, buildStrategies, calculatePutCallRatio } from '@/lib/services/options';
import { chatJSON } from '@/lib/services/ai';
import { getLanguageInstruction } from '@/lib/services/ai';
import { withCache, cacheKey } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  const expiration = request.nextUrl.searchParams.get('expiration') || undefined;
  const locale = request.nextUrl.searchParams.get('locale') || 'en';

  if (!ticker) {
    return NextResponse.json({ success: false, error: 'Missing ticker' }, { status: 400 });
  }

  try {
    // Cache chain data per ticker+expiration for 5 min — shared across all users
    // Don't cache null results (fetch failures)
    const chain = await withCache(
      cacheKey('options:chain', ticker, expiration || 'default'),
      async () => {
        const result = await fetchOptionsChain(ticker!, expiration);
        if (!result) throw new Error('fetch_failed');
        return result;
      },
      5 * 60 * 1000,
    ).catch(() => null);
    if (!chain) {
      return NextResponse.json({ success: false, error: 'No options data available — Yahoo Finance may be temporarily unavailable' }, { status: 404 });
    }

    const strategies = buildStrategies(chain);
    const putCallRatio = calculatePutCallRatio(chain);

    // AI strategy recommendation — cached per ticker (10 min)
    let aiRecommendation: string | null = null;
    try {
      aiRecommendation = await withCache(
        cacheKey('options:ai', ticker, locale),
        async () => {
          const systemPrompt = `You are JARVIS — an options strategist who finds asymmetric trades.
Analyze the options data and recommend the BEST strategy. Be specific:
- Why this strategy over others given current IV, skew, and market conditions
- Exact strikes and expiration to use
- Risk management: when to close, adjust, or roll
- What catalyst or event makes this trade attractive RIGHT NOW
Return JSON: { "recommendation": "3-4 sentences with specific strategy, strikes, and reasoning" }${getLanguageInstruction(locale)}`;

          const today = new Date().toISOString().split('T')[0];
          const userPrompt = `TODAY: ${today}
${ticker} @ $${chain.currentPrice}
Put/Call Volume Ratio: ${putCallRatio.volumeRatio} (${putCallRatio.signal})
Put/Call OI Ratio: ${putCallRatio.oiRatio}
Available strategies: ${strategies.map(s => `${s.name}(${s.type}, maxProfit:${s.maxProfit}, maxLoss:${s.maxLoss}, R:R=${s.riskRewardRatio})`).join('; ')}
ATM IV: ${chain.calls.find(c => c.inTheMoney === false)?.impliedVolatility?.toFixed(2) || 'N/A'}
Nearest expiration: ${chain.expirationDates[0] || 'N/A'}`;

          const result = await chatJSON<{ recommendation: string }>(systemPrompt, userPrompt, 400);
          return result?.recommendation ?? null;
        },
        20 * 60 * 1000,
      );
    } catch {
      // AI is optional
    }

    return NextResponse.json({
      success: true,
      data: {
        chain: {
          ticker: chain.ticker,
          currentPrice: chain.currentPrice,
          expirationDates: chain.expirationDates,
          callCount: chain.calls.length,
          putCount: chain.puts.length,
          calls: chain.calls.slice(0, 20), // Limit response size
          puts: chain.puts.slice(0, 20),
          fetchedAt: chain.fetchedAt,
        },
        strategies,
        putCallRatio,
        aiRecommendation,
      },
    });
  } catch (error) {
    console.error('[Options API] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch options data' }, { status: 500 });
  }
}
