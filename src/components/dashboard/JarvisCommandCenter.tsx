'use client';

import { useI18n } from '@/lib/i18n/context';
import { StockSignal, AnalysisReport, MarketOverview } from '@/lib/types';
import { ExpertPick } from '@/lib/types/extended';
import { cn, formatPrice } from '@/lib/utils';
import { Crosshair, TrendingUp, TrendingDown, Shield, Zap, Target } from 'lucide-react';

interface CommandCenterProps {
  analysis: AnalysisReport;
  marketOverview: MarketOverview;
  aiNarrative?: string | null;
  topPicks?: ExpertPick[];
}

export default function JarvisCommandCenter({ analysis, marketOverview, aiNarrative, topPicks }: CommandCenterProps) {
  const { locale } = useI18n();

  // Use AI expert picks if available, otherwise fall back to signal-based trades
  const topTrades = [
    ...analysis.topBullish.slice(0, 2),
    ...analysis.topBearish.slice(0, 1),
  ].sort((a, b) => b.confidence - a.confidence).slice(0, 3);

  const riskLabel = {
    low: locale === 'zh' ? '低風險' : 'LOW RISK',
    medium: locale === 'zh' ? '中等風險' : 'MEDIUM RISK',
    high: locale === 'zh' ? '高風險' : 'HIGH RISK',
    extreme: locale === 'zh' ? '極端風險' : 'EXTREME RISK',
  }[analysis.riskLevel];

  const riskColor = {
    low: 'text-green-400 border-green-400/30 bg-green-400/5',
    medium: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5',
    high: 'text-red-400 border-red-400/30 bg-red-400/5',
    extreme: 'text-red-500 border-red-500/30 bg-red-500/5',
  }[analysis.riskLevel];

  const greeting = (() => {
    const hour = new Date().getHours();
    if (locale === 'zh') {
      if (hour < 6) return '深夜市場掃描完畢';
      if (hour < 12) return '早安，今日市場掃描完畢';
      if (hour < 18) return '午安，即時市場更新';
      return '晚安，收盤分析完畢';
    }
    if (hour < 6) return 'Late night scan complete';
    if (hour < 12) return 'Good morning. Market scan complete';
    if (hour < 18) return 'Good afternoon. Live market update';
    return 'Good evening. Post-market analysis ready';
  })();

  return (
    <div className="relative mb-6 overflow-hidden rounded-xl border border-jarvis-accent/20 bg-gradient-to-br from-jarvis-dark via-jarvis-gray-900/80 to-jarvis-dark">
      {/* Background glow effects */}
      <div className="absolute inset-0 bg-gradient-to-r from-jarvis-accent/5 via-transparent to-jarvis-accent/3 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-24 bg-jarvis-accent/10 blur-3xl pointer-events-none" />

      <div className="relative p-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-jarvis-accent/20 border border-jarvis-accent/40 flex items-center justify-center animate-pulse-slow">
            <Crosshair className="w-5 h-5 text-jarvis-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-jarvis-white font-mono tracking-tight">J.A.R.V.I.S.</h2>
              <div className={cn('px-2 py-0.5 rounded-full text-[10px] font-mono border', riskColor)}>
                {riskLabel}
              </div>
            </div>
            <p className="text-xs text-jarvis-gray-400">{greeting}</p>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-jarvis-gray-500 font-mono">
              {marketOverview.marketStatus === 'open' ? '🟢 MARKET OPEN' :
               marketOverview.marketStatus === 'pre-market' ? '🟡 PRE-MARKET' :
               marketOverview.marketStatus === 'after-hours' ? '🟠 AFTER-HOURS' : '🔴 MARKET CLOSED'}
            </div>
            <div className="text-xs text-jarvis-gray-500 font-mono mt-0.5">
              Fear/Greed: <span className={cn(
                marketOverview.fearGreedIndex > 60 ? 'text-green-400' :
                marketOverview.fearGreedIndex < 40 ? 'text-red-400' : 'text-yellow-400'
              )}>{marketOverview.fearGreedIndex}</span>/100
            </div>
          </div>
        </div>

        {/* AI Narrative */}
        {aiNarrative && (
          <div className="mb-4 p-3 rounded-lg bg-jarvis-gray-900/60 border border-jarvis-gray-800/50">
            <p className="text-sm text-jarvis-gray-300 leading-relaxed italic">
              &ldquo;{aiNarrative}&rdquo;
            </p>
          </div>
        )}

        {/* Top 3 Actionable Trades */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-3.5 h-3.5 text-jarvis-accent" />
            <span className="text-xs font-mono uppercase tracking-wider text-jarvis-accent">
              {locale === 'zh' ? '今日最佳交易機會' : 'TOP TRADE SETUPS'}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {topPicks && topPicks.length > 0
              ? topPicks.slice(0, 3).map((pick, i) => (
                  <ExpertPickCard key={pick.ticker} pick={pick} rank={i + 1} locale={locale} />
                ))
              : topTrades.map((trade, i) => (
                  <TradeCard key={trade.ticker} trade={trade} rank={i + 1} locale={locale} />
                ))
            }
          </div>
        </div>

        {/* Key Insights (bullet points) */}
        {analysis.keyInsights.length > 0 && (
          <div className="flex items-start gap-2 pt-3 border-t border-jarvis-gray-800/50">
            <Zap className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" />
            <div className="text-xs text-jarvis-gray-400 space-y-0.5">
              {analysis.keyInsights.slice(0, 3).map((insight, i) => (
                <p key={i}>• {insight}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TradeCard({ trade, rank, locale }: { trade: StockSignal; rank: number; locale: string }) {
  const isUp = trade.direction === 'up';

  return (
    <div className={cn(
      'p-3 rounded-lg border transition-all duration-200 hover:scale-[1.02]',
      isUp ? 'border-green-500/20 bg-green-500/5 hover:border-green-500/40' :
             'border-red-500/20 bg-red-500/5 hover:border-red-500/40'
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-xs font-bold font-mono w-5 h-5 rounded flex items-center justify-center',
            isUp ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          )}>{rank}</span>
          <span className="text-sm font-bold font-mono text-jarvis-white">{trade.ticker}</span>
          {isUp ? <TrendingUp className="w-3 h-3 text-green-400" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
        </div>
        <span className={cn(
          'text-[10px] font-mono px-1.5 py-0.5 rounded border',
          trade.signalStrength === 'strong'
            ? (isUp ? 'text-green-400 border-green-400/30' : 'text-red-400 border-red-400/30')
            : 'text-yellow-400 border-yellow-400/30'
        )}>
          {trade.confidence}%
        </span>
      </div>

      <div className="text-xs font-mono space-y-1">
        <div className="flex justify-between">
          <span className="text-jarvis-gray-500">{locale === 'zh' ? '現價' : 'Now'}</span>
          <span className="text-jarvis-white">{formatPrice(trade.currentPrice)}</span>
        </div>
        {trade.entryPrice && (
          <div className="flex justify-between">
            <span className="text-jarvis-gray-500">{locale === 'zh' ? '入場' : 'Entry'}</span>
            <span className="text-jarvis-accent">{formatPrice(trade.entryPrice)}</span>
          </div>
        )}
        {trade.exitTarget && (
          <div className="flex justify-between">
            <span className="text-jarvis-gray-500">{locale === 'zh' ? '目標' : 'Target'}</span>
            <span className="text-green-400">{formatPrice(trade.exitTarget)}</span>
          </div>
        )}
        {trade.stopLoss && (
          <div className="flex justify-between">
            <span className="text-jarvis-gray-500">{locale === 'zh' ? '止損' : 'Stop'}</span>
            <span className="text-red-400">{formatPrice(trade.stopLoss)}</span>
          </div>
        )}
        {trade.riskReward && (
          <div className="flex justify-between pt-1 border-t border-jarvis-gray-800/50">
            <span className="text-jarvis-gray-500">R:R</span>
            <span className="text-jarvis-accent">{trade.riskReward}</span>
          </div>
        )}
      </div>

      {trade.reasons[0] && (
        <p className="text-[10px] text-jarvis-gray-500 mt-1.5 line-clamp-1">{trade.reasons[0]}</p>
      )}
    </div>
  );
}

function ExpertPickCard({ pick, rank, locale }: { pick: ExpertPick; rank: number; locale: string }) {
  const isUp = pick.action === 'strong-buy' || pick.action === 'buy';
  const actionLabel = {
    'strong-buy': locale === 'zh' ? '強力買入' : 'STRONG BUY',
    'buy': locale === 'zh' ? '買入' : 'BUY',
    'hold': locale === 'zh' ? '持有' : 'HOLD',
    'sell': locale === 'zh' ? '賣出' : 'SELL',
    'strong-sell': locale === 'zh' ? '強力賣出' : 'STRONG SELL',
  }[pick.action];

  return (
    <div className={cn(
      'p-3 rounded-lg border transition-all duration-200 hover:scale-[1.02]',
      isUp ? 'border-green-500/20 bg-green-500/5 hover:border-green-500/40' :
             pick.action === 'hold' ? 'border-yellow-500/20 bg-yellow-500/5 hover:border-yellow-500/40' :
             'border-red-500/20 bg-red-500/5 hover:border-red-500/40'
    )}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-xs font-bold font-mono w-5 h-5 rounded flex items-center justify-center',
            isUp ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
          )}>{rank}</span>
          <span className="text-sm font-bold font-mono text-jarvis-white">{pick.ticker}</span>
        </div>
        <span className={cn(
          'text-[10px] font-mono px-1.5 py-0.5 rounded border font-bold',
          isUp ? 'text-green-400 border-green-400/30 bg-green-400/10' :
          pick.action === 'hold' ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' :
          'text-red-400 border-red-400/30 bg-red-400/10'
        )}>
          {actionLabel}
        </span>
      </div>

      <div className="text-xs font-mono space-y-1">
        <div className="flex justify-between">
          <span className="text-jarvis-gray-500">{locale === 'zh' ? '入場區間' : 'Entry Zone'}</span>
          <span className="text-jarvis-accent">
            {formatPrice(pick.entryZone.low)} - {formatPrice(pick.entryZone.high)}
          </span>
        </div>
        {pick.targets.length > 0 && (
          <div className="flex justify-between">
            <span className="text-jarvis-gray-500">{locale === 'zh' ? '目標' : 'Targets'}</span>
            <span className="text-green-400">
              {pick.targets.slice(0, 2).map(t => formatPrice(t)).join(' / ')}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-jarvis-gray-500">{locale === 'zh' ? '止損' : 'Stop'}</span>
          <span className="text-red-400">{formatPrice(pick.stopLoss)}</span>
        </div>
        <div className="flex justify-between pt-1 border-t border-jarvis-gray-800/50">
          <span className="text-jarvis-gray-500">{locale === 'zh' ? '時間框架' : 'Timeframe'}</span>
          <span className="text-jarvis-gray-300">{pick.timeframe}</span>
        </div>
      </div>

      <p className="text-[10px] text-jarvis-gray-500 mt-1.5 line-clamp-2">{pick.reasoning}</p>
    </div>
  );
}
