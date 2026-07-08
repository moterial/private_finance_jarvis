'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import { Loader2, TrendingUp, TrendingDown, Minus, Zap, Shield, BarChart3, Target, X, ChevronRight, Info, AlertTriangle, CheckCircle, Radar, RefreshCw } from 'lucide-react';

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

interface UnusualOption {
  ticker: string;
  currentPrice: number;
  contractSymbol: string;
  type: 'call' | 'put';
  strike: number;
  expiration: string;
  lastPrice: number;
  volume: number;
  openInterest: number;
  volOiRatio: number;
  premiumVolume: number;
  impliedVolatility: number;
  pctOtm: number;
  sentiment: 'bullish' | 'bearish';
  score: number;
}

interface TickerFlowSummary {
  ticker: string;
  currentPrice: number;
  putCallVolumeRatio: number;
  totalCallPremium: number;
  totalPutPremium: number;
  netSentiment: 'bullish' | 'bearish' | 'neutral';
  unusualCount: number;
}

interface OptionsFlowData {
  unusual: UnusualOption[];
  summaries: TickerFlowSummary[];
  failedTickers: string[];
  generatedAt: string;
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

interface StrategyInfo {
  descEn: string; descZh: string;
  whenEn: string; whenZh: string;
  prosEn: string[]; prosZh: string[];
  consEn: string[]; consZh: string[];
  manageEn: string; manageZh: string;
}

const STRATEGY_INFO: Record<string, StrategyInfo> = {
  'Covered Call': {
    descEn: 'You own 100 shares of the stock and sell a call option against it. You collect premium income while capping your upside at the strike price. This is one of the most conservative options strategies.',
    descZh: '持有 100 股標的股票，同時賣出一張看漲期權。你收取權利金收入，但上漲空間被限制在行權價。這是最保守的期權策略之一。',
    whenEn: 'Use when you are mildly bullish or neutral on the stock. Ideal in low-volatility environments or when you expect the stock to trade sideways. Great for generating income on existing holdings.',
    whenZh: '當你對股票持溫和看漲或中性態度時使用。適合低波動環境或預期股票橫盤整理。非常適合為現有持倉產生收入。',
    prosEn: ['Generates consistent premium income', 'Reduces cost basis of your shares', 'Lower risk than naked calls', 'Works well in sideways markets'],
    prosZh: ['產生穩定的權利金收入', '降低持股成本', '風險低於裸賣看漲期權', '橫盤市場表現優異'],
    consEn: ['Upside is capped at strike price', 'Still exposed to full downside risk', 'May miss big rallies', 'Requires 100 shares per contract'],
    consZh: ['上漲收益被行權價封頂', '仍承擔股票下跌的全部風險', '可能錯過大幅上漲', '每張合約需持有 100 股'],
    manageEn: 'If stock rises above strike: let it be called away or roll up/out. If stock drops: the premium provides a small buffer. Close at 50-70% max profit to free up capital. Roll to next month if expiration approaches with stock near strike.',
    manageZh: '股價升超行權價：可被行權或向上/向外展期。股價下跌：權利金提供小幅緩衝。達到 50-70% 最大利潤時可平倉釋放資金。到期日臨近且股價接近行權價時，可展期至下月。',
  },
  'Bull Call Spread': {
    descEn: 'Buy a lower-strike call and sell a higher-strike call with the same expiration. This is a directional bullish bet with defined risk. You profit when the stock rises above your lower strike.',
    descZh: '買入較低行權價的看漲期權，同時賣出較高行權價的看漲期權（相同到期日）。這是一個有限風險的看漲方向性押注。股價上漲超過低行權價時獲利。',
    whenEn: 'Use when you expect a moderate upward move. Better than buying a naked call because selling the higher strike reduces cost. Ideal when IV is high (you benefit from selling premium).',
    whenZh: '預期股價溫和上漲時使用。比直接買看漲期權好，因為賣出較高行權價可降低成本。高 IV 環境特別適合（賣出的權利金更高）。',
    prosEn: ['Defined and limited risk (max loss = net debit)', 'Lower cost than buying a call outright', 'Benefits from rising stock price', 'Less affected by time decay than naked calls'],
    prosZh: ['風險有限且確定（最大虧損 = 淨支出）', '成本低於直接買入看漲期權', '股價上漲時獲利', '受時間價值衰減影響小於裸買看漲期權'],
    consEn: ['Profit is capped at the width of strikes', 'Requires the stock to move up to be profitable', 'Both legs need to be managed', 'Commission costs on two legs'],
    consZh: ['利潤被行權價差距封頂', '需要股價上漲才能獲利', '兩條腿都需要管理', '兩條腿的手續費成本'],
    manageEn: 'Close the entire spread when profit reaches 50-75% of max. If the stock drops sharply, cut losses early rather than holding to expiration. If stock blows past the short strike, let both legs expire in the money.',
    manageZh: '利潤達到最大值的 50-75% 時平倉整個價差。股價大幅下跌時及早止損，不要等到到期。股價遠超賣出行權價時，讓兩條腿都實值到期。',
  },
  'Bear Put Spread': {
    descEn: 'Buy a higher-strike put and sell a lower-strike put with the same expiration. This is a directional bearish bet with defined risk. You profit when the stock drops below your higher strike.',
    descZh: '買入較高行權價的看跌期權，同時賣出較低行權價的看跌期權（相同到期日）。這是一個有限風險的看跌方向性押注。股價跌破高行權價時獲利。',
    whenEn: 'Use when you expect a moderate downward move. Cheaper than buying puts outright. Good for hedging long positions or playing earnings misses.',
    whenZh: '預期股價溫和下跌時使用。比直接買看跌期權便宜。適合對沖多頭倉位或押注財報不及預期。',
    prosEn: ['Defined and limited risk', 'Cheaper than buying puts outright', 'Profits from stock decline', 'Good hedge for long portfolios'],
    prosZh: ['風險有限且確定', '比直接買看跌期權便宜', '股價下跌時獲利', '適合對沖多頭組合'],
    consEn: ['Profit capped at strike width minus debit', 'Requires the stock to drop', 'Time decay works against you', 'May not fully hedge a large position'],
    consZh: ['利潤被行權價差距封頂', '需要股價下跌才能獲利', '時間價值衰減不利', '可能無法完全對沖大型倉位'],
    manageEn: 'Take profit at 50-75% of max gain. If bearish thesis is invalidated (stock rallies), close early to limit loss. Consider rolling down if the stock drops but not enough.',
    manageZh: '達到最大利潤的 50-75% 時止盈。看跌判斷失效（股價反彈）時及早平倉。股價下跌但幅度不夠時考慮向下展期。',
  },
  'Iron Condor': {
    descEn: 'Sell an OTM put spread and an OTM call spread simultaneously. You collect premium and profit when the stock stays within the two short strikes. This is a non-directional, range-bound strategy.',
    descZh: '同時賣出虛值看跌價差和虛值看漲價差。收取權利金，股價在兩個賣出行權價之間時獲利。這是一個非方向性的區間策略。',
    whenEn: 'Use when you expect low volatility and the stock to stay in a range. Best entered when IV is high (you collect more premium). Ideal after earnings or big events when IV is expected to crush.',
    whenZh: '預期低波動且股價維持區間時使用。高 IV 時進場最佳（收取更多權利金）。財報或重大事件後 IV 預期下降時特別適合。',
    prosEn: ['Collects premium upfront (net credit)', 'Profits from time decay and IV crush', 'No directional bias needed', 'Defined risk on both sides'],
    prosZh: ['預先收取權利金（淨收入）', '從時間衰減和 IV 下降中獲利', '不需要方向判斷', '兩側風險均有限'],
    consEn: ['Limited profit vs larger potential loss', 'Requires stock to stay in range', 'Can lose on either side if stock moves big', 'Four legs mean higher commissions'],
    consZh: ['利潤有限但潛在虧損較大', '需要股價維持在區間內', '股價大幅波動任一方向都會虧損', '四條腿意味著更高手續費'],
    manageEn: 'Close at 50% of max profit to reduce risk of a late-stage reversal. If the stock approaches a short strike, consider closing the threatened side. Never hold through a big event unless that\'s the thesis.',
    manageZh: '達到最大利潤的 50% 時平倉以減少後期反轉風險。股價接近賣出行權價時考慮平倉受威脅的一側。除非策略本身就是押注事件，否則不要持有到重大事件。',
  },
  'Long Straddle': {
    descEn: 'Buy both an ATM call and an ATM put with the same strike and expiration. You profit when the stock makes a large move in either direction. The breakeven requires the move to exceed the total premium paid.',
    descZh: '以相同行權價和到期日同時買入平值看漲和看跌期權。股價大幅波動（任一方向）時獲利。損益平衡需要股價波動超過總權利金支出。',
    whenEn: 'Use before major catalysts (earnings, FDA decisions, lawsuits) when you expect a big move but are unsure of direction. Best when IV is relatively low (options are cheap).',
    whenZh: '在重大催化事件前使用（財報、FDA 決議、訴訟），預期大幅波動但不確定方向時。IV 相對較低（期權便宜）時進場最佳。',
    prosEn: ['Unlimited profit potential in both directions', 'No need to predict direction', 'Benefits from volatility expansion', 'Great for binary events'],
    prosZh: ['雙向無限利潤潛力', '不需要預測方向', '從波動率上升中獲利', '適合二元事件'],
    consEn: ['Expensive — you pay two premiums', 'Time decay works against both legs', 'Needs a BIG move to be profitable', 'IV crush after events can destroy value'],
    consZh: ['昂貴 — 需支付兩份權利金', '時間衰減對兩條腿都不利', '需要大幅波動才能獲利', '事件後 IV 下降可能摧毀價值'],
    manageEn: 'Set a time stop — if no move happens within 50% of time to expiration, consider closing. If the stock moves big in one direction, close the winning leg and hold the losing leg as a lottery ticket. Never hold through expiration — time decay accelerates.',
    manageZh: '設定時間止損 — 到期時間過半仍無波動時考慮平倉。股價大幅單向波動時，平倉獲利腿，保留虧損腿作為彩票。永遠不要持有到到期 — 時間衰減會加速。',
  },
  'Protective Put': {
    descEn: 'Buy a put option on a stock you already own. This acts as insurance — it limits your downside while keeping unlimited upside. Like paying an insurance premium to protect your portfolio.',
    descZh: '為已持有的股票買入看跌期權。這相當於保險 — 限制下行風險同時保留無限上漲空間。就像支付保險費來保護你的投資組合。',
    whenEn: 'Use when you want to stay long but are worried about a near-term pullback. Common before earnings, elections, or macro events. Also used when you have large unrealized gains to protect.',
    whenZh: '想繼續持有但擔心短期回調時使用。常在財報、選舉或宏觀事件前使用。也適用於保護大量未實現收益。',
    prosEn: ['Complete downside protection below strike', 'Unlimited upside preserved', 'Peace of mind during volatile periods', 'Simple to execute — just one leg'],
    prosZh: ['行權價以下完全保護下行風險', '保留無限上漲空間', '波動期間安心持有', '操作簡單 — 只有一條腿'],
    consEn: ['Premium cost reduces overall returns', 'Time decay erodes the put value', 'If stock doesn\'t drop, premium is wasted', 'Repeated use is expensive over time'],
    consZh: ['權利金成本降低整體回報', '時間衰減侵蝕看跌期權價值', '股價不跌則權利金浪費', '長期反覆使用成本高昂'],
    manageEn: 'Buy puts with 30-60 DTE for best balance of protection and cost. Use 5-10% OTM puts for cheaper insurance. If the threat passes, sell the put to recover remaining time value. Consider collars (sell a call too) to offset the put cost.',
    manageZh: '買入 30-60 天到期的看跌期權以平衡保護與成本。使用 5-10% 虛值看跌期權以降低保險費。威脅解除後賣出看跌期權以回收剩餘時間價值。考慮領口策略（同時賣出看漲期權）來抵消看跌期權成本。',
  },
  'default': {
    descEn: 'A custom options strategy combining multiple legs to create a specific risk/reward profile.',
    descZh: '結合多條腿的自訂期權策略，創建特定的風險/報酬組合。',
    whenEn: 'Depends on the specific combination of legs and market outlook.',
    whenZh: '取決於具體的腿部組合和市場展望。',
    prosEn: ['Customizable risk/reward', 'Can be tailored to specific views'],
    prosZh: ['可自訂風險/報酬', '可針對特定觀點量身打造'],
    consEn: ['Complexity increases with more legs', 'May require active management'],
    consZh: ['腿部越多越複雜', '可能需要主動管理'],
    manageEn: 'Monitor Greeks and adjust as needed. Set clear profit targets and stop losses.',
    manageZh: '監控希臘字母並按需調整。設定明確的止盈和止損目標。',
  },
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
  const [expandedStrategy, setExpandedStrategy] = useState<number | null>(null);

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

  const analyzeTicker = useCallback((t: string) => {
    setInputValue(t);
    setTicker(t);
    setSelectedExpiration(undefined);
    fetchOptions(t);
  }, [fetchOptions]);

  useEffect(() => {
    if (ticker && selectedExpiration) {
      fetchOptions(ticker, selectedExpiration);
    }
  }, [selectedExpiration]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Unusual Options Activity Scanner (期權異動) */}
      <FlowScanner locale={locale} onSelectTicker={analyzeTicker} />

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
                {locale === 'zh'
                  ? `顯示 ${data.chain.calls.length}/${data.chain.callCount} calls · ${data.chain.puts.length}/${data.chain.putCount} puts`
                  : `Showing ${data.chain.calls.length}/${data.chain.callCount} calls · ${data.chain.puts.length}/${data.chain.putCount} puts`}
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
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.strategies.map((strategy, i) => {
                const config = TYPE_CONFIG[strategy.type];
                const Icon = config.icon;
                const isExpanded = expandedStrategy === i;
                const info = STRATEGY_INFO[strategy.name] || STRATEGY_INFO['default'];
                return (
                  <div
                    key={i}
                    className={cn(
                      'glass-panel p-4 transition-all cursor-pointer',
                      isExpanded ? 'border-jarvis-accent/40 ring-1 ring-jarvis-accent/20 col-span-full md:col-span-2 xl:col-span-3' : 'hover:border-jarvis-gray-600/50'
                    )}
                    onClick={() => setExpandedStrategy(isExpanded ? null : i)}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-jarvis-white">{strategy.name}</h3>
                        <ChevronRight className={cn('w-3.5 h-3.5 text-jarvis-gray-500 transition-transform', isExpanded && 'rotate-90')} />
                      </div>
                      <span className={cn('flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono', config.bg, config.color, `border ${config.border}`)}>
                        <Icon className="w-3 h-3" />
                        {strategy.type}
                      </span>
                    </div>

                    {/* Legs */}
                    <div className="space-y-1 mb-3">
                      {strategy.legs.map((leg, li) => (
                        <div key={li} className="flex items-center gap-2 text-xs font-mono">
                          <span className={leg.action === 'buy' ? 'text-jarvis-green' : 'text-jarvis-red'}>
                            {leg.action.toUpperCase()}
                          </span>
                          <span className="text-jarvis-gray-400">{leg.type.toUpperCase()}</span>
                          {leg.type === 'stock' ? (
                            <span className="text-jarvis-white">{leg.quantity} shares @ ${leg.strike.toFixed(2)}</span>
                          ) : (
                            <>
                              <span className="text-jarvis-white">${leg.strike}</span>
                              <span className="text-jarvis-gray-600">@${leg.premium.toFixed(2)}</span>
                            </>
                          )}
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

                    {/* Expanded Detail Panel */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-jarvis-gray-700/50 space-y-4" onClick={e => e.stopPropagation()}>
                        {/* What is this strategy */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Info className="w-3.5 h-3.5 text-jarvis-accent" />
                            <span className="text-xs font-mono text-jarvis-accent uppercase">
                              {locale === 'zh' ? '策略說明' : 'What is this?'}
                            </span>
                          </div>
                          <p className="text-sm text-jarvis-gray-300 leading-relaxed">
                            {locale === 'zh' ? info.descZh : info.descEn}
                          </p>
                        </div>

                        {/* When to use */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Target className="w-3.5 h-3.5 text-jarvis-blue" />
                            <span className="text-xs font-mono text-jarvis-blue uppercase">
                              {locale === 'zh' ? '適用時機' : 'When to use'}
                            </span>
                          </div>
                          <p className="text-sm text-jarvis-gray-300 leading-relaxed">
                            {locale === 'zh' ? info.whenZh : info.whenEn}
                          </p>
                        </div>

                        {/* Pros & Cons */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <CheckCircle className="w-3.5 h-3.5 text-jarvis-green" />
                              <span className="text-xs font-mono text-jarvis-green uppercase">
                                {locale === 'zh' ? '優勢' : 'Pros'}
                              </span>
                            </div>
                            <ul className="space-y-1">
                              {(locale === 'zh' ? info.prosZh : info.prosEn).map((p, pi) => (
                                <li key={pi} className="text-xs text-jarvis-gray-400 flex items-start gap-1.5">
                                  <span className="text-jarvis-green mt-0.5">+</span>{p}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 mb-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-jarvis-red" />
                              <span className="text-xs font-mono text-jarvis-red uppercase">
                                {locale === 'zh' ? '風險' : 'Cons'}
                              </span>
                            </div>
                            <ul className="space-y-1">
                              {(locale === 'zh' ? info.consZh : info.consEn).map((c, ci) => (
                                <li key={ci} className="text-xs text-jarvis-gray-400 flex items-start gap-1.5">
                                  <span className="text-jarvis-red mt-0.5">-</span>{c}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* How to manage */}
                        <div>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Shield className="w-3.5 h-3.5 text-jarvis-amber" />
                            <span className="text-xs font-mono text-jarvis-amber uppercase">
                              {locale === 'zh' ? '管理技巧' : 'How to manage'}
                            </span>
                          </div>
                          <p className="text-sm text-jarvis-gray-300 leading-relaxed">
                            {locale === 'zh' ? info.manageZh : info.manageEn}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {data.strategies.length === 0 && (
                <div className="col-span-full text-center py-12 text-jarvis-gray-500 text-sm">
                  {locale === 'zh' ? '\u7121\u8DB3\u5920\u6D41\u52D5\u6027\u751F\u6210\u7B56\u7565' : 'Insufficient liquidity to generate strategies'}
                </div>
              )}
              </div>
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

// ============ Unusual Options Activity Scanner (期權異動) ============
function formatPremium(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

function FlowScanner({ locale, onSelectTicker }: { locale: string; onSelectTicker: (t: string) => void }) {
  const [flow, setFlow] = useState<OptionsFlowData | null>(null);
  const [flowLoading, setFlowLoading] = useState(true);
  const [flowError, setFlowError] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const zh = locale === 'zh';

  const loadFlow = useCallback(async () => {
    setFlowLoading(true);
    setFlowError(false);
    try {
      const res = await fetch('/api/options-flow');
      const json = await res.json();
      if (json.success) setFlow(json.data);
      else setFlowError(true);
    } catch {
      setFlowError(true);
    } finally {
      setFlowLoading(false);
    }
  }, []);

  useEffect(() => { loadFlow(); }, [loadFlow]);

  return (
    <div className="glass-panel p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <Radar className="w-4 h-4 text-jarvis-accent" />
        <h3 className="text-sm font-semibold text-jarvis-white">
          {zh ? '期權異動掃描' : 'Unusual Options Activity'}
        </h3>
        {flow && (
          <span className="text-[10px] font-mono text-jarvis-gray-600">
            {new Date(flow.generatedAt).toLocaleTimeString()}
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={loadFlow}
            disabled={flowLoading}
            className="p-1.5 rounded-lg text-jarvis-gray-500 hover:text-jarvis-white hover:bg-jarvis-gray-800/50 transition-all disabled:opacity-40"
            title={zh ? '重新掃描' : 'Rescan'}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', flowLoading && 'animate-spin')} />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-jarvis-gray-500 hover:text-jarvis-white hover:bg-jarvis-gray-800/50 transition-all"
          >
            <ChevronRight className={cn('w-3.5 h-3.5 transition-transform', expanded && 'rotate-90')} />
          </button>
        </div>
      </div>
      <p className="text-[11px] text-jarvis-gray-600 mb-3">
        {zh
          ? '偵測成交量遠超未平倉量的大額合約（新倉大單足跡）。數據延遲約 15 分鐘，Call 量視為偏多、Put 量視為偏空。'
          : 'Flags contracts where volume dwarfs open interest (fresh positioning footprint). ~15min delayed; call volume read as bullish, put volume as bearish.'}
      </p>

      {expanded && (
        <>
          {flowLoading && !flow && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-jarvis-accent animate-spin" />
              <span className="ml-3 text-xs font-mono text-jarvis-gray-500">
                {zh ? '掃描 14 檔股票期權鏈中...' : 'Scanning option chains across 14 tickers...'}
              </span>
            </div>
          )}

          {flowError && !flowLoading && (
            <div className="text-center py-6 text-xs text-jarvis-gray-500">
              {zh ? '掃描失敗 — Yahoo 數據暫時不可用，稍後再試' : 'Scan failed — Yahoo data temporarily unavailable, try again later'}
            </div>
          )}

          {flow && (
            <>
              {/* Per-ticker sentiment chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-3">
                {flow.summaries.map(s => (
                  <button
                    key={s.ticker}
                    onClick={() => onSelectTicker(s.ticker)}
                    className={cn(
                      'shrink-0 px-2.5 py-1.5 rounded-lg border text-[11px] font-mono transition-all hover:scale-105',
                      s.netSentiment === 'bullish' ? 'border-jarvis-green/30 bg-jarvis-green/5 text-jarvis-green' :
                      s.netSentiment === 'bearish' ? 'border-jarvis-red/30 bg-jarvis-red/5 text-jarvis-red' :
                      'border-jarvis-gray-800 bg-jarvis-gray-900/40 text-jarvis-gray-400'
                    )}
                    title={`${zh ? '權利金流向' : 'Premium flow'} — Call ${formatPremium(s.totalCallPremium)} / Put ${formatPremium(s.totalPutPremium)}`}
                  >
                    <span className="font-bold">{s.ticker}</span>
                    <span className="ml-1.5 opacity-80">P/C {s.putCallVolumeRatio}</span>
                    {s.unusualCount > 0 && (
                      <span className="ml-1.5 px-1 rounded bg-jarvis-accent/20 text-jarvis-accent">{s.unusualCount}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Unusual contracts table */}
              {flow.unusual.length === 0 ? (
                <div className="text-center py-6 text-xs text-jarvis-gray-500">
                  {zh ? '目前沒有偵測到明顯異動（低成交時段常見）' : 'No unusual activity detected right now (common outside market hours)'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] font-mono">
                    <thead>
                      <tr className="text-jarvis-gray-600 uppercase tracking-wider">
                        <th className="text-left py-1.5 pr-3">{zh ? '股票' : 'Ticker'}</th>
                        <th className="text-left py-1.5 pr-3">{zh ? '合約' : 'Contract'}</th>
                        <th className="text-right py-1.5 pr-3">{zh ? '成交量' : 'Vol'}</th>
                        <th className="text-right py-1.5 pr-3">OI</th>
                        <th className="text-right py-1.5 pr-3">Vol/OI</th>
                        <th className="text-right py-1.5 pr-3">{zh ? '權利金' : 'Premium'}</th>
                        <th className="text-right py-1.5 pr-3">IV</th>
                        <th className="text-right py-1.5">{zh ? '方向' : 'Bias'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {flow.unusual.slice(0, 15).map(u => (
                        <tr
                          key={u.contractSymbol}
                          onClick={() => onSelectTicker(u.ticker)}
                          className="border-t border-jarvis-gray-800/40 hover:bg-jarvis-gray-800/30 cursor-pointer transition-colors"
                        >
                          <td className="py-2 pr-3 font-bold text-jarvis-white">{u.ticker}</td>
                          <td className="py-2 pr-3">
                            <span className={u.type === 'call' ? 'text-jarvis-green' : 'text-jarvis-red'}>
                              {u.type === 'call' ? 'C' : 'P'} ${u.strike}
                            </span>
                            <span className="text-jarvis-gray-600 ml-1.5">{u.expiration.slice(5)}</span>
                            {u.pctOtm > 0 && (
                              <span className="text-jarvis-gray-600 ml-1.5">{u.pctOtm.toFixed(0)}% OTM</span>
                            )}
                          </td>
                          <td className="py-2 pr-3 text-right text-jarvis-white">{u.volume.toLocaleString()}</td>
                          <td className="py-2 pr-3 text-right text-jarvis-gray-500">{u.openInterest.toLocaleString()}</td>
                          <td className="py-2 pr-3 text-right text-jarvis-accent font-bold">
                            {u.openInterest === 0 ? (zh ? '全新倉' : 'NEW') : `${u.volOiRatio}x`}
                          </td>
                          <td className="py-2 pr-3 text-right text-jarvis-white">{formatPremium(u.premiumVolume)}</td>
                          <td className="py-2 pr-3 text-right text-jarvis-gray-400">{u.impliedVolatility.toFixed(0)}%</td>
                          <td className="py-2 text-right">
                            <span className={cn(
                              'px-1.5 py-0.5 rounded text-[10px] uppercase',
                              u.sentiment === 'bullish' ? 'bg-jarvis-green/10 text-jarvis-green' : 'bg-jarvis-red/10 text-jarvis-red'
                            )}>
                              {u.sentiment === 'bullish' ? (zh ? '偏多' : 'Bull') : (zh ? '偏空' : 'Bear')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {flow.failedTickers.length > 0 && (
                <p className="mt-2 text-[10px] text-jarvis-gray-600">
                  {zh ? `掃描失敗: ${flow.failedTickers.join(', ')}` : `Failed to scan: ${flow.failedTickers.join(', ')}`}
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
