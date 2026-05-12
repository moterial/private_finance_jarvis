'use client';

import { useState, useEffect } from 'react';
import { CandleData, TechnicalReport, ChainReaction, ExpertPick } from '@/lib/types/extended';
import { useI18n } from '@/lib/i18n/context';
import { usePortfolio } from '@/lib/portfolio/store';
import { cn, formatPrice, formatPercent, getSentimentColor } from '@/lib/utils';
import CandlestickChart from '@/components/charts/CandlestickChart';
import {
  X, TrendingUp, TrendingDown, Plus, Minus, Target, ShieldAlert,
  ArrowRight, Brain, Zap, BarChart2, Link2, AlertTriangle,
} from 'lucide-react';

interface AddStockModalProps {
  ticker: string;
  onClose: () => void;
}

interface StockData {
  candles: CandleData[];
  technicalReport: TechnicalReport;
  chainReactions: ChainReaction[];
}

const STOCK_INFO: Record<string, { name: string; price: number; sector: string; marketCap: string }> = {
  NVDA: { name: 'NVIDIA Corporation', price: 142.50, sector: 'Technology', marketCap: '3.5T' },
  AAPL: { name: 'Apple Inc.', price: 198.30, sector: 'Technology', marketCap: '3.1T' },
  MSFT: { name: 'Microsoft Corporation', price: 445.20, sector: 'Technology', marketCap: '3.3T' },
  GOOGL: { name: 'Alphabet Inc.', price: 178.90, sector: 'Technology', marketCap: '2.2T' },
  AMZN: { name: 'Amazon.com Inc.', price: 195.40, sector: 'Consumer Cyclical', marketCap: '2.0T' },
  META: { name: 'Meta Platforms Inc.', price: 525.80, sector: 'Technology', marketCap: '1.3T' },
  TSLA: { name: 'Tesla Inc.', price: 248.60, sector: 'Automotive', marketCap: '790B' },
  AMD: { name: 'Advanced Micro Devices', price: 168.40, sector: 'Technology', marketCap: '272B' },
  PLTR: { name: 'Palantir Technologies', price: 27.80, sector: 'Technology', marketCap: '62B' },
  INTC: { name: 'Intel Corporation', price: 31.20, sector: 'Technology', marketCap: '132B' },
  JPM: { name: 'JPMorgan Chase & Co.', price: 205.10, sector: 'Financial', marketCap: '591B' },
  NFLX: { name: 'Netflix Inc.', price: 685.30, sector: 'Communication', marketCap: '296B' },
};

