import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion, getLanguageInstruction } from '@/lib/services/ai';
import { withCache, cacheKey } from '@/lib/cache';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  const locale = request.nextUrl.searchParams.get('locale') || 'en';

  if (!ticker) {
    return NextResponse.json({ success: false, error: 'Missing ticker' }, { status: 400 });
  }

  try {
    // Cache debate results per ticker for 15 min
    const result = await withCache(
      cacheKey('debate', ticker.toUpperCase(), locale),
      async () => {
        const today = new Date().toISOString().split('T')[0];
        const langInst = getLanguageInstruction(locale);

        const [bullCase, bearCase] = await Promise.all([
          chatCompletion(
            `You are a HYPER-BULLISH analyst making the strongest possible case for ${ticker}. You are debating a bear.
Your style: aggressive, data-driven, forward-looking. Find every reason to be optimistic.
- Cite specific catalysts, growth metrics, TAM expansion
- Dismiss bear arguments with counter-evidence
- Use specific price targets with reasoning
- Be persuasive but back claims with logic
Keep it under 250 words. Write in first person. Be bold.${langInst}`,
            `TODAY: ${today}\nMake your BULL case for ${ticker}. Why should someone buy aggressively right now? Include a 12-month price target.`,
            600,
          ),
          chatCompletion(
            `You are a HYPER-BEARISH analyst making the strongest possible case AGAINST ${ticker}. You are debating a bull.
Your style: skeptical, risk-focused, contrarian. Find every reason to be pessimistic.
- Cite valuation concerns, competition threats, macro headwinds
- Challenge the bullish narrative with hard data
- Use specific downside targets with reasoning
- Be persuasive but back claims with logic
Keep it under 250 words. Write in first person. Be bold.${langInst}`,
            `TODAY: ${today}\nMake your BEAR case for ${ticker}. Why should someone avoid or short this stock? Include a 12-month downside target.`,
            600,
          ),
        ]);

        const verdict = await chatCompletion(
          `You are JARVIS — an impartial judge evaluating a bull vs bear debate on ${ticker}.
Weigh both arguments, then give YOUR verdict:
- Who has the stronger argument and why?
- What's the probability of each scenario?
- What should the investor DO right now?
Keep it under 150 words. Be decisive.${langInst}`,
          `BULL CASE:\n${bullCase}\n\nBEAR CASE:\n${bearCase}\n\nTODAY: ${today}\nWho wins this debate? Give your verdict with a specific recommendation.`,
          400,
        );

        return {
          ticker: ticker.toUpperCase(),
          bullCase: bullCase || 'Unable to generate bull case',
          bearCase: bearCase || 'Unable to generate bear case',
          verdict: verdict || 'Unable to generate verdict',
        };
      },
      30 * 60 * 1000,
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('[Debate API] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate debate' }, { status: 500 });
  }
}
