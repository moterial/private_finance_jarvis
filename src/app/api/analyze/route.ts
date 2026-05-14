import { NextRequest, NextResponse } from 'next/server';
import { fetchRedditPosts } from '@/lib/services/reddit';
import { fetchTweets } from '@/lib/services/twitter';
import { fetchNews } from '@/lib/services/news';
import { generateAnalysis, getMarketOverview, computeFearGreed } from '@/lib/services/analyzer';
import { orchestrateAgents } from '@/lib/agents/orchestrator';
import { getRealMarketOverview, getBatchQuotes } from '@/lib/services/stockdata';
import { yfChart } from '@/lib/services/yahoo';
import { generateAIInsights, generateAIStrategy, isAIEnabled } from '@/lib/services/ai';
import { detectAnomalies } from '@/lib/services/anomaly';
import { withCache, cacheKey } from '@/lib/cache';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Cache TTLs
const DATA_TTL  = 2 * 60 * 1000; // 2 min for market data — keep prices fresh
const AI_TTL    = 15 * 60 * 1000; // 15 min for AI-generated insights

export async function GET(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') || 'en';
  const phase = request.nextUrl.searchParams.get('phase') || 'full';

  try {
    // Shared data layer — cached so multiple users don't re-fetch
    const [redditPosts, tweets, newsArticles] = await Promise.all([
      withCache('data:reddit', fetchRedditPosts, DATA_TTL),
      withCache('data:tweets', fetchTweets, DATA_TTL),
      withCache('data:news', fetchNews, DATA_TTL),
    ]);

    // Fetch real prices for tickers mentioned in social/news data
    const SIGNAL_TICKERS = ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AMD', 'PLTR', 'INTC', 'JPM', 'NFLX', 'COIN', 'DIS'];
    const realQuotes = await withCache('data:signal-prices', () => getBatchQuotes(SIGNAL_TICKERS), DATA_TTL);
    const realPrices = new Map<string, { price: number; change: number; changePercent: number; volume?: number }>();
    for (const [ticker, q] of realQuotes) {
      realPrices.set(ticker, { price: q.currentPrice, change: q.change, changePercent: q.changePercent, volume: q.volume });
    }

    const analysis = generateAnalysis(redditPosts, tweets, newsArticles, realPrices);

    const marketOverview = await withCache('data:market', async () => {
      const realMarket = await getRealMarketOverview();
      const fallbackMarket = getMarketOverview();
      const merged = realMarket ? { ...fallbackMarket, ...realMarket } : fallbackMarket;

      // Compute real Fear & Greed index from sentiment + VIX
      merged.fearGreedIndex = computeFearGreed(
        analysis.marketSentimentScore,
        merged.vix.value,
        analysis.topBullish.length,
        analysis.topBearish.length,
      );

      // Determine market status from time
      const now = new Date();
      const nyHour = Number(now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }));
      const nyMin = Number(now.toLocaleString('en-US', { timeZone: 'America/New_York', minute: 'numeric' }));
      const day = now.getDay();
      const mins = nyHour * 60 + nyMin;
      if (day === 0 || day === 6) merged.marketStatus = 'closed';
      else if (mins >= 570 && mins < 960) merged.marketStatus = 'open'; // 9:30-16:00
      else if (mins >= 240 && mins < 570) merged.marketStatus = 'pre-market';
      else if (mins >= 960 && mins < 1200) merged.marketStatus = 'after-hours';
      else merged.marketStatus = 'closed';

      return merged;
    }, DATA_TTL);

    // Attach real sparkline data (5-day closes) to signal tickers
    await withCache('data:sparklines', async () => {
      const allSignals = [...analysis.topBullish, ...analysis.topBearish];
      const tickers = [...new Set(allSignals.map(s => s.ticker))].slice(0, 14);
      const results = await Promise.allSettled(
        tickers.map(async t => {
          const chart = await yfChart(t, { range: '5d', interval: '1h' });
          const closes = chart?.indicators?.quote?.[0]?.close?.filter((c: number | null) => c != null) || [];
          return { ticker: t, closes: closes.slice(-20) as number[] };
        })
      );
      const sparkMap = new Map<string, number[]>();
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value.closes.length > 0) {
          sparkMap.set(r.value.ticker, r.value.closes);
        }
      }
      for (const sig of allSignals) {
        sig.sparkline = sparkMap.get(sig.ticker);
      }
      return true;
    }, DATA_TTL);

    if (phase === 'fast') {
      // Cached fast response — agents + anomaly detection shared across users
      const fastResult = await withCache(cacheKey('fast', locale), async () => {
        const quickAgentResult = await orchestrateAgents(analysis, redditPosts, tweets, newsArticles, locale);
        const allSignals = [...analysis.topBullish, ...analysis.topBearish];
        const anomalies = detectAnomalies(allSignals, redditPosts, tweets, newsArticles, analysis.trendingTopics);
        return {
          agents: {
            states: quickAgentResult.agentStates,
            expertSummary: quickAgentResult.expertSummary,
            findings: quickAgentResult.allFindings,
            chainReactions: quickAgentResult.chainReactions,
          },
          anomalies,
        };
      }, DATA_TTL);

      return NextResponse.json({
        success: true,
        phase: 'fast',
        data: {
          analysis,
          marketOverview,
          rawData: { reddit: redditPosts, tweets, news: newsArticles },
          agents: fastResult.agents,
          anomalies: fastResult.anomalies,
          strategy: null,
          meta: { aiEnabled: isAIEnabled(), realMarketData: true },
        },
      });
    }

    if (phase === 'ai') {
      // Phase 2: AI enrichment — cached so multiple users share the same AI response
      const aiCacheKey = cacheKey('ai', locale, new Date().toISOString().slice(0, 13)); // per-hour bucket

      const cachedAiResult = await withCache(cacheKey('ai:full', locale), async () => {
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

        return {
          analysis,
          agents: {
            states: agentResult.agentStates,
            expertSummary: agentResult.expertSummary,
            findings: agentResult.allFindings,
            chainReactions: agentResult.chainReactions,
          },
          strategy,
        };
      }, AI_TTL);

      return NextResponse.json({
        success: true,
        phase: 'ai',
        data: {
          analysis: cachedAiResult.analysis,
          marketOverview,
          rawData: { reddit: redditPosts, tweets, news: newsArticles },
          agents: cachedAiResult.agents,
          anomalies: detectAnomalies([...analysis.topBullish, ...analysis.topBearish], redditPosts, tweets, newsArticles, analysis.trendingTopics),
          strategy: cachedAiResult.strategy,
          meta: { aiEnabled: isAIEnabled(), realMarketData: true },
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
        anomalies: detectAnomalies([...analysis.topBullish, ...analysis.topBearish], redditPosts, tweets, newsArticles, analysis.trendingTopics),
        strategy,
        meta: { aiEnabled: isAIEnabled(), realMarketData: true },
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
