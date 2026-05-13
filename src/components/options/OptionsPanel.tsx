'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import { Loader2, TrendingUp, TrendingDown, Minus, Zap, Shield, BarChart3, Target } from 'lucide-react';

interface OptionContract {
  contractSymbol: string;
  strike: number;
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  expiration: string;
  type: 'call' | 'put';
  inTheMoney: boolean;
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
}

interface OptionsStrategy {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral' | 'volatile';
  legs: { action: string; type: string; strike: number; premium: number; quantity: number; expiration: string }[];
  maxProfit: number | 'unlimited';
  maxLoss: number | 'unlimited';
  breakeven: number[];
  netDebit: number;
  riskRewardRatio: string;
}

interface OptionsData {
  chain: {
    ticker: string;
    currentPrice: number;
    expirationDates: string[];
    callCount: number;
    putCount: number;
    calls: OptionContract[];
    puts: OptionContract[];
  };
  strategies: OptionsStrategy[];
  putCallRatio: { volumeRatio: number; oiRatio: number; signal: string };
  aiRecommendation: string | null;
}

const TYPE_CONFIG = {
  bullish: { icon: TrendingUp, color: 'text-jarvis-green', bg: 'bg-jarvis-green/10', border: 'border-jarvis-green/20' },
  bearish: { icon: TrendingDown, color: 'text-jarvis-red', bg: 'bg-jarvis-red/10', border: 'border-jarvis-red/20' },
  neutral: { icon: Minus, color: 'text-jarvis-blue', bg: 'bg-jarvis-blue/10', border: 'border-jarvis-blue/20' },
  volatile: { icon: Zap, color: 'text-jarvis-amber', bg: 'bg-jarvis-amber/10', border: 'border-jarvis-amber/20' },
};

