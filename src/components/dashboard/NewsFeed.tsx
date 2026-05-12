'use client';

import { NewsArticle as NewsArticleType } from '@/lib/types';
import { cn, timeAgo, getSentimentColor, getSentimentBg } from '@/lib/utils';
import { ExternalLink, Clock } from 'lucide-react';

interface NewsFeedProps {
  articles: NewsArticleType[];
}

export default function NewsFeed({ articles }: NewsFeedProps) {
  return (
    <div className="glass-panel p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="section-title">Latest Financial News</h3>
        <span className="text-xs font-mono text-jarvis-gray-600">{articles.length} articles</span>
      </div>

      <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
        {articles.map((article, i) => (
          <a
            key={article.id}
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'block p-3 rounded-lg border border-jarvis-gray-800/50 bg-jarvis-darker/50',
              'hover:border-jarvis-gray-700 hover:bg-jarvis-dark/50 transition-all group',
              'animate-slide-up'
            )}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm text-jarvis-gray-200 font-medium leading-snug group-hover:text-jarvis-white transition-colors line-clamp-2">
                  {article.title}
                </h4>

                {article.description && (
                  <p className="text-xs text-jarvis-gray-500 mt-1 line-clamp-2 leading-relaxed">
                    {article.description}
                  </p>
                )}

                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs font-mono text-jarvis-accent">{article.source}</span>
                  <div className="flex items-center gap-1 text-jarvis-gray-600">
                    <Clock className="w-2.5 h-2.5" />
                    <span className="text-xs font-mono">{timeAgo(article.publishedAt)}</span>
                  </div>

                  {article.tickers.length > 0 && (
                    <div className="flex items-center gap-1">
                      {article.tickers.slice(0, 3).map(ticker => (
                        <span
                          key={ticker}
                          className="text-xs font-mono px-1.5 py-0.5 rounded bg-jarvis-gray-800 text-jarvis-gray-300 border border-jarvis-gray-700/50"
                        >
                          ${ticker}
                        </span>
                      ))}
                    </div>
                  )}

                  <span className={cn(
                    'text-xs font-mono uppercase px-1.5 py-0.5 rounded border ml-auto',
                    getSentimentBg(article.sentiment),
                    getSentimentColor(article.sentiment)
                  )}>
                    {article.sentiment}
                  </span>
                </div>
              </div>

              <ExternalLink className="w-3.5 h-3.5 text-jarvis-gray-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5" />
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
