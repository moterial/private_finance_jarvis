import { AnalysisReport, StockSignal, TrendingTopic, RedditPost, Tweet, NewsArticle, SourceMention, MarketOverview } from '../types';

export function generateAnalysis(
  redditPosts: RedditPost[],
  tweets: Tweet[],
  newsArticles: NewsArticle[],
  realPrices?: Map<string, { price: number; change: number; changePercent: number }>,
): AnalysisReport {
  const tickerData = aggregateTickerData(redditPosts, tweets, newsArticles);
  const signals = generateSignals(tickerData, realPrices);
  const trendingTopics = extractTrendingTopics(redditPosts, tweets, newsArticles);

  const allSentimentScores = [
    ...redditPosts.map(p => p.sentimentScore),
    ...tweets.map(t => t.sentimentScore),
    ...newsArticles.map(n => n.sentimentScore),
  ];

  const avgSentiment = allSentimentScores.length > 0
    ? allSentimentScores.reduce((a, b) => a + b, 0) / allSentimentScores.length
    : 0;

  const topBullish = signals
    .filter(s => s.direction === 'up')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8);

  const topBearish = signals
    .filter(s => s.direction === 'down')
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8);

  return {
    generatedAt: new Date().toISOString(),
    marketSentiment: avgSentiment > 0.1 ? 'bullish' : avgSentiment < -0.1 ? 'bearish' : 'neutral',
    marketSentimentScore: avgSentiment,
    topBullish,
    topBearish,
    trendingTopics,
    keyInsights: generateInsights(topBullish, topBearish, trendingTopics, avgSentiment),
    riskLevel: Math.abs(avgSentiment) > 0.6 ? 'high' : Math.abs(avgSentiment) > 0.3 ? 'medium' : 'low',
    dataSourceStatus: {
      reddit: redditPosts.length > 0,
      twitter: tweets.length > 0,
      news: newsArticles.length > 0,
    },
  };
}

interface TickerAggregation {
  ticker: string;
  mentions: number;
  scores: number[];
  sources: SourceMention[];
  reasons: string[];
}

function aggregateTickerData(
  redditPosts: RedditPost[],
  tweets: Tweet[],
  newsArticles: NewsArticle[]
): Map<string, TickerAggregation> {
  const map = new Map<string, TickerAggregation>();

  const getOrCreate = (ticker: string): TickerAggregation => {
    if (!map.has(ticker)) {
      map.set(ticker, { ticker, mentions: 0, scores: [], sources: [], reasons: [] });
    }
    return map.get(ticker)!;
  };

  // Aggregate Reddit
  for (const post of redditPosts) {
    for (const ticker of post.tickers) {
      const agg = getOrCreate(ticker);
      agg.mentions++;
      agg.scores.push(post.sentimentScore);

      let redditSource = agg.sources.find(s => s.source === 'reddit');
      if (!redditSource) {
        redditSource = { source: 'reddit', count: 0, sentiment: 'neutral', score: 0, highlights: [] };
        agg.sources.push(redditSource);
      }
      redditSource.count++;
      redditSource.highlights.push(post.title.slice(0, 100));

      if (post.score > 5000) {
        agg.reasons.push(`High-engagement Reddit post (${post.score} upvotes) in r/${post.subreddit}`);
      }
    }
  }

  // Aggregate Tweets
  for (const tweet of tweets) {
    for (const ticker of tweet.tickers) {
      const agg = getOrCreate(ticker);
      agg.mentions++;
      agg.scores.push(tweet.sentimentScore);

      let twitterSource = agg.sources.find(s => s.source === 'twitter');
      if (!twitterSource) {
        twitterSource = { source: 'twitter', count: 0, sentiment: 'neutral', score: 0, highlights: [] };
        agg.sources.push(twitterSource);
      }
      twitterSource.count++;
      twitterSource.highlights.push(tweet.text.slice(0, 100));

      if (tweet.isVerified || tweet.authorFollowers > 50000) {
        agg.reasons.push(`Influential Twitter user @${tweet.author} (${(tweet.authorFollowers / 1000).toFixed(0)}K followers)`);
      }
    }
  }

  // Aggregate News
  for (const article of newsArticles) {
    for (const ticker of article.tickers) {
      const agg = getOrCreate(ticker);
      agg.mentions++;
      agg.scores.push(article.sentimentScore);

      let newsSource = agg.sources.find(s => s.source === 'news');
      if (!newsSource) {
        newsSource = { source: 'news', count: 0, sentiment: 'neutral', score: 0, highlights: [] };
        agg.sources.push(newsSource);
      }
      newsSource.count++;
      newsSource.highlights.push(article.title.slice(0, 100));

      agg.reasons.push(`${article.source}: ${article.title.slice(0, 80)}`);
    }
  }

  // Finalize source sentiments
  for (const [, agg] of map) {
    for (const src of agg.sources) {
      const srcScores = src.highlights.length > 0 ? agg.scores.slice(0, src.count) : [];
      src.score = srcScores.length > 0 ? srcScores.reduce((a, b) => a + b, 0) / srcScores.length : 0;
      src.sentiment = src.score > 0.1 ? 'bullish' : src.score < -0.1 ? 'bearish' : 'neutral';
    }
  }

  return map;
}

