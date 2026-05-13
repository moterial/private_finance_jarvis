'use client';

import { useI18n } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import {
  Zap, Clock, Calendar, TrendingUp, TrendingDown, Target,
  AlertTriangle, PieChart, ArrowRight, Crosshair, Lightbulb,
  ChevronRight, Shield, Rocket,
} from 'lucide-react';

interface StrategyPlan {
  shortTerm: { title: string; actions: string[]; timeframe: string };
  midTerm: { title: string; actions: string[]; timeframe: string };
  longTerm: { title: string; actions: string[]; timeframe: string };
  catalysts: { event: string; expectedDate: string; impact: string; affectedTickers: string[] }[];
  portfolioAllocation: { category: string; percentage: number; reasoning: string }[];
  bottomLine: string;
}

interface StrategyPanelProps {
  strategy: StrategyPlan | null;
  loading?: boolean;
}

const ALLOCATION_COLORS = [
  'bg-jarvis-accent',
  'bg-jarvis-green',
  'bg-jarvis-yellow',
  'bg-purple-500',
  'bg-orange-500',
  'bg-pink-500',
  'bg-cyan-500',
];

const ALLOCATION_TEXT_COLORS = [
  'text-jarvis-accent',
  'text-jarvis-green',
  'text-jarvis-yellow',
  'text-purple-400',
  'text-orange-400',
  'text-pink-400',
  'text-cyan-400',
];

