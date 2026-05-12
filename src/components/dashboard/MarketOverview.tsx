'use client';

import { MarketOverview as MarketOverviewType } from '@/lib/types';
import { formatPercent, cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Gauge, BarChart3 } from 'lucide-react';

interface MarketOverviewProps {
  data: MarketOverviewType;
}

export default function MarketOverview({ data }: MarketOverviewProps) {
  const indices = [
    { ...data.sp500, icon: BarChart3 },
    { ...data.nasdaq, icon: TrendingUp },
    { ...data.dowJones, icon: TrendingDown },
    { ...data.vix, icon: Gauge },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {indices.map((index, i) => {
        const isPositive = index.changePercent >= 0;
        const isVix = index.name === 'VIX';

        return (
          <div
            key={index.name}
            className={cn(
              'stat-card animate-slide-up',
              i === 0 && 'animation-delay-0',
              i === 1 && 'animation-delay-200',
              i === 2 && 'animation-delay-400',
              i === 3 && 'animation-delay-600',
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs uppercase tracking-[0.15em] text-jarvis-gray-500 font-mono">
                {index.name}
              </span>
              <index.icon className={cn(
                'w-3.5 h-3.5',
                isVix
                  ? (isPositive ? 'text-jarvis-red' : 'text-jarvis-green')
                  : (isPositive ? 'text-jarvis-green' : 'text-jarvis-red')
              )} />
            </div>
            <div className="text-xl font-semibold text-jarvis-white font-mono tracking-tight">
              {index.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </div>
            <div className={cn(
              'text-xs font-mono mt-1',
              isVix
                ? (isPositive ? 'text-jarvis-red' : 'text-jarvis-green')
                : (isPositive ? 'text-jarvis-green' : 'text-jarvis-red')
            )}>
              {isPositive ? '+' : ''}{index.change.toFixed(2)} ({formatPercent(index.changePercent)})
            </div>
          </div>
        );
      })}

      {/* Fear & Greed */}
      <div className="col-span-2 lg:col-span-4 stat-card animate-slide-up animation-delay-200">
        <div className="flex items-center justify-between">
          <div>
            <span className="section-title">Fear & Greed Index</span>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-2xl font-bold font-mono text-jarvis-white">{data.fearGreedIndex}</span>
              <span className={cn(
                'text-sm font-medium',
                data.fearGreedIndex >= 70 ? 'text-jarvis-green' :
                data.fearGreedIndex >= 40 ? 'text-jarvis-yellow' : 'text-jarvis-red'
              )}>
                {data.fearGreedIndex >= 75 ? 'Extreme Greed' :
                 data.fearGreedIndex >= 55 ? 'Greed' :
                 data.fearGreedIndex >= 45 ? 'Neutral' :
                 data.fearGreedIndex >= 25 ? 'Fear' : 'Extreme Fear'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-2 h-2 rounded-full',
              data.marketStatus === 'open' ? 'bg-jarvis-green animate-pulse-slow' : 'bg-jarvis-gray-600'
            )} />
            <span className="text-xs font-mono text-jarvis-gray-400 uppercase">
              Market {data.marketStatus}
            </span>
          </div>
        </div>
        {/* Gauge bar */}
        <div className="mt-3 h-1.5 bg-jarvis-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-jarvis-red via-jarvis-yellow to-jarvis-green transition-all duration-1000"
            style={{ width: `${data.fearGreedIndex}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs font-mono text-jarvis-gray-600">EXTREME FEAR</span>
          <span className="text-xs font-mono text-jarvis-gray-600">EXTREME GREED</span>
        </div>
      </div>
    </div>
  );
}
