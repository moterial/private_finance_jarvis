'use client';

import { useI18n } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import { Flame, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface HeatmapData {
  ticker: string;
  mentions: number;
  sentiment: number; // -1 to 1
  sources: { reddit: number; twitter: number; news: number };
}

function buildHeatmapData(
  redditPosts: any[],
  tweets: any[],
  news: any[],
): HeatmapData[] {
  const tickerMap = new Map<string, HeatmapData>();

  const addMention = (ticker: string, source: 'reddit' | 'twitter' | 'news', sentScore: number) => {
    const existing = tickerMap.get(ticker) || {
      ticker,
      mentions: 0,
      sentiment: 0,
      sources: { reddit: 0, twitter: 0, news: 0 },
    };
    existing.mentions++;
    existing.sources[source]++;
    // Running average of sentiment
    existing.sentiment = ((existing.sentiment * (existing.mentions - 1)) + sentScore) / existing.mentions;
    tickerMap.set(ticker, existing);
  };

  for (const post of redditPosts) {
    for (const t of (post.tickers || [])) {
      addMention(t, 'reddit', post.sentimentScore || 0);
    }
  }
  for (const tweet of tweets) {
    for (const t of (tweet.tickers || [])) {
      addMention(t, 'twitter', tweet.sentimentScore || 0);
    }
  }
  for (const article of news) {
    for (const t of (article.tickers || [])) {
      addMention(t, 'news', article.sentimentScore || 0);
    }
  }

  return [...tickerMap.values()]
    .filter(d => d.mentions >= 2)
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 30);
}

function getSentimentColor(sentiment: number): string {
  if (sentiment > 0.3) return 'bg-jarvis-green/30 border-jarvis-green/40';
  if (sentiment > 0.1) return 'bg-jarvis-green/15 border-jarvis-green/25';
  if (sentiment < -0.3) return 'bg-jarvis-red/30 border-jarvis-red/40';
  if (sentiment < -0.1) return 'bg-jarvis-red/15 border-jarvis-red/25';
  return 'bg-jarvis-gray-800/50 border-jarvis-gray-700/30';
}

function getSentimentTextColor(sentiment: number): string {
  if (sentiment > 0.1) return 'text-jarvis-green';
  if (sentiment < -0.1) return 'text-jarvis-red';
  return 'text-jarvis-gray-400';
}

export default function SentimentHeatmap({ redditPosts, tweets, news }: {
  redditPosts: any[];
  tweets: any[];
  news: any[];
}) {
  const { locale } = useI18n();
  const data = buildHeatmapData(redditPosts || [], tweets || [], news || []);

  if (data.length === 0) {
    return (
      <div className="text-center py-20">
        <Flame className="w-12 h-12 text-jarvis-gray-700 mx-auto mb-4" />
        <p className="text-jarvis-gray-500 text-sm">
          {locale === 'zh' ? '\u7121\u8DB3\u5920\u6578\u64DA\u751F\u6210\u71B1\u529B\u5716' : 'Not enough data to generate heatmap'}
        </p>
      </div>
    );
  }

  const maxMentions = Math.max(...data.map(d => d.mentions));

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center gap-2 mb-4">
        <Flame className="w-5 h-5 text-jarvis-amber" />
        <h2 className="text-lg font-semibold text-jarvis-white">
          {locale === 'zh' ? '\u793E\u7FA4\u60C5\u7DD2\u71B1\u529B\u5716' : 'Social Sentiment Heatmap'}
        </h2>
        <span className="text-xs font-mono text-jarvis-gray-500">
          {data.length} {locale === 'zh' ? '\u500B\u80A1\u7968' : 'tickers'}
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs font-mono">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-jarvis-green/30 border border-jarvis-green/40" />
          <span className="text-jarvis-gray-500">{locale === 'zh' ? '\u770B\u591A' : 'Bullish'}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-jarvis-gray-800/50 border border-jarvis-gray-700/30" />
          <span className="text-jarvis-gray-500">{locale === 'zh' ? '\u4E2D\u6027' : 'Neutral'}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-jarvis-red/30 border border-jarvis-red/40" />
          <span className="text-jarvis-gray-500">{locale === 'zh' ? '\u770B\u7A7A' : 'Bearish'}</span>
        </div>
        <div className="flex items-center gap-1 ml-4">
          <span className="text-jarvis-gray-600">{locale === 'zh' ? '\u5927\u5C0F = \u63D0\u53CA\u91CF' : 'Size = Mentions'}</span>
        </div>
      </div>

      {/* Heatmap Grid — treemap-like layout */}
      <div className="flex flex-wrap gap-2">
        {data.map((item, i) => {
          const sizeRatio = item.mentions / maxMentions;
          // Scale from 80px to 180px based on mentions
          const size = Math.max(80, Math.min(180, 80 + sizeRatio * 100));
          const SentIcon = item.sentiment > 0.1 ? TrendingUp : item.sentiment < -0.1 ? TrendingDown : Minus;

          return (
            <div
              key={item.ticker}
              className={cn(
                'rounded-lg border p-3 flex flex-col justify-between transition-all hover:scale-105 cursor-default',
                getSentimentColor(item.sentiment),
              )}
              style={{ width: `${size}px`, height: `${size * 0.7}px` }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-jarvis-white">{item.ticker}</span>
                <SentIcon className={cn('w-3 h-3', getSentimentTextColor(item.sentiment))} />
              </div>
              <div>
                <div className={cn('text-xs font-mono font-bold', getSentimentTextColor(item.sentiment))}>
                  {item.sentiment > 0 ? '+' : ''}{(item.sentiment * 100).toFixed(0)}%
                </div>
                <div className="text-xs font-mono text-jarvis-gray-500">
                  {item.mentions} {locale === 'zh' ? '\u6B21' : 'mentions'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Source Breakdown */}
      <div className="glass-panel p-4">
        <h4 className="text-xs font-mono text-jarvis-gray-500 uppercase mb-3">
          {locale === 'zh' ? '\u4F86\u6E90\u5206\u4F48' : 'Source Breakdown'}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {data.slice(0, 12).map(item => (
            <div key={item.ticker} className="flex items-center gap-2 text-xs font-mono py-1">
              <span className="text-jarvis-white font-bold w-12">{item.ticker}</span>
              <div className="flex-1 flex items-center gap-1">
                <div className="bg-jarvis-amber/20 rounded px-1.5 py-0.5 text-jarvis-amber">R:{item.sources.reddit}</div>
                <div className="bg-jarvis-blue/20 rounded px-1.5 py-0.5 text-jarvis-blue">X:{item.sources.twitter}</div>
                <div className="bg-jarvis-green/20 rounded px-1.5 py-0.5 text-jarvis-green">N:{item.sources.news}</div>
              </div>
              <span className={cn('w-10 text-right', getSentimentTextColor(item.sentiment))}>
                {(item.sentiment * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
