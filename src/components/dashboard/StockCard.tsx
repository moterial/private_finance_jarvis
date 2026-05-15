'use client';

import { useState, useEffect, useRef } from 'react';
import { StockSignal } from '@/lib/types';
import { cn, formatPrice, formatPercent, getConfidenceColor } from '@/lib/utils';
import { TrendingUp, TrendingDown, ChevronRight, BarChart2, Users, Newspaper } from 'lucide-react';

interface StockCardProps {
  signal: StockSignal;
  rank: number;
  onClick?: () => void;
}

// Generate sparkline SVG path from real price data or fallback
function generateSparkline(prices?: number[], isUp?: boolean, confidence?: number): string {
  const h = 24;
  const w = 60;

  if (prices && prices.length >= 2) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const step = w / (prices.length - 1);
    return prices.map((p, i) => {
      const y = h - 2 - ((p - min) / range) * (h - 4);
      return `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  }

  // No real data — return empty (no fake chart)
  return '';
}

export default function StockCard({ signal, rank, onClick }: StockCardProps) {
  const isUp = signal.direction === 'up';
  const [barWidth, setBarWidth] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Animate confidence bar on viewport entry
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          setTimeout(() => setBarWidth(signal.confidence), 100);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [signal.confidence]);

  const sparkPath = generateSparkline(signal.sparkline, isUp, signal.confidence);
  const sparkColor = isUp ? '#00ff88' : '#ff3366';

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className={cn(
        'glass-panel p-4 cursor-pointer group relative overflow-hidden transition-all duration-300',
        'hover:border-jarvis-gray-700/80 hover:bg-jarvis-dark/90',
        'active:scale-[0.98] active:transition-transform active:duration-100',
        isUp ? 'hover:shadow-[0_0_25px_rgba(0,255,136,0.06)]' : 'hover:shadow-[0_0_25px_rgba(255,51,102,0.06)]'
      )}
    >
      {/* Top accent line */}
      <div className={cn(
        'absolute top-0 left-0 right-0 h-[1px] transition-opacity duration-300',
        isUp ? 'bg-gradient-to-r from-transparent via-jarvis-green/40 to-transparent' :
               'bg-gradient-to-r from-transparent via-jarvis-red/40 to-transparent',
        'opacity-60 group-hover:opacity-100'
      )} />

      {/* Background sparkline (subtle) */}
      <div className="absolute right-2 top-2 opacity-20 group-hover:opacity-40 transition-opacity duration-500">
        <svg width="60" height="24" viewBox="0 0 60 24" fill="none">
          <path
            d={sparkPath}
            stroke={sparkColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            className={isVisible ? 'animate-draw-line' : ''}
            strokeDasharray="200"
            strokeDashoffset={isVisible ? '0' : '200'}
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
      </div>

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold font-mono transition-transform duration-200 group-hover:scale-110',
            isUp ? 'bg-jarvis-green/10 text-jarvis-green border border-jarvis-green/20' :
                   'bg-jarvis-red/10 text-jarvis-red border border-jarvis-red/20'
          )}>
            #{rank}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-jarvis-white text-lg font-mono group-hover:text-jarvis-accent transition-colors duration-200">{signal.ticker}</span>
              {isUp ? (
                <TrendingUp className="w-4 h-4 text-jarvis-green transition-transform duration-300 group-hover:translate-y-[-2px]" />
              ) : (
                <TrendingDown className="w-4 h-4 text-jarvis-red transition-transform duration-300 group-hover:translate-y-[2px]" />
              )}
            </div>
            <span className="text-xs text-jarvis-gray-500 block">{signal.name}</span>
          </div>
        </div>

        <div className="text-right">
          <div className="text-sm font-mono text-jarvis-white">{formatPrice(signal.currentPrice)}</div>
          <div className={cn(
            'text-xs font-mono font-medium',
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
          <div className="h-1.5 bg-jarvis-gray-800 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-1000 ease-out',
                signal.confidence >= 80 ? 'bg-gradient-to-r from-jarvis-green/80 to-jarvis-green' :
                signal.confidence >= 60 ? 'bg-gradient-to-r from-jarvis-accent/80 to-jarvis-accent' :
                signal.confidence >= 40 ? 'bg-gradient-to-r from-jarvis-yellow/80 to-jarvis-yellow' : 'bg-gradient-to-r from-jarvis-red/80 to-jarvis-red'
              )}
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>

        <div className={cn(
          'px-2 py-0.5 rounded text-xs font-mono uppercase tracking-wider border transition-all duration-200',
          signal.signalStrength === 'strong'
            ? (isUp ? 'bg-jarvis-green/10 text-jarvis-green border-jarvis-green/20 group-hover:bg-jarvis-green/15' : 'bg-jarvis-red/10 text-jarvis-red border-jarvis-red/20 group-hover:bg-jarvis-red/15')
            : signal.signalStrength === 'moderate'
            ? 'bg-jarvis-yellow/10 text-jarvis-yellow border-jarvis-yellow/20 group-hover:bg-jarvis-yellow/15'
            : 'bg-jarvis-gray-800 text-jarvis-gray-400 border-jarvis-gray-700'
        )}>
          {signal.signalStrength}
        </div>
      </div>

      {/* JARVIS Trade Targets — the most important info */}
      {signal.entryPrice && signal.exitTarget && signal.stopLoss && (
        <div className={cn(
          'flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-2 px-2 py-1 rounded-md text-[11px] font-mono border',
          isUp ? 'bg-jarvis-green/5 border-jarvis-green/15' : 'bg-jarvis-red/5 border-jarvis-red/15'
        )}>
          <span className="text-jarvis-accent">入 {formatPrice(signal.entryPrice)}</span>
          <span className="text-jarvis-gray-700">→</span>
          <span className={isUp ? 'text-jarvis-green' : 'text-jarvis-red'}>目標 {formatPrice(signal.exitTarget)}</span>
          <span className="text-jarvis-gray-700">|</span>
          <span className={isUp ? 'text-jarvis-red' : 'text-jarvis-green'}>止損 {formatPrice(signal.stopLoss)}</span>
          {signal.riskReward && (
            <span className="text-jarvis-accent ml-auto">R:R {signal.riskReward}</span>
          )}
        </div>
      )}

      {/* Key reason + sources inline */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 shrink-0">
          {signal.sources.map(src => (
            <div key={src.source} className="flex items-center gap-0.5">
              {src.source === 'reddit' && <Users className="w-2.5 h-2.5 text-jarvis-gray-600" />}
              {src.source === 'twitter' && <BarChart2 className="w-2.5 h-2.5 text-jarvis-gray-600" />}
              {src.source === 'news' && <Newspaper className="w-2.5 h-2.5 text-jarvis-gray-600" />}
              <span className="text-[10px] font-mono text-jarvis-gray-600">{src.count}</span>
            </div>
          ))}
        </div>
        {signal.reasons[0] && (
          <p className="text-[11px] text-jarvis-gray-500 line-clamp-1 leading-tight">
            {signal.reasons[0]}
          </p>
        )}
      </div>

      {/* Hover indicator — slides in */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200">
        <ChevronRight className="w-4 h-4 text-jarvis-gray-500" />
      </div>
    </div>
  );
}
