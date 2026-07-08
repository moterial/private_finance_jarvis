'use client';

import { useState, useEffect, useCallback } from 'react';
import { StockSignal } from '@/lib/types';
import { CandleData, TechnicalReport } from '@/lib/types/extended';
import { useI18n } from '@/lib/i18n/context';
import { cn, formatPrice, formatPercent, getSentimentColor, getConfidenceColor, timeAgo } from '@/lib/utils';
import CandlestickChart from '@/components/charts/CandlestickChart';
import { X, TrendingUp, TrendingDown, BarChart2, Users, Newspaper, Loader2 } from 'lucide-react';

interface StockDetailProps {
  signal: StockSignal;
  onClose: () => void;
}

const TIMEFRAMES = [
  { key: '1d', label: '1D' },
  { key: '5d', label: '5D' },
  { key: '1mo', label: '1M' },
  { key: '3mo', label: '3M' },
  { key: '6mo', label: '6M' },
  { key: '1y', label: '1Y' },
  { key: '2y', label: '2Y' },
] as const;

type TimeframeKey = typeof TIMEFRAMES[number]['key'];

export default function StockDetail({ signal, onClose }: StockDetailProps) {
  const { locale } = useI18n();
  const isUp = signal.direction === 'up';
  const [timeframe, setTimeframe] = useState<TimeframeKey>('3mo');
  const [candles, setCandles] = useState<CandleData[] | null>(null);
  const [report, setReport] = useState<TechnicalReport | null>(null);
  const [chartLoading, setChartLoading] = useState(true);

  const fetchCandles = useCallback(async (tf: TimeframeKey) => {
    setChartLoading(true);
    try {
      const res = await fetch(`/api/stock?ticker=${signal.ticker}&timeframe=${tf}&locale=${locale}`);
      const json = await res.json();
      if (json.success) {
        setCandles(json.data.candles);
        setReport(json.data.technicalReport);
      }
    } catch (err) {
      console.error('Chart fetch error:', err);
    } finally {
      setChartLoading(false);
    }
  }, [signal.ticker, locale]);

  useEffect(() => {
    fetchCandles(timeframe);
  }, [timeframe, fetchCandles]);

  const handleTimeframeChange = (tf: TimeframeKey) => {
    setTimeframe(tf);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-jarvis-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl glass-panel p-6 animate-slide-up max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-jarvis-gray-800 text-jarvis-gray-500 hover:text-jarvis-white transition-all z-10"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-5">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            isUp ? 'bg-jarvis-green/10 border border-jarvis-green/20' : 'bg-jarvis-red/10 border border-jarvis-red/20'
          )}>
            {isUp ? <TrendingUp className="w-6 h-6 text-jarvis-green" /> : <TrendingDown className="w-6 h-6 text-jarvis-red" />}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-jarvis-white font-mono">{signal.ticker}</h2>
            <p className="text-sm text-jarvis-gray-400">{signal.name}</p>
          </div>
          <div className="text-right">
            <span className="text-xl font-bold font-mono text-jarvis-white block">{formatPrice(signal.currentPrice)}</span>
            <span className={cn('text-sm font-bold font-mono', signal.priceChangePercent >= 0 ? 'ticker-up' : 'ticker-down')}>
              {formatPercent(signal.priceChangePercent)}
            </span>
          </div>
        </div>

        {/* Candlestick Chart */}
        <div className="mb-5 p-4 rounded-lg bg-jarvis-darker/40 border border-jarvis-gray-800/30">
          {/* Timeframe Buttons */}
          <div className="flex items-center gap-1 mb-3">
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.key}
                onClick={() => handleTimeframeChange(tf.key)}
                className={cn(
                  'px-3 py-1.5 rounded text-xs font-mono font-medium transition-all',
                  timeframe === tf.key
                    ? 'bg-jarvis-accent/15 text-jarvis-accent border border-jarvis-accent/30'
                    : 'text-jarvis-gray-500 hover:text-jarvis-gray-300 hover:bg-jarvis-gray-800/50 border border-transparent'
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Chart */}
          {chartLoading ? (
            <div className="flex items-center justify-center" style={{ height: 280 }}>
              <Loader2 className="w-5 h-5 text-jarvis-accent animate-spin" />
            </div>
          ) : candles && candles.length > 0 ? (
            <CandlestickChart candles={candles} report={report || undefined} height={280} />
          ) : (
            <div className="flex items-center justify-center text-xs text-jarvis-gray-600" style={{ height: 280 }}>
              No chart data available
            </div>
          )}

          {/* Technical Summary */}
          {report && !chartLoading && (
            <div className="flex items-center gap-3 mt-3 pt-3 border-t border-jarvis-gray-800/30">
              <span className={cn(
                'text-xs font-mono font-bold uppercase px-2 py-1 rounded',
                report.recommendation === 'buy' ? 'bg-jarvis-green/10 text-jarvis-green' :
                report.recommendation === 'sell' ? 'bg-jarvis-red/10 text-jarvis-red' :
                'bg-jarvis-yellow/10 text-jarvis-yellow'
              )}>
                {report.recommendation}
              </span>
              <span className="text-xs text-jarvis-gray-400">{report.summary}</span>
            </div>
          )}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3 mb-5">
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
        <div className="mb-5">
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
        <div className="mb-5">
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
