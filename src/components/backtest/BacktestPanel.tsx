'use client';

import { useState, useCallback } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import { Loader2, History, TrendingUp, TrendingDown, Target, BarChart3 } from 'lucide-react';

interface BacktestResult {
  strategyName: string;
  ticker: string;
  period: string;
  trades: { date: string; action: string; price: number; reasoning: string }[];
  metrics: {
    totalReturn: number;
    winRate: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    avgWin: number;
    avgLoss: number;
    maxDrawdown: number;
    sharpeRatio: number;
    profitFactor: number;
  };
  summary: string;
}

const STRATEGIES = [
  { value: 'momentum', en: 'Momentum (RSI + MACD)', zh: '\u52D5\u80FD\u7B56\u7565 (RSI + MACD)' },
  { value: 'mean_reversion', en: 'Mean Reversion (Bollinger)', zh: '\u5747\u503C\u56DE\u6B78 (Bollinger)' },
  { value: 'breakout', en: 'Breakout (52-week High)', zh: '\u7A81\u7834\u7B56\u7565 (52\u9031\u65B0\u9AD8)' },
  { value: 'dip_buying', en: 'Buy the Dip (-5% entries)', zh: '\u9022\u8DCC\u8CB7\u5165 (-5%\u9032\u5834)' },
  { value: 'trend_following', en: 'Trend Following (MA Cross)', zh: '\u8DA8\u52E2\u8DDF\u8E64 (\u5747\u7DDA\u4EA4\u53C9)' },
];

const PERIODS = [
  { value: '3mo', label: '3M' },
  { value: '6mo', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: '2y', label: '2Y' },
];