export default function AddStockModal({ ticker, onClose }: AddStockModalProps) {
  const { t, locale } = useI18n();
  const { addPosition, removePosition, isInPortfolio } = usePortfolio();
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [shares, setShares] = useState('1');
  const [avgCost, setAvgCost] = useState('');
  const [activeTab, setActiveTab] = useState<'chart' | 'technical' | 'chain' | 'ai'>('chart');

  const inPortfolio = isInPortfolio(ticker);
  const info = STOCK_INFO[ticker] || { name: ticker, price: 100, sector: 'Unknown', marketCap: 'N/A' };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/stock?ticker=${ticker}&locale=${locale}`);
        const json = await res.json();
        if (json.success) {
          setData(json.data);
          setAvgCost(info.price.toFixed(2));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [ticker, info.price]);

  const handleAdd = () => {
    addPosition({
      ticker,
      name: info.name,
      shares: Number(shares) || 1,
      avgCost: Number(avgCost) || info.price,
      notes: '',
      sector: info.sector,
    });
    onClose();
  };

  const handleRemove = () => {
    removePosition(ticker);
    onClose();
  };

  const report = data?.technicalReport;
  const isUp = report ? report.recommendation === 'buy' : true;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-jarvis-black/85 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl glass-panel animate-slide-up max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-jarvis-dark/95 backdrop-blur-xl px-6 pt-5 pb-4 border-b border-jarvis-gray-800/30">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-jarvis-gray-800 text-jarvis-gray-500 hover:text-jarvis-white transition-all">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold font-mono',
              isUp ? 'bg-jarvis-green/10 text-jarvis-green border border-jarvis-green/20' : 'bg-jarvis-red/10 text-jarvis-red border border-jarvis-red/20'
            )}>
              {ticker.slice(0, 2)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-jarvis-white font-mono">{ticker}</h2>
                {report && (
                  <span className={cn(
                    'text-xs font-mono px-2 py-0.5 rounded border uppercase',
                    report.recommendation === 'buy' ? 'bg-jarvis-green/10 text-jarvis-green border-jarvis-green/20' :
                    report.recommendation === 'sell' ? 'bg-jarvis-red/10 text-jarvis-red border-jarvis-red/20' :
                    'bg-jarvis-yellow/10 text-jarvis-yellow border-jarvis-yellow/20'
                  )}>
                    AI: {report.recommendation}
                  </span>
                )}
              </div>
              <p className="text-xs text-jarvis-gray-500">{info.name}</p>
            </div>
            <div className="ml-auto text-right">
              <div className="text-lg font-mono font-semibold text-jarvis-white">{formatPrice(info.price)}</div>
              <div className="text-xs text-jarvis-gray-500">{info.sector} · {info.marketCap}</div>
            </div>
          </div>

          {/* Sub tabs */}
          <div className="flex gap-1 mt-4">
            {(['chart', 'technical', 'chain', 'ai'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-all',
                  activeTab === tab
                    ? 'bg-jarvis-gray-800 text-jarvis-white border border-jarvis-gray-700/50'
                    : 'text-jarvis-gray-500 hover:text-jarvis-gray-300'
                )}
              >
                {tab === 'chart' ? t('stock.history') :
                 tab === 'technical' ? t('stock.priceAction') :
                 tab === 'chain' ? t('stock.supplyChain') :
                 t('stock.aiRecommendation')}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 rounded-full border-2 border-jarvis-gray-800 border-t-jarvis-accent animate-spin" />
            </div>
          ) : (
            <>
              {/* Chart Tab */}
              {activeTab === 'chart' && data && (
                <div>
                  <CandlestickChart candles={data.candles} report={data.technicalReport} height={300} />
                  {report && (
                    <div className="grid grid-cols-4 gap-2 mt-4">
                      <MiniStat label={t('signal.confidence')} value={`${report.trendStrength.toFixed(0)}%`} color={report.trendStrength > 60 ? 'green' : 'gray'} />
                      <MiniStat label="Trend" value={report.trend} color={report.trend === 'uptrend' ? 'green' : report.trend === 'downtrend' ? 'red' : 'gray'} />
                      <MiniStat label="R:R" value={report.riskRewardRatio ? `${report.riskRewardRatio}:1` : 'N/A'} color="accent" />
                      <MiniStat label="Pattern" value={report.candlePattern || 'None'} color="gray" />
                    </div>
                  )}
                </div>
              )}

              {/* Technical / Price Action Tab */}
              {activeTab === 'technical' && report && (
                <div className="space-y-4">
                  <p className="text-sm text-jarvis-gray-300 leading-relaxed">{report.summary}</p>

                  {report.priceActionSignals.length > 0 && (
                    <div>
                      <h4 className="section-title mb-2">{t('stock.priceAction')}</h4>
                      <div className="space-y-2">
                        {report.priceActionSignals.map((sig, i) => (
                          <div key={i} className={cn(
                            'p-3 rounded-lg border',
                            sig.direction === 'bullish' ? 'bg-jarvis-green/5 border-jarvis-green/15' : 'bg-jarvis-red/5 border-jarvis-red/15'
                          )}>
                            <div className="flex items-center gap-2 mb-1">
                              {sig.direction === 'bullish' ? <TrendingUp className="w-3 h-3 text-jarvis-green" /> : <TrendingDown className="w-3 h-3 text-jarvis-red" />}
                              <span className="text-xs font-semibold text-jarvis-gray-200">{sig.pattern}</span>
                              <span className={cn('text-xs font-mono ml-auto', sig.strength === 'strong' ? 'text-jarvis-green' : 'text-jarvis-yellow')}>
                                {sig.strength}
                              </span>
                            </div>
                            <p className="text-sm text-jarvis-gray-400">{sig.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key Levels */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <h4 className="text-xs uppercase tracking-wider text-jarvis-gray-500 mb-2">Support</h4>
                      {report.supportLevels.slice(0, 3).map((level, i) => (
                        <div key={i} className="flex items-center gap-2 py-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-jarvis-green/50" />
                          <span className="text-xs font-mono text-jarvis-green">{formatPrice(level)}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <h4 className="text-xs uppercase tracking-wider text-jarvis-gray-500 mb-2">Resistance</h4>
                      {report.resistanceLevels.slice(0, 3).map((level, i) => (
                        <div key={i} className="flex items-center gap-2 py-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-jarvis-red/50" />
                          <span className="text-xs font-mono text-jarvis-red">{formatPrice(level)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Buy/Sell Zone */}
                  {report.entryZone && (
                    <div className={cn(
                      'p-3 rounded-lg border',
                      report.recommendation === 'buy' ? 'bg-jarvis-green/5 border-jarvis-green/20' : 'bg-jarvis-red/5 border-jarvis-red/20'
                    )}>
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-3.5 h-3.5 text-jarvis-accent" />
                        <span className="text-xs font-semibold text-jarvis-gray-200">
                          {report.recommendation === 'buy' ? t('stock.buyZone') : t('stock.sellZone')}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                        <div>
                          <span className="text-jarvis-gray-500 block text-xs">Entry</span>
                          <span className="text-jarvis-white">{formatPrice(report.entryZone.low)} - {formatPrice(report.entryZone.high)}</span>
                        </div>
                        <div>
                          <span className="text-jarvis-gray-500 block text-xs">{t('stock.stopLoss')}</span>
                          <span className="text-jarvis-red">{report.stopLoss ? formatPrice(report.stopLoss) : 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-jarvis-gray-500 block text-xs">{t('stock.target')}</span>
                          <span className="text-jarvis-green">{report.targets[0] ? formatPrice(report.targets[0]) : 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Supply Chain Tab */}
              {activeTab === 'chain' && data && (
                <div className="space-y-3">
                  {data.chainReactions.length === 0 ? (
                    <p className="text-sm text-jarvis-gray-500 py-8 text-center">No supply chain data available for {ticker}</p>
                  ) : (
                    data.chainReactions.map((reaction, i) => (
                      <div key={i} className="p-3 rounded-lg border border-jarvis-gray-800/30 bg-jarvis-darker/50">
                        <div className="flex items-center gap-2 mb-2">
                          <Link2 className="w-3.5 h-3.5 text-jarvis-accent" />
                          <span className="text-xs font-semibold text-jarvis-gray-200">{reaction.impactedSectors[0]}</span>
                          <span className="text-xs font-mono text-jarvis-gray-500 ml-auto">{reaction.confidence}% conf</span>
                        </div>
                        <p className="text-sm text-jarvis-gray-400 mb-2">{reaction.narrative}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {reaction.impactedTickers.map((imp, j) => (
                            <span key={j} className={cn(
                              'text-xs font-mono px-1.5 py-0.5 rounded border',
                              imp.impact === 'positive'
                                ? 'bg-jarvis-green/10 text-jarvis-green border-jarvis-green/20'
                                : 'bg-jarvis-red/10 text-jarvis-red border-jarvis-red/20'
                            )}>
                              {imp.impact === 'positive' ? '\u2191' : '\u2193'} {imp.ticker}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* AI Recommendation Tab */}
              {activeTab === 'ai' && report && (
                <div className="space-y-4">
                  <div className={cn(
                    'p-4 rounded-lg border text-center',
                    report.recommendation === 'buy' ? 'bg-jarvis-green/5 border-jarvis-green/20' :
                    report.recommendation === 'sell' ? 'bg-jarvis-red/5 border-jarvis-red/20' :
                    'bg-jarvis-yellow/5 border-jarvis-yellow/20'
                  )}>
                    <Brain className={cn(
                      'w-8 h-8 mx-auto mb-2',
                      report.recommendation === 'buy' ? 'text-jarvis-green' :
                      report.recommendation === 'sell' ? 'text-jarvis-red' : 'text-jarvis-yellow'
                    )} />
                    <h3 className={cn(
                      'text-lg font-bold font-mono uppercase',
                      report.recommendation === 'buy' ? 'text-jarvis-green' :
                      report.recommendation === 'sell' ? 'text-jarvis-red' : 'text-jarvis-yellow'
                    )}>
                      {report.recommendation}
                    </h3>
                    <p className="text-xs text-jarvis-gray-400 mt-1">{t('stock.aiRecommendation')}</p>
                  </div>

                  <p className="text-sm text-jarvis-gray-300 leading-relaxed">{report.summary}</p>

                  {report.entryZone && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-jarvis-darker/50 border border-jarvis-gray-800/30">
                        <span className="text-xs uppercase text-jarvis-gray-500">{t('stock.buyZone')}</span>
                        <div className="text-sm font-mono text-jarvis-green mt-1">
                          {formatPrice(report.entryZone.low)} - {formatPrice(report.entryZone.high)}
                        </div>
                      </div>
                      <div className="p-3 rounded-lg bg-jarvis-darker/50 border border-jarvis-gray-800/30">
                        <span className="text-xs uppercase text-jarvis-gray-500">{t('stock.stopLoss')}</span>
                        <div className="text-sm font-mono text-jarvis-red mt-1">
                          {report.stopLoss ? formatPrice(report.stopLoss) : 'N/A'}
                        </div>
                      </div>
                    </div>
                  )}

                  {report.targets.length > 0 && (
                    <div>
                      <h4 className="text-xs uppercase text-jarvis-gray-500 mb-2">{t('stock.target')}</h4>
                      <div className="flex gap-2">
                        {report.targets.map((target, i) => (
                          <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded bg-jarvis-green/5 border border-jarvis-green/15">
                            <Target className="w-3 h-3 text-jarvis-green" />
                            <span className="text-xs font-mono text-jarvis-green">T{i+1}: {formatPrice(target)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2 p-2 rounded bg-jarvis-gray-900/50 border border-jarvis-gray-800/20">
                    <AlertTriangle className="w-3 h-3 text-jarvis-yellow/60 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-jarvis-gray-600">{t('analysis.disclaimer')}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer: Add/Remove actions */}
        <div className="sticky bottom-0 bg-jarvis-dark/95 backdrop-blur-xl px-6 py-4 border-t border-jarvis-gray-800/30">
          {!inPortfolio ? (
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="text-xs uppercase text-jarvis-gray-500 block mb-1">{t('portfolio.shares')}</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={shares}
                  onChange={e => setShares(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-jarvis-darker border border-jarvis-gray-800 text-jarvis-white font-mono text-sm focus:outline-none focus:border-jarvis-accent/50"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs uppercase text-jarvis-gray-500 block mb-1">{t('portfolio.avgCost')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={avgCost}
                  onChange={e => setAvgCost(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-jarvis-darker border border-jarvis-gray-800 text-jarvis-white font-mono text-sm focus:outline-none focus:border-jarvis-accent/50"
                />
              </div>
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-jarvis-accent/10 text-jarvis-accent border border-jarvis-accent/20 hover:bg-jarvis-accent/20 transition-all text-sm font-mono whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                {t('stock.addToPortfolio')}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs text-jarvis-green font-mono">{'\u2713'} In Portfolio</span>
              <button
                onClick={handleRemove}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-jarvis-red/10 text-jarvis-red border border-jarvis-red/20 hover:bg-jarvis-red/20 transition-all text-sm font-mono"
              >
                <Minus className="w-4 h-4" />
                {t('stock.removeFromPortfolio')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    green: 'text-jarvis-green', red: 'text-jarvis-red',
    accent: 'text-jarvis-accent', gray: 'text-jarvis-gray-300',
    yellow: 'text-jarvis-yellow',
  };
  return (
    <div className="text-center p-2 rounded-lg bg-jarvis-darker/50 border border-jarvis-gray-800/30">
      <span className="text-xs uppercase text-jarvis-gray-500 block">{label}</span>
      <span className={cn('text-xs font-mono font-semibold mt-0.5 block', colorMap[color] || 'text-jarvis-gray-300')}>{value}</span>
    </div>
  );
}
