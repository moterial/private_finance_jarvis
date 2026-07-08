import { AnalysisReport, StockSignal, TrendingTopic, RedditPost, Tweet, NewsArticle, SourceMention, MarketOverview } from '../types';

export function generateAnalysis(
  redditPosts: RedditPost[],
  tweets: Tweet[],
  newsArticles: NewsArticle[],
  realPrices?: Map<string, { price: number; change: number; changePercent: number; volume?: number }>,
  locale: string = 'en',
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
    keyInsights: generateInsights(topBullish, topBearish, trendingTopics, avgSentiment, locale),
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
  scoresBySource: Record<string, number[]>;
}

function aggregateTickerData(
  redditPosts: RedditPost[],
  tweets: Tweet[],
  newsArticles: NewsArticle[]
): Map<string, TickerAggregation> {
  const map = new Map<string, TickerAggregation>();

  const getOrCreate = (ticker: string): TickerAggregation => {
    if (!map.has(ticker)) {
      map.set(ticker, { ticker, mentions: 0, scores: [], sources: [], reasons: [], scoresBySource: {} });
    }
    return map.get(ticker)!;
  };

  const addScore = (agg: TickerAggregation, source: string, score: number) => {
    agg.scores.push(score);
    (agg.scoresBySource[source] ??= []).push(score);
  };

  // Aggregate Reddit
  for (const post of redditPosts) {
    for (const ticker of post.tickers) {
      const agg = getOrCreate(ticker);
      agg.mentions++;
      addScore(agg, 'reddit', post.sentimentScore);

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
      addScore(agg, 'twitter', tweet.sentimentScore);

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
      addScore(agg, 'news', article.sentimentScore);

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

  // Finalize source sentiments from each source's own scores
  for (const [, agg] of map) {
    for (const src of agg.sources) {
      const srcScores = agg.scoresBySource[src.source] || [];
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

// Compute JARVIS entry/exit/stop targets from price, direction, confidence, and sentiment score
function computeTargets(price: number, direction: 'up' | 'down', confidence: number, avgScore: number) {
  if (!price || price <= 0) return {};
  // Confidence-based move expectation: higher confidence = wider targets
  const baseMove = 0.02 + (confidence / 100) * 0.06; // 2%-8% range based on confidence
  const sentimentBoost = Math.abs(avgScore) * 0.03; // 0-3% boost from strong sentiment

  // Stop distance measured from ENTRY (not current price) so R:R stays honest.
  // Floor at 1.5% so low-confidence signals don't produce absurd 1:5+ ratios from a hairline stop.
  const stopMove = Math.max(baseMove * 0.6, 0.015);

  if (direction === 'up') {
    const entry = Number((price * (1 - 0.005)).toFixed(2)); // Entry slightly below current (0.5% dip buy)
    const exitTarget = Number((price * (1 + baseMove + sentimentBoost)).toFixed(2));
    const stopLoss = Number((entry * (1 - stopMove)).toFixed(2));
    const reward = exitTarget - entry;
    const risk = entry - stopLoss;
    const rr = risk > 0 ? `1:${(reward / risk).toFixed(1)}` : '1:2';
    return { entryPrice: entry, exitTarget, stopLoss, riskReward: rr };
  } else {
    // Bearish: entry on bounce, target lower, stop above
    const entry = Number((price * (1 + 0.005)).toFixed(2)); // Entry slightly above (sell on bounce)
    const exitTarget = Number((price * (1 - baseMove - sentimentBoost)).toFixed(2));
    const stopLoss = Number((entry * (1 + stopMove)).toFixed(2));
    const reward = entry - exitTarget;
    const risk = stopLoss - entry;
    const rr = risk > 0 ? `1:${(reward / risk).toFixed(1)}` : '1:2';
    return { entryPrice: entry, exitTarget, stopLoss, riskReward: rr };
  }
}

function generateSignals(
  tickerData: Map<string, TickerAggregation>,
  realPrices?: Map<string, { price: number; change: number; changePercent: number; volume?: number }>,
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

    const priceChange = live ? live.change : 0;
    const priceChangePercent = live ? live.changePercent : 0;

    // Skip tickers without real price data — no fake signals
    if (!live) continue;

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
      volume: live?.volume || 0,
      marketCap: info.marketCap,
      sector: info.sector,
      lastUpdated: new Date().toISOString(),
      // JARVIS actionable price targets (technical-based)
      ...computeTargets(price, direction, confidence, avgScore),
    });
  }

  return signals;
}

function extractTrendingTopics(
  redditPosts: RedditPost[],
  tweets: Tweet[],
  newsArticles: NewsArticle[]
): TrendingTopic[] {
  // Topic detection keywords → topic name + related tickers
  const TOPIC_DEFS: { keywords: string[]; topic: string; tickers: string[] }[] = [
    { keywords: ['ai', 'artificial intelligence', 'machine learning', 'chatgpt', 'llm', 'deepseek', 'copilot', 'generative'], topic: 'AI & Machine Learning', tickers: ['NVDA', 'MSFT', 'GOOGL', 'AMD', 'META'] },
    { keywords: ['fed', 'federal reserve', 'rate cut', 'rate hike', 'interest rate', 'fomc', 'powell', 'inflation', 'cpi'], topic: 'Federal Reserve & Rates', tickers: ['JPM', 'V', 'GS'] },
    { keywords: ['ev', 'electric vehicle', 'byd', 'tesla', 'charging', 'battery', 'autonomous'], topic: 'EV & Autonomous', tickers: ['TSLA'] },
    { keywords: ['cloud', 'azure', 'aws', 'gcp', 'saas', 'data center'], topic: 'Cloud Computing', tickers: ['MSFT', 'AMZN', 'GOOGL', 'CRM'] },
    { keywords: ['chip', 'semiconductor', 'gpu', 'cuda', 'tsmc', 'fab', 'wafer'], topic: 'Semiconductors', tickers: ['NVDA', 'AMD', 'INTC', 'TSM', 'AVGO'] },
    { keywords: ['ad revenue', 'advertising', 'digital ads', 'social media', 'instagram', 'tiktok', 'youtube'], topic: 'Digital Advertising', tickers: ['META', 'GOOGL', 'SNAP'] },
    { keywords: ['tariff', 'trade war', 'trade deal', 'sanctions', 'export control', 'embargo'], topic: 'Trade & Tariffs', tickers: [] },
    { keywords: ['trump', 'president', 'white house', 'congress', 'executive order', 'election', 'political'], topic: 'US Politics', tickers: [] },
    { keywords: ['china', 'xi jinping', 'beijing', 'ccp', 'geopolitical', 'taiwan'], topic: 'China & Geopolitics', tickers: ['TSM', 'BABA'] },
    { keywords: ['crypto', 'bitcoin', 'ethereum', 'btc', 'eth', 'blockchain', 'defi'], topic: 'Crypto & Blockchain', tickers: ['COIN'] },
    { keywords: ['oil', 'energy', 'opec', 'natural gas', 'crude', 'renewable'], topic: 'Energy & Oil', tickers: [] },
    { keywords: ['earnings', 'revenue', 'beat estimate', 'miss estimate', 'guidance', 'quarterly'], topic: 'Earnings Season', tickers: [] },
  ];

  // Scan all content
  const allTexts: { text: string; score: number; source: 'reddit' | 'twitter' | 'news' }[] = [];
  for (const p of redditPosts) allTexts.push({ text: (p.title + ' ' + (p.selfText || '')).toLowerCase(), score: p.sentimentScore, source: 'reddit' });
  for (const t of tweets) allTexts.push({ text: t.text.toLowerCase(), score: t.sentimentScore, source: 'twitter' });
  for (const n of newsArticles) allTexts.push({ text: (n.title + ' ' + n.description).toLowerCase(), score: n.sentimentScore, source: 'news' });

  const topicStats = TOPIC_DEFS.map(def => {
    let mentions = 0;
    let totalScore = 0;
    const sources = new Set<'reddit' | 'twitter' | 'news'>();

    for (const item of allTexts) {
      if (def.keywords.some(kw => item.text.includes(kw))) {
        mentions++;
        totalScore += item.score;
        sources.add(item.source);
      }
    }

    const avgScore = mentions > 0 ? totalScore / mentions : 0;
    return {
      topic: def.topic,
      mentions,
      sentiment: (avgScore > 0.1 ? 'bullish' : avgScore < -0.1 ? 'bearish' : 'neutral') as 'bullish' | 'bearish' | 'neutral',
      sentimentScore: Number(avgScore.toFixed(2)),
      relatedTickers: def.tickers,
      sources: [...sources] as ('reddit' | 'twitter' | 'news')[],
      trend: (mentions >= 8 ? 'rising' : mentions >= 3 ? 'stable' : 'falling') as 'rising' | 'falling' | 'stable',
    };
  });

  // Return topics with at least 1 mention, sorted by mentions desc
  return topicStats
    .filter(t => t.mentions > 0)
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 8);
}

function generateInsights(
  bullish: StockSignal[],
  bearish: StockSignal[],
  topics: TrendingTopic[],
  marketSentiment: number,
  locale: string = 'en',
): string[] {
  const insights: string[] = [];
  const isZh = locale === 'zh';

  // Actionable bullish insight with real prices
  if (bullish.length > 0) {
    const top = bullish[0];
    const entry = top.entryPrice
      ? (isZh ? `入場 $${top.entryPrice}` : `Entry $${top.entryPrice}`)
      : (isZh ? `現價 $${top.currentPrice.toFixed(2)}` : `Now $${top.currentPrice.toFixed(2)}`);
    const target = top.exitTarget ? (isZh ? ` → 目標 $${top.exitTarget}` : ` → Target $${top.exitTarget}`) : '';
    const stop = top.stopLoss ? (isZh ? ` | 止損 $${top.stopLoss}` : ` | Stop $${top.stopLoss}`) : '';
    insights.push(isZh
      ? `${top.ticker} (${top.confidence}% 信心): ${entry}${target}${stop}。${top.reasons[0] || ''}`
      : `${top.ticker} (${top.confidence}% confidence): ${entry}${target}${stop}. ${top.reasons[0] || ''}`);
  }

  // Bearish warning with specific level
  if (bearish.length > 0) {
    const bear = bearish[0];
    const price = bear.currentPrice > 0 ? ` ($${bear.currentPrice.toFixed(2)}, ${bear.priceChangePercent > 0 ? '+' : ''}${bear.priceChangePercent.toFixed(1)}%)` : '';
    insights.push(isZh
      ? `⚠️ ${bear.ticker}${price} 出現看空信號 — ${bear.reasons[0] || '注意下行風險'}`
      : `⚠️ ${bear.ticker}${price} flashing bearish signals — ${bear.reasons[0] || 'watch downside risk'}`);
  }

  // Second bullish pick
  if (bullish.length > 1) {
    const s = bullish[1];
    const rr = s.riskReward || '';
    const confPart = rr ? `R:R ${rr}` : (isZh ? `信心 ${s.confidence}%` : `confidence ${s.confidence}%`);
    insights.push(`${s.ticker} $${s.currentPrice.toFixed(2)} ${s.priceChangePercent >= 0 ? '▲' : '▼'}${Math.abs(s.priceChangePercent).toFixed(1)}% — ${confPart}${s.reasons[0] ? '. ' + s.reasons[0] : ''}`);
  }

  // Sentiment context with actionable framing
  if (marketSentiment > 0.3) {
    insights.push(isZh
      ? `市場貪婪指標偏高 (${(marketSentiment * 100).toFixed(0)}) — 已延伸的持倉考慮部分獲利`
      : `Market greed running hot (${(marketSentiment * 100).toFixed(0)}) — consider taking partial profits on extended positions`);
  } else if (marketSentiment < -0.3) {
    insights.push(isZh
      ? `市場恐慌指標偏高 (${(marketSentiment * 100).toFixed(0)}) — 逢低布局優質標的`
      : `Fear elevated (${(marketSentiment * 100).toFixed(0)}) — accumulate quality names on weakness`);
  }

  return insights.slice(0, 4);
}

/**
 * Compute Fear & Greed score (0-100) from market sentiment signals.
 * Factors: overall sentiment, VIX level, bullish vs bearish ratio, momentum.
 */
export function computeFearGreed(
  sentimentScore: number,
  vixValue: number,
  bullishCount: number,
  bearishCount: number,
): number {
  // Sentiment component (0-25): sentimentScore ranges -1 to 1
  const sentimentPart = ((sentimentScore + 1) / 2) * 25;

  // VIX component (0-25): low VIX = greed, high VIX = fear
  const vixNorm = vixValue > 0 ? Math.max(0, Math.min(1, 1 - (vixValue - 12) / 30)) : 0.5;
  const vixPart = vixNorm * 25;

  // Bull/Bear ratio component (0-25)
  const total = bullishCount + bearishCount || 1;
  const bullRatio = bullishCount / total;
  const ratioPart = bullRatio * 25;

  // Momentum component (0-25): derived from sentiment strength
  const momentumPart = Math.abs(sentimentScore) * 25 * (sentimentScore > 0 ? 1 : 0.3);

  return Math.round(Math.max(0, Math.min(100, sentimentPart + vixPart + ratioPart + momentumPart)));
}

export function getMarketOverview(): MarketOverview {
  return {
    sp500: { name: 'S&P 500', value: 0, change: 0, changePercent: 0 },
    nasdaq: { name: 'NASDAQ', value: 0, change: 0, changePercent: 0 },
    dowJones: { name: 'Dow Jones', value: 0, change: 0, changePercent: 0 },
    vix: { name: 'VIX', value: 0, change: 0, changePercent: 0 },
    fearGreedIndex: 50,
    marketStatus: 'open',
    lastUpdated: new Date().toISOString(),
  };
}
