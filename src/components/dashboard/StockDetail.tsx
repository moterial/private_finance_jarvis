'use client';

import { StockSignal } from '@/lib/types';
import { cn, formatPrice, formatPercent, getSentimentColor, getConfidenceColor, timeAgo } from '@/lib/utils';
import { X, TrendingUp, TrendingDown, BarChart2, Users, Newspaper, ExternalLink } from 'lucide-react';

interface StockDetailProps {
  signal: StockSignal;
  onClose: () => void;
}

export default function StockDetail({ signal, onClose }: StockDetailProps) {
  const isUp = signal.direction === 'up';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-jarvis-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg glass-panel p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-jarvis-gray-800 text-jarvis-gray-500 hover:text-jarvis-white transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            isUp ? 'bg-jarvis-green/10 border border-jarvis-green/20' : 'bg-jarvis-red/10 border border-jarvis-red/20'
          )}>
            {isUp ? (
              <TrendingUp className="w-6 h-6 text-jarvis-green" />
            ) : (
              <TrendingDown className="w-6 h-6 text-jarvis-red" />
            )}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-jarvis-white font-mono">{signal.ticker}</h2>
            <p className="text-sm text-jarvis-gray-400">{signal.name}</p>
          </div>
        </div>

        {/* Price & Change */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="stat-card">
            <span className="text-xs uppercase tracking-wider text-jarvis-gray-500 block mb-1">Price</span>
            <span className="text-xl font-bold font-mono text-jarvis-white">{formatPrice(signal.currentPrice)}</span>
          </div>
          <div className="stat-card">
            <span className="text-xs uppercase tracking-wider text-jarvis-gray-500 block mb-1">Change</span>
            <span className={cn('text-xl font-bold font-mono', isUp ? 'ticker-up' : 'ticker-down')}>
              {formatPercent(signal.priceChangePercent)}
            </span>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="text-center p-3 rounded-lg bg-jarvis-darker/50 border border-jarvis-gray-800/30">
            <span className="text-xs uppercase tracking-wider text-jarvis-gray-500 block mb-1">Confidence</span>
            <span className={cn('text-lg font-bold font-mono', getConfidenceColor(signal.confidence))}>
              {signal.confidence}%
            </span>
          </div>
          <div className="text-center p-3 rounded-lg bg-jarvis-darker/50 border border-jarvis-gray-800/30">
            <span className="text-xs uppercase tracking-wider text-jarvis-gray-500 block mb-1">Signal</span>
            <span className={cn(
              'text-sm font-bold font-mono uppercase',
              signal.signalStrength === 'strong' ? (isUp ? 'text-jarvis-green' : 'text-jarvis-red') :
              signal.signalStrength === 'moderate' ? 'text-jarvis-yellow' : 'text-jarvis-gray-400'
            )}>
              {signal.signalStrength}
            </span>
          </div>
          <div className="text-center p-3 rounded-lg bg-jarvis-darker/50 border border-jarvis-gray-800/30">
            <span className="text-xs uppercase tracking-wider text-jarvis-gray-500 block mb-1">Sentiment</span>
            <span className={cn('text-sm font-bold font-mono uppercase', getSentimentColor(signal.sentiment))}>
              {signal.sentiment}
            </span>
          </div>
        </div>

        {/* Source breakdown */}
        <div className="mb-6">
          <h4 className="section-title mb-3">Source Analysis</h4>
          <div className="space-y-2">
            {signal.sources.map(src => (
              <div key={src.source} className="p-3 rounded-lg bg-jarvis-darker/30 border border-jarvis-gray-800/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {src.source === 'reddit' && <Users className="w-3.5 h-3.5 text-orange-400" />}
                    {src.source === 'twitter' && <BarChart2 className="w-3.5 h-3.5 text-blue-400" />}
                    {src.source === 'news' && <Newspaper className="w-3.5 h-3.5 text-jarvis-accent" />}
                    <span className="text-xs font-semibold text-jarvis-gray-300 capitalize">{src.source}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-jarvis-gray-500">{src.count} mentions</span>
                    <span className={cn('text-xs font-mono uppercase', getSentimentColor(src.sentiment))}>
                      {src.sentiment}
                    </span>
                  </div>
                </div>
                {src.highlights.slice(0, 2).map((h, i) => (
                  <p key={i} className="text-sm text-jarvis-gray-500 line-clamp-1 mt-1">{"\u2022"} {h}</p>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Reasons */}
        <div className="mb-6">
          <h4 className="section-title mb-3">Key Drivers</h4>
          <div className="space-y-1.5">
            {signal.reasons.map((reason, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className={cn(
                  'w-1 h-1 rounded-full mt-1.5 flex-shrink-0',
                  isUp ? 'bg-jarvis-green' : 'bg-jarvis-red'
                )} />
                <span className="text-xs text-jarvis-gray-400 leading-relaxed">{reason}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center justify-between pt-3 border-t border-jarvis-gray-800/30">
          <div className="flex items-center gap-4 text-xs font-mono text-jarvis-gray-600">
            <span>Sector: {signal.sector}</span>
            <span>MCap: {signal.marketCap}</span>
          </div>
          <span className="text-xs font-mono text-jarvis-gray-600">
            Updated: {timeAgo(signal.lastUpdated)}
          </span>
        </div>
      </div>
    </div>
  );
}
