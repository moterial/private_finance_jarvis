import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion, getLanguageInstruction } from '@/lib/services/ai';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') || 'en';

  try {
    const body = await request.json();
    const entries = body.entries || [];

    if (entries.length < 3) {
      return NextResponse.json({ success: false, error: 'Need at least 3 trades' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];
    const systemPrompt = `You are JARVIS — a trading psychology coach who identifies behavioral patterns.

Analyze the trading journal and provide:
1. Pattern Recognition: What behavioral patterns do you see? (e.g., "You tend to sell winners too early")
2. Emotional Analysis: How do emotions correlate with outcomes? (e.g., "FOMO trades have 80% loss rate")
3. Timing Analysis: When are trades most/least successful?
4. Specific Advice: 2-3 concrete changes to improve results
5. Strengths: What is the trader doing well?

Be direct and specific. Use data from the journal to back every claim.
Keep response under 300 words. Format in clear paragraphs.${getLanguageInstruction(locale)}`;

    const entriesStr = entries.map((e: any) =>
      `${e.date}: ${e.action.toUpperCase()} ${e.ticker} @ $${e.price} x${e.shares} | Emotion: ${e.emotion} | Outcome: ${e.outcome || 'open'} | P&L: ${e.pnl != null ? '$' + e.pnl : 'N/A'} | Reason: ${e.reasoning || 'none'}`
    ).join('\n');

    const coaching = await chatCompletion(
      systemPrompt,
      `TODAY: ${today}\n\nTrading journal (${entries.length} entries):\n${entriesStr}\n\nAnalyze these trades and provide actionable coaching.`,
      800,
    );

    return NextResponse.json({
      success: true,
      data: { coaching: coaching || 'Unable to generate coaching analysis.' },
    });
  } catch (error) {
    console.error('[Journal Coach API] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to analyze journal' }, { status: 500 });
  }
}