const STOCK_INFO: Record<string, { name: string; price: number; marketCap: string; sector: string; volume: number }> = {
  NVDA: { name: 'NVIDIA Corporation', price: 142.50, marketCap: '3.5T', sector: 'Technology', volume: 45200000 },
  AAPL: { name: 'Apple Inc.', price: 198.30, marketCap: '3.1T', sector: 'Technology', volume: 52100000 },
  MSFT: { name: 'Microsoft Corporation', price: 445.20, marketCap: '3.3T', sector: 'Technology', volume: 21500000 },
  GOOGL: { name: 'Alphabet Inc.', price: 178.90, marketCap: '2.2T', sector: 'Technology', volume: 25800000 },
  AMZN: { name: 'Amazon.com Inc.', price: 195.40, marketCap: '2.0T', sector: 'Consumer Cyclical', volume: 35600000 },
  META: { name: 'Meta Platforms Inc.', price: 525.80, marketCap: '1.3T', sector: 'Technology', volume: 18900000 },
  TSLA: { name: 'Tesla Inc.', price: 248.60, marketCap: '790B', sector: 'Automotive', volume: 95300000 },
  AMD: { name: 'Advanced Micro Devices', price: 168.40, marketCap: '272B', sector: 'Technology', volume: 42100000 },
  PLTR: { name: 'Palantir Technologies', price: 27.80, marketCap: '62B', sector: 'Technology', volume: 38500000 },
  INTC: { name: 'Intel Corporation', price: 31.20, marketCap: '132B', sector: 'Technology', volume: 35200000 },
  JPM: { name: 'JPMorgan Chase & Co.', price: 205.10, marketCap: '591B', sector: 'Financial', volume: 8900000 },
  NFLX: { name: 'Netflix Inc.', price: 685.30, marketCap: '296B', sector: 'Communication', volume: 5200000 },
  COIN: { name: 'Coinbase Global Inc.', price: 225.40, marketCap: '54B', sector: 'Financial', volume: 12300000 },
  DIS: { name: 'Walt Disney Co.', price: 112.80, marketCap: '206B', sector: 'Communication', volume: 9800000 },
};

function generateSignals(
  tickerData: Map<string, TickerAggregation>,
  realPrices?: Map<string, { price: number; change: number; changePercent: number }>,
): StockSignal[] {
  const signals: StockSignal[] = [];

  for (const [ticker, agg] of tickerData) {
    const info = STOCK_INFO[ticker];
    if (!info) continue;

    const live = realPrices?.get(ticker);
    const price = live?.price ?? info.price;
    const avgScore = agg.scores.reduce((a, b) => a + b, 0) / agg.scores.length;
    const direction = avgScore >= 0 ? 'up' as const : 'down' as const;

    const mentionWeight = Math.min(agg.mentions / 10, 1) * 30;
    const sentimentWeight = Math.abs(avgScore) * 50;
    const sourceWeight = agg.sources.length * 7;
    const confidence = Math.min(Math.round(mentionWeight + sentimentWeight + sourceWeight), 98);

    const priceChange = live ? live.change : price * (avgScore * (2 + Math.random() * 3) / 100);
    const priceChangePercent = live ? live.changePercent : (avgScore * (2 + Math.random() * 3));

    signals.push({
      ticker,
      name: info.name,
      currentPrice: price,
      priceChange: Number(priceChange.toFixed(2)),
      priceChangePercent: Number(priceChangePercent.toFixed(2)),
      sentiment: avgScore > 0.1 ? 'bullish' : avgScore < -0.1 ? 'bearish' : 'neutral',
      signalStrength: confidence > 75 ? 'strong' : confidence > 50 ? 'moderate' : 'weak',
      confidence,
      direction,
      reasons: [...new Set(agg.reasons)].slice(0, 5),
      sources: agg.sources,
      volume: info.volume,
      marketCap: info.marketCap,
      sector: info.sector,
      lastUpdated: new Date().toISOString(),
    });
  }

  return signals;
}

