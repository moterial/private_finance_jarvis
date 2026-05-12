'use client';

import { TrendingTopic } from '@/lib/types';
import { cn, getSentimentColor } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Hash } from 'lucide-react';

interface TrendingTopicsProps {
  topics: TrendingTopic[];
}

export default function TrendingTopics({ topics }: TrendingTopicsProps) {
  return (
    <div className="glass-panel p-4">
      <h3 className="section-title mb-4">Trending Topics</h3>

      <div className="space-y-2">
        {topics.map((topic, i) => (
          <div
            key={topic.topic}
            className={cn(
              'p-3 rounded-lg border border-jarvis-gray-800/30 bg-jarvis-darker/30',
              'hover:bg-jarvis-dark/50 transition-all animate-slide-up'
            )}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-jarvis-accent" />
                <span className="text-sm font-medium text-jarvis-gray-200">{topic.topic}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {topic.trend === 'rising' && <TrendingUp className="w-3 h-3 text-jarvis-green" />}
                {topic.trend === 'falling' && <TrendingDown className="w-3 h-3 text-jarvis-red" />}
                {topic.trend === 'stable' && <Minus className="w-3 h-3 text-jarvis-gray-500" />}
                <span className="text-xs font-mono text-jarvis-gray-500">{topic.mentions} mentions</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {topic.relatedTickers.map(ticker => (
                <span
                  key={ticker}
                  className="text-xs font-mono px-1.5 py-0.5 rounded bg-jarvis-gray-800/80 text-jarvis-accent border border-jarvis-gray-700/30"
                >
                  ${ticker}
                </span>
              ))}

              <span className={cn(
                'text-xs font-mono uppercase ml-auto',
                getSentimentColor(topic.sentiment)
              )}>
                {topic.sentiment} ({(topic.sentimentScore * 100).toFixed(0)}%)
              </span>
            </div>

            {/* Source badges */}
            <div className="flex items-center gap-1.5 mt-2">
              {topic.sources.map(src => (
                <span
                  key={src}
                  className="text-xs font-mono px-1.5 py-0.5 rounded bg-jarvis-gray-900/50 text-jarvis-gray-500 border border-jarvis-gray-800/30"
                >
                  {src}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
