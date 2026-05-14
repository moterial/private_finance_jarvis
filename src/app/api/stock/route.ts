import { NextRequest, NextResponse } from 'next/server';
import { fetchRealCandles, analyzePriceAction } from '@/lib/analysis/price-action';
import { analyzeSupplyChain } from '@/lib/analysis/supply-chain';
import { getRealCandles, getQuote, getCompanyNews } from '@/lib/services/stockdata';
import { generateAIStockAnalysis } from '@/lib/services/ai';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');

  if (!ticker) {
    return NextResponse.json({ success: false, error: 'ticker is required' }, { status: 400 });
  }

  const upperTicker = ticker.toUpperCase();
  const locale = request.nextUrl.searchParams.get('locale') || 'en';
  const timeframe = request.nextUrl.searchParams.get('timeframe') || '1d';

  // Map timeframe to days and interval
  const tfConfig: Record<string, { days: number; interval: string }> = {
    '1d': { days: 1, interval: '5m' },
    '5d': { days: 5, interval: '15m' },
    '1mo': { days: 30, interval: '1d' },
    '3mo': { days: 90, interval: '1d' },
    '6mo': { days: 180, interval: '1d' },
    '1y': { days: 365, interval: '1wk' },
    '2y': { days: 730, interval: '1wk' },
  };
  const { days, interval } = tfConfig[timeframe] || tfConfig['3mo'];

  try {
    // Fetch real candle data — no fake fallback
    const realCandles = await getRealCandles(upperTicker, days, interval);
    const candles = realCandles || await fetchRealCandles(upperTicker, days);
    const isRealData = candles.length > 0;

    const technicalReport = analyzePriceAction(candles, upperTicker);
    const chainReactions = analyzeSupplyChain(upperTicker, 'bullish', `${upperTicker} momentum analysis`);

    // Try real quote
    const quote = await getQuote(upperTicker);

    // Try AI analysis
    const aiAnalysis = await generateAIStockAnalysis(
      upperTicker,
      technicalReport.summary,
      technicalReport.trend,
      technicalReport.recommendation,
      technicalReport.supportLevels,
      technicalReport.resistanceLevels,
      chainReactions,
      locale,
    );

    // Try company news
    const companyNews = await getCompanyNews(upperTicker, 7);

    return NextResponse.json({
      success: true,
      data: {
        ticker: upperTicker,
        candles,
        technicalReport,
        chainReactions,
        isRealData,
        quote: quote || null,
        aiAnalysis: aiAnalysis || null,
        companyNews: companyNews.slice(0, 5),
      },
    });
  } catch (error) {
    console.error('Stock preview API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate stock preview' },
      { status: 500 }
    );
  }
}