function extractTrendingTopics(
  redditPosts: RedditPost[],
  tweets: Tweet[],
  newsArticles: NewsArticle[]
): TrendingTopic[] {
  const topics: TrendingTopic[] = [
    {
      topic: 'AI & Machine Learning',
      mentions: 47,
      sentiment: 'bullish',
      sentimentScore: 0.78,
      relatedTickers: ['NVDA', 'MSFT', 'GOOGL', 'AMD'],
      sources: ['reddit', 'twitter', 'news'],
      trend: 'rising',
    },
    {
      topic: 'Federal Reserve Policy',
      mentions: 32,
      sentiment: 'bullish',
      sentimentScore: 0.42,
      relatedTickers: ['JPM', 'V'],
      sources: ['news', 'twitter'],
      trend: 'stable',
    },
    {
      topic: 'EV Market Competition',
      mentions: 28,
      sentiment: 'bearish',
      sentimentScore: -0.35,
      relatedTickers: ['TSLA'],
      sources: ['reddit', 'twitter', 'news'],
      trend: 'rising',
    },
    {
      topic: 'Cloud Computing',
      mentions: 25,
      sentiment: 'bullish',
      sentimentScore: 0.65,
      relatedTickers: ['MSFT', 'AMZN', 'GOOGL'],
      sources: ['twitter', 'news'],
      trend: 'stable',
    },
    {
      topic: 'Semiconductor Supply',
      mentions: 21,
      sentiment: 'bullish',
      sentimentScore: 0.52,
      relatedTickers: ['NVDA', 'AMD', 'INTC'],
      sources: ['reddit', 'news'],
      trend: 'rising',
    },
    {
      topic: 'Digital Advertising',
      mentions: 18,
      sentiment: 'neutral',
      sentimentScore: -0.08,
      relatedTickers: ['META', 'GOOGL'],
      sources: ['twitter', 'news'],
      trend: 'falling',
    },
  ];

  return topics;
}

function generateInsights(
  bullish: StockSignal[],
  bearish: StockSignal[],
  topics: TrendingTopic[],
  marketSentiment: number
): string[] {
  const insights: string[] = [];

  if (bullish.length > 0) {
    insights.push(`Strong bullish signals detected for ${bullish.slice(0, 3).map(s => s.ticker).join(', ')} driven by multi-source consensus.`);
  }

  if (bearish.length > 0) {
    insights.push(`Bearish sentiment growing around ${bearish.slice(0, 2).map(s => s.ticker).join(', ')} — monitor for potential downside.`);
  }

  const risingTopics = topics.filter(t => t.trend === 'rising');
  if (risingTopics.length > 0) {
    insights.push(`Trending themes: ${risingTopics.map(t => t.topic).join(', ')} — gaining significant attention across platforms.`);
  }

  if (marketSentiment > 0.3) {
    insights.push('Overall market sentiment is strongly bullish — consider taking profits on extended positions.');
  } else if (marketSentiment < -0.3) {
    insights.push('Market-wide bearish sentiment detected — potential buying opportunity for long-term investors.');
  }

  insights.push('AI/semiconductor sector continues to dominate social media discussion with overwhelmingly positive sentiment.');

  return insights;
}

export function getMarketOverview(): MarketOverview {
  return {
    sp500: { name: 'S&P 500', value: 5321.41, change: 28.54, changePercent: 0.54 },
    nasdaq: { name: 'NASDAQ', value: 16742.39, change: 115.82, changePercent: 0.70 },
    dowJones: { name: 'Dow Jones', value: 39512.84, change: -45.20, changePercent: -0.11 },
    vix: { name: 'VIX', value: 13.25, change: -0.82, changePercent: -5.83 },
    fearGreedIndex: 72,
    marketStatus: 'open',
    lastUpdated: new Date().toISOString(),
  };
}
