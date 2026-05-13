'use client';

import { useState, useEffect, useRef } from 'react';
import { MarketOverview as MarketOverviewType } from '@/lib/types';
import { formatPercent, cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Gauge, BarChart3 } from 'lucide-react';

interface MarketOverviewProps {
  data: MarketOverviewType;
}

function useCountUp(target: number, duration = 800, decimals = 2) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number>();

  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration]);

  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function AnimatedIndex({ value, name, isPositive, isVix, change, changePercent, icon: Icon, delay }: {
  value: number; name: string; isPositive: boolean; isVix: boolean;
  change: number; changePercent: number; icon: typeof BarChart3; delay: number;
}) {
  const displayValue = useCountUp(value, 900 + delay);
  const goodColor = isVix ? !isPositive : isPositive;

  return (
    <div className={cn(
      'stat-card animate-slide-up group cursor-default',
      'hover:border-jarvis-gray-700/60 hover:bg-jarvis-dark/95 transition-all duration-300',
    )} style={{ animationDelay: `${delay}ms`, animationFillMode: 'both' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-[0.15em] text-jarvis-gray-500 font-mono">
          {name}
        </span>
        <Icon className={cn(
          'w-3.5 h-3.5 transition-transform duration-300 group-hover:scale-125',
          goodColor ? 'text-jarvis-green' : 'text-jarvis-red'
        )} />
      </div>
      <div className="text-xl font-semibold text-jarvis-white font-mono tracking-tight">
        {displayValue}
      </div>
      <div className={cn(
        'text-xs font-mono mt-1 flex items-center gap-1',
        goodColor ? 'text-jarvis-green' : 'text-jarvis-red'
      )}>
        {isPositive ? (
          <TrendingUp className="w-3 h-3" />
        ) : (
          <TrendingDown className="w-3 h-3" />
        )}
        <span>{isPositive ? '+' : ''}{change.toFixed(2)} ({formatPercent(changePercent)})</span>
      </div>
    </div>
  );
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
          <AnimatedIndex
            key={index.name}
            value={index.value}
            name={index.name}
            isPositive={isPositive}
            isVix={isVix}
            change={index.change}
            changePercent={index.changePercent}
            icon={index.icon}
            delay={i * 100}
          />
        );
      })}

      {/* Fear & Greed */}
      <FearGreedGauge value={data.fearGreedIndex} marketStatus={data.marketStatus} />
    </div>
  );
}

function FearGreedGauge({ value, marketStatus }: { value: number; marketStatus: string }) {
  const [gaugeWidth, setGaugeWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setGaugeWidth(value), 200);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="col-span-2 lg:col-span-4 stat-card animate-slide-up group" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
      <div className="flex items-center justify-between">
        <div>
          <span className="section-title">Fear &amp; Greed Index</span>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-2xl font-bold font-mono text-jarvis-white">{value}</span>
            <span className={cn(
              'text-sm font-medium px-2 py-0.5 rounded-lg',
              value >= 70 ? 'text-jarvis-green bg-jarvis-green/10' :
              value >= 40 ? 'text-jarvis-yellow bg-jarvis-yellow/10' : 'text-jarvis-red bg-jarvis-red/10'
            )}>
              {value >= 75 ? 'Extreme Greed' :
               value >= 55 ? 'Greed' :
               value >= 45 ? 'Neutral' :
               value >= 25 ? 'Fear' : 'Extreme Fear'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-2 h-2 rounded-full',
            marketStatus === 'open' ? 'bg-jarvis-green animate-pulse-slow' : 'bg-jarvis-gray-600'
          )} />
          <span className="text-xs font-mono text-jarvis-gray-400 uppercase">
            Market {marketStatus}
          </span>
        </div>
      </div>
      {/* Animated gauge bar */}
      <div className="mt-3 h-2 bg-jarvis-gray-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-jarvis-red via-jarvis-yellow to-jarvis-green transition-all duration-1000 ease-out"
          style={{ width: `${gaugeWidth}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-xs font-mono text-jarvis-gray-600">EXTREME FEAR</span>
        <span className="text-xs font-mono text-jarvis-gray-600">EXTREME GREED</span>
      </div>
    </div>
  );
}
