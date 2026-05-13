import { NextRequest, NextResponse } from 'next/server';
import { fetchRedditPosts } from '@/lib/services/reddit';
import { fetchTweets } from '@/lib/services/twitter';
import { fetchNews } from '@/lib/services/news';
import { generateAnalysis, getMarketOverview } from '@/lib/services/analyzer';
import { orchestrateAgents } from '@/lib/agents/orchestrator';
import { getRealMarketOverview } from '@/lib/services/stockdata';
import { generateAIInsights, generateAIStrategy, isAIEnabled } from '@/lib/services/ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60s for AI calls

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') || 'en';
  const phase = request.nextUrl.searchParams.get('phase') || 'full';

  try {
    // Phase 1: Fast data (no AI) — gets dashboard visible quickly
    const [redditPosts, tweets, newsArticles] = await Promise.all([
      fetchRedditPosts(),
      fetchTweets(),
      fetchNews(),
    ]);

    const analysis = generateAnalysis(redditPosts, tweets, newsArticles);

    const realMarket = await getRealMarketOverview();
    const fallbackMarket = getMarketOverview();
    const marketOverview = realMarket
      ? { ...fallbackMarket, ...realMarket }
      : fallbackMarket;

    if (phase === 'fast') {
      // Return immediately with data-only results (no AI)
      const quickAgentResult = await orchestrateAgents(analysis, redditPosts, tweets, newsArticles, locale);
      return NextResponse.json({
        success: true,
        phase: 'fast',
        data: {
          analysis,
          marketOverview,
          rawData: { reddit: redditPosts, tweets, news: newsArticles },
          agents: {
            states: quickAgentResult.agentStates,
            expertSummary: quickAgentResult.expertSummary,
            findings: quickAgentResult.allFindings,
            chainReactions: quickAgentResult.chainReactions,
          },
          strategy: null,
          meta: { aiEnabled: isAIEnabled(), realMarketData: !!realMarket },
        },
      });
    }

    if (phase === 'ai') {
      // Phase 2: AI enrichment — called after fast phase renders
      const [aiInsights, agentResult, strategy] = await Promise.all([
        generateAIInsights(
          analysis.topBullish, analysis.topBearish, analysis.trendingTopics,
          newsArticles, redditPosts, tweets, analysis.marketSentimentScore, locale,
        ).catch(() => null),
        orchestrateAgents(analysis, redditPosts, tweets, newsArticles, locale),
        generateAIStrategy(
          analysis, analysis.topBullish, analysis.topBearish,
          analysis.trendingTopics, newsArticles, locale,
        ).catch(e => { console.error('[Strategy] Generation failed:', e); return null; }),
      ]);

      if (aiInsights && aiInsights.length > 0) {
        analysis.keyInsights = aiInsights;
      }

      return NextResponse.json({
        success: true,
        phase: 'ai',
        data: {
          analysis,
          marketOverview,
          rawData: { reddit: redditPosts, tweets, news: newsArticles },
          agents: {
            states: agentResult.agentStates,
            expertSummary: agentResult.expertSummary,
            findings: agentResult.allFindings,
            chainReactions: agentResult.chainReactions,
          },
          strategy,
          meta: { aiEnabled: isAIEnabled(), realMarketData: !!realMarket },
        },
      });
    }

    // phase === 'full': original behavior (backwards compatible)
    const aiInsights = await generateAIInsights(
      analysis.topBullish, analysis.topBearish, analysis.trendingTopics,
      newsArticles, redditPosts, tweets, analysis.marketSentimentScore, locale,
    ).catch(() => null);
    if (aiInsights && aiInsights.length > 0) {
      analysis.keyInsights = aiInsights;
    }

    const agentResult = await orchestrateAgents(analysis, redditPosts, tweets, newsArticles, locale);

    let strategy = null;
    try {
      strategy = await generateAIStrategy(
        analysis, analysis.topBullish, analysis.topBearish,
        analysis.trendingTopics, newsArticles, locale,
      );
    } catch (e) {
      console.error('[Strategy] Generation failed:', e);
    }

    return NextResponse.json({
      success: true,
      phase: 'full',
      data: {
        analysis,
        marketOverview,
        rawData: { reddit: redditPosts, tweets, news: newsArticles },
        agents: {
          states: agentResult.agentStates,
          expertSummary: agentResult.expertSummary,
          findings: agentResult.allFindings,
          chainReactions: agentResult.chainReactions,
        },
        strategy,
        meta: { aiEnabled: isAIEnabled(), realMarketData: !!realMarket },
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
