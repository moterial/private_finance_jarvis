'use client';

import { StockSignal } from '@/lib/types';
import { cn, formatPrice, formatPercent, getConfidenceColor, formatNumber } from '@/lib/utils';
import { TrendingUp, TrendingDown, ChevronRight, BarChart2, Users, Newspaper } from 'lucide-react';

interface StockCardProps {
  signal: StockSignal;
  rank: number;
  onClick?: () => void;
}

export default function StockCard({ signal, rank, onClick }: StockCardProps) {
  const isUp = signal.direction === 'up';

  return (
    <div
      onClick={onClick}
      className={cn(
        'glass-panel-hover p-4 cursor-pointer group relative',
        isUp ? 'hover:shadow-[0_0_20px_rgba(0,255,136,0.05)]' : 'hover:shadow-[0_0_20px_rgba(255,51,102,0.05)]'
      )}
    >
      {/* Top accent line */}
      <div className={cn(
        'absolute top-0 left-0 right-0 h-[1px]',
        isUp ? 'bg-gradient-to-r from-transparent via-jarvis-green/40 to-transparent' :
               'bg-gradient-to-r from-transparent via-jarvis-red/40 to-transparent'
      )} />

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold font-mono',
            isUp ? 'bg-jarvis-green/10 text-jarvis-green border border-jarvis-green/20' :
                   'bg-jarvis-red/10 text-jarvis-red border border-jarvis-red/20'
          )}>
            #{rank}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-jarvis-white text-lg font-mono">{signal.ticker}</span>
              {isUp ? (
                <TrendingUp className="w-4 h-4 text-jarvis-green" />
              ) : (
                <TrendingDown className="w-4 h-4 text-jarvis-red" />
              )}
            </div>
            <span className="text-xs text-jarvis-gray-500 block">{signal.name}</span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-mono text-jarvis-white">{formatPrice(signal.currentPrice)}</div>
          <div className={cn(
            'text-xs font-mono',
            isUp ? 'text-jarvis-green' : 'text-jarvis-red'
          )}>
            {isUp ? '+' : ''}{signal.priceChange} ({formatPercent(signal.priceChangePercent)})
          </div>
        </div>
      </div>

      {/* Confidence & Signal */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase tracking-wider text-jarvis-gray-500">Confidence</span>
            <span className={cn('text-xs font-mono font-bold', getConfidenceColor(signal.confidence))}>
              {signal.confidence}%
            </span>
          </div>
          <div className="h-1 bg-jarvis-gray-800 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-1000',
                signal.confidence >= 80 ? 'bg-jarvis-green' :
                signal.confidence >= 60 ? 'bg-jarvis-accent' :
                signal.confidence >= 40 ? 'bg-jarvis-yellow' : 'bg-jarvis-red'
              )}
              style={{ width: `${signal.confidence}%` }}
            />
          </div>
        </div>

        <div className={cn(
          'px-2 py-0.5 rounded text-xs font-mono uppercase tracking-wider border',
          signal.signalStrength === 'strong'
            ? (isUp ? 'bg-jarvis-green/10 text-jarvis-green border-jarvis-green/20' : 'bg-jarvis-red/10 text-jarvis-red border-jarvis-red/20')
            : signal.signalStrength === 'moderate'
            ? 'bg-jarvis-yellow/10 text-jarvis-yellow border-jarvis-yellow/20'
            : 'bg-jarvis-gray-800 text-jarvis-gray-400 border-jarvis-gray-700'
        )}>
          {signal.signalStrength}
        </div>
      </div>

      {/* Source indicators */}
      <div className="flex items-center gap-3 mb-3">
        {signal.sources.map(src => (
          <div key={src.source} className="flex items-center gap-1">
            {src.source === 'reddit' && <Users className="w-3 h-3 text-jarvis-gray-500" />}
            {src.source === 'twitter' && <BarChart2 className="w-3 h-3 text-jarvis-gray-500" />}
            {src.source === 'news' && <Newspaper className="w-3 h-3 text-jarvis-gray-500" />}
            <span className="text-xs font-mono text-jarvis-gray-500">{src.count}</span>
          </div>
        ))}
        <span className="text-xs text-jarvis-gray-600 ml-auto">
          Vol: {formatNumber(signal.volume)} · MCap: {signal.marketCap}
        </span>
      </div>

      {/* Key reason */}
      {signal.reasons[0] && (
        <p className="text-sm text-jarvis-gray-400 line-clamp-2 leading-relaxed">
          {signal.reasons[0]}
        </p>
      )}

      {/* Hover indicator */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4 text-jarvis-gray-600" />
      </div>
    </div>
  );
}