export default function OptionsPanel() {
  const { t, locale } = useI18n();
  const [ticker, setTicker] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [data, setData] = useState<OptionsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedExpiration, setSelectedExpiration] = useState<string | undefined>();
  const [chainView, setChainView] = useState<'strategies' | 'calls' | 'puts'>('strategies');

  const fetchOptions = useCallback(async (t: string, exp?: string) => {
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ ticker: t, locale });
      if (exp) params.set('expiration', exp);
      const res = await fetch(`/api/options?${params}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        if (!exp && json.data.chain.expirationDates.length > 0) {
          setSelectedExpiration(json.data.chain.expirationDates[0]);
        }
      } else {
        setError(json.error || 'Failed to load options');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [locale]);

  const handleSearch = () => {
    const t = inputValue.trim().toUpperCase();
    if (t) {
      setTicker(t);
      setSelectedExpiration(undefined);
      fetchOptions(t);
    }
  };

  useEffect(() => {
    if (ticker && selectedExpiration) {
      fetchOptions(ticker, selectedExpiration);
    }
  }, [selectedExpiration]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder={locale === 'zh' ? '\u8F38\u5165\u80A1\u7968\u4EE3\u78BC\uFF0C\u4F8B\u5982 AAPL, NVDA...' : 'Enter ticker, e.g. AAPL, NVDA...'}
            className="w-full bg-jarvis-gray-900/50 border border-jarvis-gray-700/50 rounded-lg px-4 py-2.5 text-sm font-mono text-jarvis-white placeholder-jarvis-gray-600 focus:outline-none focus:border-jarvis-accent/50 transition-colors"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || !inputValue.trim()}
          className="px-5 py-2.5 rounded-lg bg-jarvis-accent/20 text-jarvis-accent border border-jarvis-accent/30 hover:bg-jarvis-accent/30 transition-all text-sm font-mono disabled:opacity-40"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (locale === 'zh' ? '\u5206\u6790' : 'Analyze')}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-jarvis-red/10 border border-jarvis-red/20 text-jarvis-red text-sm">{error}</div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-jarvis-accent animate-spin" />
          <span className="ml-3 text-sm text-jarvis-gray-400 font-mono">{locale === 'zh' ? '\u8F09\u5165\u671F\u6B0A\u93C8\u6578\u64DA...' : 'Loading options chain...'}</span>
        </div>
      )}

      {data && (
        <>
          {/* Header: Price + Put/Call Ratio */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-panel p-4">
              <div className="text-xs text-jarvis-gray-500 font-mono mb-1">{data.chain.ticker}</div>
              <div className="text-2xl font-bold text-jarvis-white">${data.chain.currentPrice.toFixed(2)}</div>
              <div className="text-xs text-jarvis-gray-500 mt-1">
                {data.chain.callCount} calls \u00B7 {data.chain.putCount} puts
              </div>
            </div>
            <div className="glass-panel p-4">
              <div className="text-xs text-jarvis-gray-500 font-mono mb-1">
                {locale === 'zh' ? '\u8CE3\u6B0A/\u8CB7\u6B0A\u6BD4\u7387' : 'Put/Call Ratio'}
              </div>
              <div className="text-2xl font-bold text-jarvis-white">{data.putCallRatio.volumeRatio}</div>
              <div className={cn('text-xs mt-1', data.putCallRatio.volumeRatio > 1 ? 'text-jarvis-red' : 'text-jarvis-green')}>
                {data.putCallRatio.signal}
              </div>
            </div>
            <div className="glass-panel p-4">
              <div className="text-xs text-jarvis-gray-500 font-mono mb-1">
                {locale === 'zh' ? '\u672A\u5E73\u5009\u6BD4' : 'OI Ratio'}
              </div>
              <div className="text-2xl font-bold text-jarvis-white">{data.putCallRatio.oiRatio}</div>
              <div className="text-xs text-jarvis-gray-500 mt-1">
                {locale === 'zh' ? '\u672A\u5E73\u5009\u91CF\u8CE3/\u8CB7\u6BD4' : 'Open Interest Put/Call'}
              </div>
            </div>
          </div>

          {/* Expiration Selector */}
          {data.chain.expirationDates.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs text-jarvis-gray-500 font-mono shrink-0">
                {locale === 'zh' ? '\u5230\u671F\u65E5:' : 'Expiry:'}
              </span>
              {data.chain.expirationDates.slice(0, 8).map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedExpiration(d)}
                  className={cn(
                    'px-3 py-1 rounded text-xs font-mono transition-all whitespace-nowrap',
                    selectedExpiration === d
                      ? 'bg-jarvis-accent/20 text-jarvis-accent border border-jarvis-accent/30'
                      : 'text-jarvis-gray-500 hover:text-jarvis-gray-300 border border-jarvis-gray-800 hover:border-jarvis-gray-700'
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          {/* AI Recommendation */}
          {data.aiRecommendation && (
            <div className="glass-panel p-4 border-l-2 border-jarvis-accent">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-jarvis-accent" />
                <span className="text-xs font-mono text-jarvis-accent uppercase">
                  {locale === 'zh' ? 'JARVIS \u671F\u6B0A\u5EFA\u8B70' : 'JARVIS OPTIONS INSIGHT'}
                </span>
              </div>
              <p className="text-sm text-jarvis-gray-300 leading-relaxed">{data.aiRecommendation}</p>
            </div>
          )}

          {/* Tab: Strategies / Calls / Puts */}
          <div className="flex items-center gap-1">
            {(['strategies', 'calls', 'puts'] as const).map(view => (
              <button
                key={view}
                onClick={() => setChainView(view)}
                className={cn(
                  'px-4 py-2 rounded-lg text-xs font-mono uppercase transition-all',
                  chainView === view
                    ? 'bg-jarvis-gray-800/80 text-jarvis-white border border-jarvis-gray-700/50'
                    : 'text-jarvis-gray-500 hover:text-jarvis-gray-300 border border-transparent'
                )}
              >
                {view === 'strategies' ? (locale === 'zh' ? '\u7B56\u7565\u5EFA\u8B70' : 'Strategies') :
                 view === 'calls' ? 'Calls' : 'Puts'}
              </button>
            ))}
          </div>

          {/* Strategies View */}
          {chainView === 'strategies' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.strategies.map((strategy, i) => {
                const config = TYPE_CONFIG[strategy.type];
                const Icon = config.icon;
                return (
                  <div key={i} className="glass-panel p-4 hover:border-jarvis-gray-600/50 transition-all">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-jarvis-white">{strategy.name}</h3>
                      <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono', config.bg, config.color, `border ${config.border}`)}>
                        <Icon className="w-3 h-3" />
                        {strategy.type}
                      </span>
                    </div>

                    {/* Legs */}
                    <div className="space-y-1 mb-3">
                      {strategy.legs.filter(l => l.type === 'call' || l.type === 'put').map((leg, li) => (
                        <div key={li} className="flex items-center gap-2 text-xs font-mono">
                          <span className={leg.action === 'buy' ? 'text-jarvis-green' : 'text-jarvis-red'}>
                            {leg.action.toUpperCase()}
                          </span>
                          <span className="text-jarvis-gray-400">{leg.type.toUpperCase()}</span>
                          <span className="text-jarvis-white">${leg.strike}</span>
                          <span className="text-jarvis-gray-600">@${leg.premium.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-jarvis-gray-600">{locale === 'zh' ? '\u6700\u5927\u7372\u5229' : 'Max Profit'}</span>
                        <div className="text-jarvis-green font-mono">
                          {strategy.maxProfit === 'unlimited' ? '\u221E' : `$${strategy.maxProfit.toLocaleString()}`}
                        </div>
                      </div>
                      <div>
                        <span className="text-jarvis-gray-600">{locale === 'zh' ? '\u6700\u5927\u8667\u640D' : 'Max Loss'}</span>
                        <div className="text-jarvis-red font-mono">
                          {strategy.maxLoss === 'unlimited' ? '\u221E' : `$${strategy.maxLoss.toLocaleString()}`}
                        </div>
                      </div>
                      <div>
                        <span className="text-jarvis-gray-600">{locale === 'zh' ? '\u640D\u76CA\u5E73\u8861' : 'Breakeven'}</span>
                        <div className="text-jarvis-white font-mono">
                          {strategy.breakeven.map(b => `$${b}`).join(' / ')}
                        </div>
                      </div>
                      <div>
                        <span className="text-jarvis-gray-600">{locale === 'zh' ? '\u98A8\u96AA\u5831\u916C' : 'Risk/Reward'}</span>
                        <div className="text-jarvis-accent font-mono">{strategy.riskRewardRatio}</div>
                      </div>
                    </div>

                    {/* Net Cost */}
                    <div className="mt-3 pt-3 border-t border-jarvis-gray-800/50 flex items-center justify-between">
                      <span className="text-xs text-jarvis-gray-600">
                        {strategy.netDebit > 0 ? (locale === 'zh' ? '\u6DE8\u652F\u51FA' : 'Net Debit') : (locale === 'zh' ? '\u6DE8\u6536\u5165' : 'Net Credit')}
                      </span>
                      <span className={cn('text-sm font-mono font-bold', strategy.netDebit > 0 ? 'text-jarvis-red' : 'text-jarvis-green')}>
                        ${Math.abs(strategy.netDebit).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })}
              {data.strategies.length === 0 && (
                <div className="col-span-full text-center py-12 text-jarvis-gray-500 text-sm">
                  {locale === 'zh' ? '\u7121\u8DB3\u5920\u6D41\u52D5\u6027\u751F\u6210\u7B56\u7565' : 'Insufficient liquidity to generate strategies'}
                </div>
              )}
            </div>
          )}

          {/* Calls / Puts Chain View */}
          {(chainView === 'calls' || chainView === 'puts') && (
            <div className="glass-panel overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-jarvis-gray-500 border-b border-jarvis-gray-800">
                    <th className="text-left py-2 px-3">Strike</th>
                    <th className="text-right py-2 px-3">Last</th>
                    <th className="text-right py-2 px-3">Bid</th>
                    <th className="text-right py-2 px-3">Ask</th>
                    <th className="text-right py-2 px-3">Vol</th>
                    <th className="text-right py-2 px-3">OI</th>
                    <th className="text-right py-2 px-3">IV</th>
                    <th className="text-right py-2 px-3">\u0394</th>
                    <th className="text-right py-2 px-3">\u0398</th>
                  </tr>
                </thead>
                <tbody>
                  {(chainView === 'calls' ? data.chain.calls : data.chain.puts).map((c, i) => (
                    <tr
                      key={i}
                      className={cn(
                        'border-b border-jarvis-gray-900/50 hover:bg-jarvis-gray-800/30 transition-colors',
                        c.inTheMoney && 'bg-jarvis-accent/5'
                      )}
                    >
                      <td className={cn('py-1.5 px-3 font-bold', c.inTheMoney ? 'text-jarvis-accent' : 'text-jarvis-white')}>
                        ${c.strike}
                      </td>
                      <td className="text-right py-1.5 px-3 text-jarvis-white">${c.lastPrice.toFixed(2)}</td>
                      <td className="text-right py-1.5 px-3 text-jarvis-green">{c.bid > 0 ? `$${c.bid.toFixed(2)}` : '-'}</td>
                      <td className="text-right py-1.5 px-3 text-jarvis-red">{c.ask > 0 ? `$${c.ask.toFixed(2)}` : '-'}</td>
                      <td className="text-right py-1.5 px-3 text-jarvis-gray-400">{c.volume.toLocaleString()}</td>
                      <td className="text-right py-1.5 px-3 text-jarvis-gray-400">{c.openInterest.toLocaleString()}</td>
                      <td className="text-right py-1.5 px-3 text-jarvis-amber">{(c.impliedVolatility * 100).toFixed(1)}%</td>
                      <td className="text-right py-1.5 px-3 text-jarvis-gray-300">{c.delta?.toFixed(3) ?? '-'}</td>
                      <td className="text-right py-1.5 px-3 text-jarvis-gray-300">{c.theta?.toFixed(3) ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Empty State */}
      {!data && !loading && !error && (
        <div className="text-center py-20">
          <BarChart3 className="w-12 h-12 text-jarvis-gray-700 mx-auto mb-4" />
          <h3 className="text-jarvis-gray-400 font-semibold mb-2">
            {locale === 'zh' ? '\u671F\u6B0A\u7B56\u7565\u5206\u6790' : 'Options Strategy Analyzer'}
          </h3>
          <p className="text-jarvis-gray-600 text-sm">
            {locale === 'zh' ? '\u8F38\u5165\u80A1\u7968\u4EE3\u78BC\u4EE5\u67E5\u770B\u671F\u6B0A\u93C8\u3001\u7B56\u7565\u5EFA\u8B70\u548CAI\u5206\u6790' : 'Enter a ticker to view options chain, strategies, and AI analysis'}
          </p>
        </div>
      )}
    </div>
  );
}
