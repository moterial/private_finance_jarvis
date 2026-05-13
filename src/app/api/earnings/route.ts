import { NextRequest, NextResponse } from 'next/server';
import { fetchEarningsCalendar } from '@/lib/services/earnings';
import { chatJSON, getLanguageInstruction } from '@/lib/services/ai';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') || 'en';

  try {
    const today = new Date();
    const fromDate = today.toISOString().split('T')[0];
    const futureDate = new Date(today.getTime() + 30 * 24 * 3600 * 1000);
    const toDate = futureDate.toISOString().split('T')[0];

    const earnings = await fetchEarningsCalendar(fromDate, toDate);

    // AI predictions for top earnings
    let aiPredictions: Record<string, string> | null = null;
    if (earnings.length > 0) {
      try {
        const topEarnings = earnings.slice(0, 10);
        const systemPrompt = `You are JARVIS — an earnings analyst who predicts beat/miss based on supply chain signals, social sentiment, and macro context.
For each ticker, give a 1-sentence prediction: will they beat, miss, or meet estimates? Include a confidence percentage.
Return JSON: { "predictions": { "TICKER": "prediction sentence" } }${getLanguageInstruction(locale)}`;

        const todayStr = new Date().toISOString().split('T')[0];
        const userPrompt = `TODAY: ${todayStr}
Upcoming earnings to analyze:
${topEarnings.map(e => `${e.ticker} on ${e.date} (${e.hour || 'TBD'}) — EPS est: ${e.epsEstimate ?? 'N/A'}`).join('\n')}

For each, predict beat/miss/meet with confidence % and brief reasoning.`;

        const result = await chatJSON<{ predictions: Record<string, string> }>(systemPrompt, userPrompt, 800);
        aiPredictions = result?.predictions ?? null;
      } catch {
        // AI optional
      }
    }

    return NextResponse.json({
      success: true,
      data: { earnings, aiPredictions },
    });
  } catch (error) {
    console.error('[Earnings API] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch earnings' }, { status: 500 });
  }
}