export default function StrategyPanel({ strategy, loading }: StrategyPanelProps) {
  const { t } = useI18n();

  if (!strategy) {
    return (
      <div className="glass-panel p-8 text-center animate-fade-in">
        {loading ? (
          <>
            <div className="w-10 h-10 border-2 border-jarvis-accent/30 border-t-jarvis-accent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-jarvis-gray-400">AI 正在生成投資策略...</p>
            <p className="text-xs text-jarvis-gray-600 mt-1">Generating investment strategy, please wait...</p>
          </>
        ) : (
          <>
            <Lightbulb className="w-10 h-10 text-jarvis-gray-600 mx-auto mb-3" />
            <p className="text-sm text-jarvis-gray-500">{t('strategy.noData')}</p>
            <p className="text-xs text-jarvis-gray-600 mt-1">{t('strategy.noDataHint')}</p>
          </>
        )}
      </div>
    );
  }

  const timeframes = [
    {
      key: 'short',
      data: strategy.shortTerm,
      icon: Zap,
      color: 'jarvis-accent',
      borderColor: 'border-jarvis-accent/20',
      bgColor: 'bg-jarvis-accent/5',
      iconBg: 'bg-jarvis-accent/10',
      label: t('strategy.shortTerm'),
    },
    {
      key: 'mid',
      data: strategy.midTerm,
      icon: Clock,
      color: 'jarvis-yellow',
      borderColor: 'border-jarvis-yellow/20',
      bgColor: 'bg-jarvis-yellow/5',
      iconBg: 'bg-jarvis-yellow/10',
      label: t('strategy.midTerm'),
    },
    {
      key: 'long',
      data: strategy.longTerm,
      icon: Calendar,
      color: 'purple-400',
      borderColor: 'border-purple-400/20',
      bgColor: 'bg-purple-400/5',
      iconBg: 'bg-purple-400/10',
      label: t('strategy.longTerm'),
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Bottom Line - Hero Section */}
      <div className="glass-panel p-6 border-jarvis-accent/20 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-jarvis-accent via-jarvis-green to-purple-500" />
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-jarvis-accent/10 border border-jarvis-accent/20 flex-shrink-0">
            <Crosshair className="w-6 h-6 text-jarvis-accent" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-jarvis-white mb-1">{t('strategy.bottomLine')}</h2>
            <p className="text-sm text-jarvis-gray-200 leading-[1.8]">{strategy.bottomLine}</p>
          </div>
        </div>
      </div>

      {/* Timeframe Strategy Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {timeframes.map(tf => (
          <div key={tf.key} className={cn('glass-panel p-5 border', tf.borderColor)}>
            <div className="flex items-center gap-3 mb-4">
              <div className={cn('p-2 rounded-lg border', tf.iconBg, tf.borderColor)}>
                <tf.icon className={cn('w-4 h-4', `text-${tf.color}`)} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-jarvis-white">{tf.label}</h3>
                <span className="text-xs font-mono text-jarvis-gray-500">{tf.data.timeframe}</span>
              </div>
            </div>
            <p className={cn('text-xs font-medium mb-3 leading-relaxed', `text-${tf.color}`)}>{tf.data.title}</p>
            <div className="space-y-2.5">
              {tf.data.actions.map((action, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className={cn('w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-bold', tf.bgColor, `text-${tf.color}`)}>
                    {i + 1}
                  </div>
                  <span className="text-sm text-jarvis-gray-300 leading-relaxed">{action}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Catalysts & Allocation Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Upcoming Catalysts */}
        <div className="glass-panel p-5">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-jarvis-gray-800/50">
            <div className="p-2 rounded-lg bg-jarvis-yellow/10 border border-jarvis-yellow/20">
              <Rocket className="w-4 h-4 text-jarvis-yellow" />
            </div>
            <h3 className="text-sm font-semibold text-jarvis-white">{t('strategy.catalysts')}</h3>
          </div>
          <div className="space-y-3">
            {strategy.catalysts.map((cat, i) => (
              <div key={i} className="p-3 rounded-lg bg-jarvis-darker/40 border border-jarvis-gray-800/30">
                <div className="flex items-center gap-2 mb-1.5">
                  {cat.impact === 'bullish' ? (
                    <TrendingUp className="w-3.5 h-3.5 text-jarvis-green flex-shrink-0" />
                  ) : cat.impact === 'bearish' ? (
                    <TrendingDown className="w-3.5 h-3.5 text-jarvis-red flex-shrink-0" />
                  ) : (
                    <Target className="w-3.5 h-3.5 text-jarvis-gray-500 flex-shrink-0" />
                  )}
                  <span className="text-sm text-jarvis-gray-200 font-medium flex-1">{cat.event}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-mono text-jarvis-gray-500">
                    <Clock className="w-3 h-3 inline mr-1" />{cat.expectedDate}
                  </span>
                  <div className="flex gap-1">
                    {cat.affectedTickers.map(t => (
                      <span key={t} className={cn(
                        'text-[10px] font-mono px-1.5 py-0.5 rounded',
                        cat.impact === 'bullish' ? 'bg-jarvis-green/10 text-jarvis-green' :
                        cat.impact === 'bearish' ? 'bg-jarvis-red/10 text-jarvis-red' :
                        'bg-jarvis-gray-800 text-jarvis-gray-400'
                      )}>{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Portfolio Allocation */}
        <div className="glass-panel p-5">
          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-jarvis-gray-800/50">
            <div className="p-2 rounded-lg bg-jarvis-green/10 border border-jarvis-green/20">
              <PieChart className="w-4 h-4 text-jarvis-green" />
            </div>
            <h3 className="text-sm font-semibold text-jarvis-white">{t('strategy.allocation')}</h3>
          </div>

          {/* Visual bar */}
          <div className="flex h-4 rounded-full overflow-hidden mb-4 border border-jarvis-gray-800/50">
            {strategy.portfolioAllocation.map((alloc, i) => (
              <div
                key={i}
                className={cn(ALLOCATION_COLORS[i % ALLOCATION_COLORS.length], 'transition-all relative group')}
                style={{ width: `${alloc.percentage}%` }}
                title={`${alloc.category}: ${alloc.percentage}%`}
              />
            ))}
          </div>

          {/* Details */}
          <div className="space-y-3">
            {strategy.portfolioAllocation.map((alloc, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={cn('w-3 h-3 rounded-full mt-1 flex-shrink-0', ALLOCATION_COLORS[i % ALLOCATION_COLORS.length])} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={cn('text-sm font-medium', ALLOCATION_TEXT_COLORS[i % ALLOCATION_TEXT_COLORS.length])}>{alloc.category}</span>
                    <span className="text-sm font-mono font-bold text-jarvis-white">{alloc.percentage}%</span>
                  </div>
                  <p className="text-xs text-jarvis-gray-500 leading-relaxed">{alloc.reasoning}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
