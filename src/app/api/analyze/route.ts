import { NextRequest, NextResponse } from 'next/server';
import { fetchRedditPosts } from '@/lib/services/reddit';
import { fetchTweets } from '@/lib/services/twitter';
import { fetchNews } from '@/lib/services/news';
import { generateAnalysis, getMarketOverview } from '@/lib/services/analyzer';
import { orchestrateAgents } from '@/lib/agents/orchestrator';
import { getRealMarketOverview } from '@/lib/services/stockdata';
import { generateAIInsights, generateAIStrategy, isAIEnabled } from '@/lib/services/ai';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') || 'en';

  try {
    const [redditPosts, tweets, newsArticles] = await Promise.all([
      fetchRedditPosts(),
      fetchTweets(),
      fetchNews(),
    ]);

    const analysis = generateAnalysis(redditPosts, tweets, newsArticles);

    // Try real market data, fall back to mock
    const realMarket = await getRealMarketOverview();
    const fallbackMarket = getMarketOverview();
    const marketOverview = realMarket
      ? { ...fallbackMarket, ...realMarket }
      : fallbackMarket;

    // Try AI-generated insights, merge if available
    const aiInsights = await generateAIInsights(
      analysis.topBullish,
      analysis.topBearish,
      analysis.trendingTopics,
      newsArticles,
      redditPosts,
      tweets,
      analysis.marketSentimentScore,
      locale,
    );
    if (aiInsights && aiInsights.length > 0) {
      analysis.keyInsights = aiInsights;
    }

    const agentResult = await orchestrateAgents(analysis, redditPosts, tweets, newsArticles, locale);

    return NextResponse.json({
      success: true,
      data: {
        analysis,
        marketOverview,
        rawData: {
          reddit: redditPosts,
          tweets,
          news: newsArticles,
        },
        agents: {
          states: agentResult.agentStates,
          expertSummary: agentResult.expertSummary,
          findings: agentResult.allFindings,
          chainReactions: agentResult.chainReactions,
        },
        meta: {
          aiEnabled: isAIEnabled(),
          realMarketData: !!realMarket,
        },
      },
    });
  } catch (error) {
    console.error('Analysis API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate analysis' },
      { status: 500 }
    );
  }
}
