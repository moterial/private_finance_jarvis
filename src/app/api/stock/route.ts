import { NextRequest, NextResponse } from 'next/server';
import { generateCandleData, analyzePriceAction } from '@/lib/analysis/price-action';
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

  try {
    // Try real candle data first, fall back to synthetic
    const realCandles = await getRealCandles(upperTicker, 60);
    const candles = realCandles || generateCandleData(upperTicker, 60);
    const isRealData = !!realCandles;

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
