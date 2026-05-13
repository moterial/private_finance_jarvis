// ============ Anomaly Detection Service ============

import { StockSignal, RedditPost, Tweet, NewsArticle, TrendingTopic } from '../types';

export interface Anomaly {
  id: string;
  type: 'volume_spike' | 'sentiment_divergence' | 'social_surge' | 'price_gap' | 'put_call_skew' | 'unusual_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  ticker: string;
  title: string;
  description: string;
  detectedAt: string;
  metrics: Record<string, number | string>;
  actionable: boolean;
}

export function detectAnomalies(
  signals: StockSignal[],
  redditPosts: RedditPost[],
  tweets: Tweet[],
  news: NewsArticle[],
  topics: TrendingTopic[],
): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const now = new Date().toISOString();

  // 1. Social Surge Detection — ticker suddenly mentioned much more than usual
  const tickerMentions = new Map<string, { reddit: number; twitter: number; news: number }>();
  for (const post of redditPosts) {
    for (const t of post.tickers) {
      const existing = tickerMentions.get(t) || { reddit: 0, twitter: 0, news: 0 };
      existing.reddit++;
      tickerMentions.set(t, existing);
    }
  }
  for (const tweet of tweets) {
    for (const t of tweet.tickers) {
      const existing = tickerMentions.get(t) || { reddit: 0, twitter: 0, news: 0 };
      existing.twitter++;
      tickerMentions.set(t, existing);
    }
  }
  for (const article of news) {
    for (const t of article.tickers) {
      const existing = tickerMentions.get(t) || { reddit: 0, twitter: 0, news: 0 };
      existing.news++;
      tickerMentions.set(t, existing);
    }
  }

  // Find tickers with unusually high mention counts
  const avgMentions = tickerMentions.size > 0
    ? [...tickerMentions.values()].reduce((sum, m) => sum + m.reddit + m.twitter + m.news, 0) / tickerMentions.size
    : 0;

  for (const [ticker, mentions] of tickerMentions) {
    const total = mentions.reddit + mentions.twitter + mentions.news;
    if (total > avgMentions * 3 && total >= 5) {
      anomalies.push({
        id: `social-surge-${ticker}`,
        type: 'social_surge',
        severity: total > avgMentions * 5 ? 'critical' : total > avgMentions * 4 ? 'high' : 'medium',
        ticker,
        title: `Social surge: ${ticker}`,
        description: `${ticker} is being mentioned ${(total / Math.max(avgMentions, 1)).toFixed(1)}x more than average across platforms (Reddit: ${mentions.reddit}, X: ${mentions.twitter}, News: ${mentions.news})`,
        detectedAt: now,
        metrics: { totalMentions: total, avgMentions: Math.round(avgMentions), reddit: mentions.reddit, twitter: mentions.twitter, news: mentions.news },
        actionable: true,
      });
    }
  }

  // 2. Sentiment Divergence — price going up but sentiment is bearish (or vice versa)
  for (const signal of signals) {
    const priceBullish = signal.priceChangePercent > 2;
    const priceBearish = signal.priceChangePercent < -2;
    const sentimentBullish = signal.sentiment === 'bullish';
    const sentimentBearish = signal.sentiment === 'bearish';

    if (priceBullish && sentimentBearish) {
      anomalies.push({
        id: `div-${signal.ticker}-bull-price-bear-sent`,
        type: 'sentiment_divergence',
        severity: Math.abs(signal.priceChangePercent) > 5 ? 'high' : 'medium',
        ticker: signal.ticker,
        title: `Divergence: ${signal.ticker} price \u2191 but sentiment \u2193`,
        description: `${signal.ticker} is up ${signal.priceChangePercent.toFixed(1)}% but social/news sentiment is bearish. This divergence often precedes a reversal.`,
        detectedAt: now,
        metrics: { priceChange: signal.priceChangePercent, sentiment: signal.sentiment, confidence: signal.confidence },
        actionable: true,
      });
    } else if (priceBearish && sentimentBullish) {
      anomalies.push({
        id: `div-${signal.ticker}-bear-price-bull-sent`,
        type: 'sentiment_divergence',
        severity: Math.abs(signal.priceChangePercent) > 5 ? 'high' : 'medium',
        ticker: signal.ticker,
        title: `Divergence: ${signal.ticker} price \u2193 but sentiment \u2191`,
        description: `${signal.ticker} is down ${Math.abs(signal.priceChangePercent).toFixed(1)}% but social/news sentiment is bullish. Potential buying opportunity if fundamentals support.`,
        detectedAt: now,
        metrics: { priceChange: signal.priceChangePercent, sentiment: signal.sentiment, confidence: signal.confidence },
        actionable: true,
      });
    }
  }

  // 3. Volume Spike — unusually high volume
  const avgVolume = signals.length > 0
    ? signals.reduce((sum, s) => sum + s.volume, 0) / signals.length
    : 0;

  for (const signal of signals) {
    if (signal.volume > avgVolume * 3 && signal.volume > 1000000) {
      anomalies.push({
        id: `vol-spike-${signal.ticker}`,
        type: 'volume_spike',
        severity: signal.volume > avgVolume * 5 ? 'high' : 'medium',
        ticker: signal.ticker,
        title: `Volume spike: ${signal.ticker}`,
        description: `${signal.ticker} trading at ${(signal.volume / Math.max(avgVolume, 1)).toFixed(1)}x average volume (${(signal.volume / 1e6).toFixed(1)}M shares). Often signals institutional activity.`,
        detectedAt: now,
        metrics: { volume: signal.volume, avgVolume: Math.round(avgVolume), multiplier: parseFloat((signal.volume / Math.max(avgVolume, 1)).toFixed(1)) },
        actionable: true,
      });
    }
  }

  // 4. Price Gap — large price moves
  for (const signal of signals) {
    if (Math.abs(signal.priceChangePercent) > 5) {
      anomalies.push({
        id: `gap-${signal.ticker}`,
        type: 'price_gap',
        severity: Math.abs(signal.priceChangePercent) > 10 ? 'critical' : 'high',
        ticker: signal.ticker,
        title: `Price gap: ${signal.ticker} ${signal.priceChangePercent > 0 ? '\u2191' : '\u2193'}${Math.abs(signal.priceChangePercent).toFixed(1)}%`,
        description: `${signal.ticker} moved ${signal.priceChangePercent > 0 ? 'up' : 'down'} ${Math.abs(signal.priceChangePercent).toFixed(1)}% ($${signal.currentPrice}). Large moves often indicate catalysts or breaking news.`,
        detectedAt: now,
        metrics: { priceChange: signal.priceChangePercent, price: signal.currentPrice },
        actionable: true,
      });
    }
  }

  // 5. Trending Topic Anomalies — rapidly rising topics
  for (const topic of topics) {
    if (topic.trend === 'rising' && topic.mentions > 10) {
      const relatedSignals = signals.filter(s => topic.relatedTickers.includes(s.ticker));
      if (relatedSignals.length > 0) {
        anomalies.push({
          id: `trend-${topic.topic}`,
          type: 'unusual_activity',
          severity: topic.mentions > 30 ? 'high' : 'medium',
          ticker: topic.relatedTickers[0] || 'MARKET',
          title: `Trending: "${topic.topic}" (${topic.sentiment})`,
          description: `"${topic.topic}" is trending with ${topic.mentions} mentions (${topic.sentiment}). Related: ${topic.relatedTickers.join(', ')}`,
          detectedAt: now,
          metrics: { mentions: topic.mentions, sentiment: topic.sentiment, relatedCount: topic.relatedTickers.length },
          actionable: topic.relatedTickers.length > 0,
        });
      }
    }
  }

  // Sort by severity then time
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
