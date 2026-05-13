import { NextRequest, NextResponse } from 'next/server';
import { chatJSON, getLanguageInstruction } from '@/lib/services/ai';
import { withCache, cacheKey } from '@/lib/cache';

export const dynamic = 'force-dynamic';

interface StressScenario {
  name: string;
  description: string;
  impact: string;
  portfolioChange: number;
  affectedPositions: { ticker: string; estimatedChange: number; reasoning: string }[];
  hedgeSuggestion: string;
}

export async function POST(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') || 'en';

  try {
    const body = await request.json();
    const positions = body.positions || [];

    if (positions.length === 0) {
      return NextResponse.json({ success: false, error: 'No positions' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];
    const systemPrompt = `You are JARVIS — a portfolio risk manager who stress tests portfolios against extreme scenarios.

For each scenario, calculate estimated portfolio impact based on historical correlations and sector sensitivity.
Be specific: not "stocks will fall" but "NVDA drops 25% due to AI capex pullback while defensive names like JNJ only fall 5%."

Return JSON:
{
  "scenarios": [
    {
      "name": "scenario name",
      "description": "1-sentence scenario description",
      "impact": "severe|moderate|mild",
      "portfolioChange": -15.5,
      "affectedPositions": [
        { "ticker": "NVDA", "estimatedChange": -25, "reasoning": "AI capex most exposed" }
      ],
      "hedgeSuggestion": "specific hedge with ticker and sizing"
    }
  ]
}

Generate exactly 5 scenarios:
1. Rate shock (Fed surprise hike)
2. Recession / credit crisis
3. Sector-specific crash (based on portfolio concentration)
4. Geopolitical black swan
5. Tail risk / liquidity crisis

All percentages should be realistic based on historical precedents.${getLanguageInstruction(locale)}`;

    const posStr = positions.map((p: any) =>
      `${p.ticker} (${p.sector || 'Unknown'}): ${p.shares} shares @ $${p.avgCost}, current ~$${p.currentPrice || p.avgCost}`
    ).join('\n');

    const userPrompt = `TODAY: ${today}
Portfolio positions:
${posStr}

Total positions: ${positions.length}
Stress test this portfolio against 5 extreme scenarios. Be specific about which positions are most/least affected and provide concrete hedging suggestions.`;

    const posKey = positions.map((p: any) => p.ticker).sort().join(',');
    const result = await withCache(
      cacheKey('stress', posKey, locale),
      () => chatJSON<{ scenarios: StressScenario[] }>(systemPrompt, userPrompt, 2000),
      15 * 60 * 1000,
    );

    return NextResponse.json({
      success: true,
      data: { scenarios: result?.scenarios || [] },
    });
  } catch (error) {
    console.error('[Stress Test API] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to run stress test' }, { status: 500 });
  }
}