export default function BacktestPanel() {
  const { locale } = useI18n();
  const [ticker, setTicker] = useState('');
  const [strategy, setStrategy] = useState('momentum');
  const [period, setPeriod] = useState('6mo');
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runBacktest = useCallback(async () => {
    if (!ticker.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`/api/backtest?locale=${locale}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: ticker.toUpperCase(), strategy, period }),
      });
      const json = await res.json();
      if (json.success) setResult(json.data);
      else setError(json.error || 'Failed');
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [ticker, strategy, period, locale]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Form */}
      <div className="glass-panel p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && runBacktest()}
            placeholder={locale === 'zh' ? '\u80A1\u7968\u4EE3\u78BC' : 'Ticker'}
            className="bg-jarvis-gray-900/50 border border-jarvis-gray-700/50 rounded-lg px-3 py-2.5 text-sm font-mono text-jarvis-white placeholder-jarvis-gray-600 focus:outline-none focus:border-jarvis-accent/50"
          />
          <select
            value={strategy}
            onChange={e => setStrategy(e.target.value)}
            className="bg-jarvis-gray-900/50 border border-jarvis-gray-700/50 rounded-lg px-3 py-2.5 text-sm text-jarvis-white focus:outline-none focus:border-jarvis-accent/50"
          >
            {STRATEGIES.map(s => (
              <option key={s.value} value={s.value}>{locale === 'zh' ? s.zh : s.en}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            {PERIODS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  'px-3 py-2 rounded text-xs font-mono transition-all flex-1',
                  period === p.value
                    ? 'bg-jarvis-accent/20 text-jarvis-accent border border-jarvis-accent/30'
                    : 'text-jarvis-gray-500 border border-jarvis-gray-800 hover:border-jarvis-gray-700'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={runBacktest}
            disabled={loading || !ticker.trim()}
            className="px-4 py-2.5 rounded-lg bg-jarvis-accent/20 text-jarvis-accent border border-jarvis-accent/30 hover:bg-jarvis-accent/30 transition-all text-sm font-mono flex items-center justify-center gap-2 disabled:opacity-40"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <History className="w-4 h-4" />}
            {locale === 'zh' ? '\u57F7\u884C\u56DE\u6E2C' : 'Run Backtest'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-jarvis-red/10 border border-jarvis-red/20 text-jarvis-red text-sm">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-jarvis-accent animate-spin" />
          <span className="ml-3 text-sm text-jarvis-gray-400 font-mono">
            {locale === 'zh' ? '\u56DE\u6E2C\u904B\u884C\u4E2D...' : 'Running backtest...'}
          </span>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Metrics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: locale === 'zh' ? '\u7E3D\u5831\u916C' : 'Total Return', value: `${result.metrics.totalReturn > 0 ? '+' : ''}${result.metrics.totalReturn}%`, color: result.metrics.totalReturn >= 0 ? 'text-jarvis-green' : 'text-jarvis-red' },
              { label: locale === 'zh' ? '\u52DD\u7387' : 'Win Rate', value: `${result.metrics.winRate}%`, color: result.metrics.winRate >= 50 ? 'text-jarvis-green' : 'text-jarvis-red' },
              { label: locale === 'zh' ? '\u6700\u5927\u56DE\u64A4' : 'Max Drawdown', value: `${result.metrics.maxDrawdown}%`, color: 'text-jarvis-red' },
              { label: 'Sharpe', value: result.metrics.sharpeRatio?.toFixed(2) || 'N/A', color: (result.metrics.sharpeRatio || 0) >= 1 ? 'text-jarvis-green' : 'text-jarvis-amber' },
              { label: locale === 'zh' ? '\u7372\u5229\u56E0\u5B50' : 'Profit Factor', value: result.metrics.profitFactor?.toFixed(2) || 'N/A', color: (result.metrics.profitFactor || 0) >= 1.5 ? 'text-jarvis-green' : 'text-jarvis-amber' },
            ].map((m, i) => (
              <div key={i} className="glass-panel p-3 text-center">
                <div className="text-xs text-jarvis-gray-500 mb-1">{m.label}</div>
                <div className={cn('text-lg font-bold font-mono', m.color)}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Win/Loss Stats */}
          <div className="glass-panel p-4">
            <div className="grid grid-cols-4 gap-4 text-center text-xs font-mono">
              <div>
                <span className="text-jarvis-gray-500">{locale === 'zh' ? '\u7E3D\u4EA4\u6613' : 'Total'}</span>
                <div className="text-jarvis-white text-lg">{result.metrics.totalTrades}</div>
              </div>
              <div>
                <span className="text-jarvis-gray-500">{locale === 'zh' ? '\u7372\u5229' : 'Wins'}</span>
                <div className="text-jarvis-green text-lg">{result.metrics.winningTrades}</div>
              </div>
              <div>
                <span className="text-jarvis-gray-500">{locale === 'zh' ? '\u8667\u640D' : 'Losses'}</span>
                <div className="text-jarvis-red text-lg">{result.metrics.losingTrades}</div>
              </div>
              <div>
                <span className="text-jarvis-gray-500">{locale === 'zh' ? '\u5E73\u5747\u7372\u5229/\u8667' : 'Avg W/L'}</span>
                <div className="text-jarvis-white text-sm">
                  <span className="text-jarvis-green">+{result.metrics.avgWin}%</span>
                  {' / '}
                  <span className="text-jarvis-red">{result.metrics.avgLoss}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Trade Log */}
          <div className="glass-panel p-4">
            <h4 className="text-xs font-mono text-jarvis-gray-500 uppercase mb-3">
              {locale === 'zh' ? '\u4EA4\u6613\u8A18\u9304' : 'Trade Log'}
            </h4>
            <div className="space-y-2">
              {result.trades?.map((trade, i) => (
                <div key={i} className="flex items-center gap-3 text-xs font-mono py-1.5 border-b border-jarvis-gray-900/50 last:border-0">
                  <span className="text-jarvis-gray-600 w-20">{trade.date}</span>
                  <span className={cn(
                    'px-2 py-0.5 rounded w-12 text-center',
                    trade.action === 'BUY' ? 'bg-jarvis-green/10 text-jarvis-green' : 'bg-jarvis-red/10 text-jarvis-red'
                  )}>
                    {trade.action}
                  </span>
                  <span className="text-jarvis-white">${trade.price?.toFixed(2)}</span>
                  <span className="text-jarvis-gray-500 truncate flex-1">{trade.reasoning}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          {result.summary && (
            <div className="glass-panel p-4 border-l-2 border-jarvis-accent">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-jarvis-accent" />
                <span className="text-xs font-mono text-jarvis-accent uppercase">
                  {locale === 'zh' ? 'JARVIS \u8A55\u4F30' : 'JARVIS ASSESSMENT'}
                </span>
              </div>
              <p className="text-sm text-jarvis-gray-300 leading-relaxed">{result.summary}</p>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {!result && !loading && !error && (
        <div className="text-center py-16">
          <History className="w-12 h-12 text-jarvis-gray-700 mx-auto mb-4" />
          <h3 className="text-jarvis-gray-400 font-semibold mb-2">
            {locale === 'zh' ? '\u7B56\u7565\u56DE\u6E2C' : 'Strategy Backtester'}
          </h3>
          <p className="text-jarvis-gray-600 text-sm">
            {locale === 'zh' ? '\u9078\u64C7\u80A1\u7968\u548C\u7B56\u7565\uFF0C\u67E5\u770B\u6B77\u53F2\u8868\u73FE' : 'Select a ticker and strategy to see historical performance'}
          </p>
        </div>
      )}
    </div>
  );
}
