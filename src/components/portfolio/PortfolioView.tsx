'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { usePortfolio } from '@/lib/portfolio/store';
import { cn, formatPrice, formatPercent } from '@/lib/utils';
import AddStockModal from './AddStockModal';
import StressTestPanel from './StressTestPanel';
import {
  Plus, Search, Briefcase, TrendingUp, TrendingDown,
  FileText, Trash2, Edit3, DollarSign, PieChart,
} from 'lucide-react';

// Fallback prices (used before API responds)
const FALLBACK_PRICES: Record<string, { price: number; change: number; changePercent: number }> = {
  NVDA: { price: 0, change: 0, changePercent: 0 },
  AAPL: { price: 0, change: 0, changePercent: 0 },
  MSFT: { price: 0, change: 0, changePercent: 0 },
  GOOGL: { price: 0, change: 0, changePercent: 0 },
  AMZN: { price: 0, change: 0, changePercent: 0 },
  META: { price: 0, change: 0, changePercent: 0 },
  TSLA: { price: 0, change: 0, changePercent: 0 },
  AMD: { price: 0, change: 0, changePercent: 0 },
  PLTR: { price: 0, change: 0, changePercent: 0 },
  INTC: { price: 0, change: 0, changePercent: 0 },
  JPM: { price: 0, change: 0, changePercent: 0 },
  NFLX: { price: 0, change: 0, changePercent: 0 },
};

const SEARCHABLE_TICKERS = ['NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'AMD', 'PLTR', 'INTC', 'JPM', 'NFLX', 'COIN', 'DIS', 'BA', 'V', 'MA', 'PYPL', 'CRM', 'ORCL', 'UBER', 'ABNB', 'SHOP', 'QCOM', 'MU', 'TSM', 'AVGO'];

export default function PortfolioView() {
  const { t } = useI18n();
  const { portfolio, removePosition, updateNotes, updateShares } = usePortfolio();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  const [editingShares, setEditingShares] = useState<string | null>(null);
  const [tempShares, setTempShares] = useState('');
  const [tempCost, setTempCost] = useState('');
  const [livePrices, setLivePrices] = useState<Record<string, { price: number; change: number; changePercent: number }>>(FALLBACK_PRICES);

  // Fetch real prices from API
  const fetchPrices = useCallback(async () => {
    const tickers = [...new Set([
      ...portfolio.positions.map(p => p.ticker),
      ...SEARCHABLE_TICKERS.slice(0, 15),
    ])];
    if (tickers.length === 0) return;
    try {
      const res = await fetch(`/api/quotes?tickers=${tickers.join(',')}`);
      const json = await res.json();
      if (json.success) setLivePrices(prev => ({ ...prev, ...json.data }));
    } catch { /* silent */ }
  }, [portfolio.positions]);

  useEffect(() => {
    fetchPrices();
    const interval = setInterval(fetchPrices, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPrices]);

  // Search results
  const searchResults = searchQuery.length > 0
    ? SEARCHABLE_TICKERS.filter(t =>
        t.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !portfolio.positions.some(p => p.ticker === t)
      )
    : [];

  // Calculate portfolio stats
  const positionsWithLive = portfolio.positions.map(pos => {
    const live = livePrices[pos.ticker] || { price: pos.avgCost, change: 0, changePercent: 0 };
    const marketValue = pos.shares * live.price;
    const totalCost = pos.shares * pos.avgCost;
    return {
      ...pos,
      currentPrice: live.price,
      priceChange: live.change,
      priceChangePercent: live.changePercent,
      marketValue,
      unrealizedPnl: marketValue - totalCost,
      unrealizedPnlPercent: totalCost > 0 ? ((marketValue - totalCost) / totalCost) * 100 : 0,
    };
  });

  const totalValue = positionsWithLive.reduce((sum, p) => sum + p.marketValue, 0);
  const totalCost = positionsWithLive.reduce((sum, p) => sum + p.shares * p.avgCost, 0);
  const totalPnl = totalValue - totalCost;
  const totalPnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const todayPnl = positionsWithLive.reduce((sum, p) => sum + (p.priceChange * p.shares), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Portfolio Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <span className="text-xs uppercase tracking-wider text-jarvis-gray-500">{t('portfolio.totalValue')}</span>
          <div className="text-xl font-bold font-mono text-jarvis-white mt-1">{formatPrice(totalValue)}</div>
        </div>
        <div className="stat-card">
          <span className="text-xs uppercase tracking-wider text-jarvis-gray-500">{t('portfolio.todayPnl')}</span>
          <div className={cn('text-xl font-bold font-mono mt-1', todayPnl >= 0 ? 'text-jarvis-green' : 'text-jarvis-red')}>
            {todayPnl >= 0 ? '+' : ''}{formatPrice(todayPnl)}
          </div>
        </div>
        <div className="stat-card">
          <span className="text-xs uppercase tracking-wider text-jarvis-gray-500">{t('portfolio.totalPnl')}</span>
          <div className={cn('text-xl font-bold font-mono mt-1', totalPnl >= 0 ? 'text-jarvis-green' : 'text-jarvis-red')}>
            {formatPercent(totalPnlPercent)}
          </div>
        </div>
        <div className="stat-card">
          <span className="text-xs uppercase tracking-wider text-jarvis-gray-500">{t('portfolio.positions')}</span>
          <div className="text-xl font-bold font-mono text-jarvis-white mt-1">{portfolio.positions.length}</div>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-jarvis-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value.toUpperCase())}
          placeholder={t('portfolio.search')}
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-jarvis-dark border border-jarvis-gray-800 text-jarvis-white font-mono text-sm placeholder-jarvis-gray-600 focus:outline-none focus:border-jarvis-accent/50 transition-all"
        />
        {/* Search dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 z-20 glass-panel p-2 max-h-48 overflow-y-auto">
            {searchResults.map(ticker => {
              const live = livePrices[ticker];
              const isUp = live && live.change >= 0;
              return (
                <button
                  key={ticker}
                  onClick={() => { setShowAddModal(ticker); setSearchQuery(''); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-jarvis-gray-800/50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-semibold text-jarvis-white text-sm">{ticker}</span>
                  </div>
                  {live && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-jarvis-gray-300">{formatPrice(live.price)}</span>
                      <span className={cn('text-xs font-mono', isUp ? 'text-jarvis-green' : 'text-jarvis-red')}>
                        {formatPercent(live.changePercent)}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Positions */}
      {portfolio.positions.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <Briefcase className="w-12 h-12 text-jarvis-gray-700 mx-auto mb-4" />
          <p className="text-jarvis-gray-400 mb-2">{t('portfolio.empty')}</p>
          <p className="text-xs text-jarvis-gray-600">{t('portfolio.emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {positionsWithLive.map(pos => {
            const isUp = pos.unrealizedPnl >= 0;
            return (
              <div key={pos.ticker} className="glass-panel-hover p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => setShowAddModal(pos.ticker)}>
                    <div className={cn(
                      'w-9 h-9 rounded-lg flex items-center justify-center font-bold font-mono text-xs',
                      isUp ? 'bg-jarvis-green/10 text-jarvis-green border border-jarvis-green/20' : 'bg-jarvis-red/10 text-jarvis-red border border-jarvis-red/20'
                    )}>
                      {pos.ticker.slice(0, 2)}
                    </div>
                    <div>
                      <span className="font-semibold text-jarvis-white font-mono">{pos.ticker}</span>
                      <span className="text-xs text-jarvis-gray-500 block">{pos.name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-jarvis-white">{formatPrice(pos.currentPrice)}</div>
                    <div className={cn('text-xs font-mono', pos.priceChange >= 0 ? 'text-jarvis-green' : 'text-jarvis-red')}>
                      {formatPercent(pos.priceChangePercent)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 text-center text-xs mb-3">
                  <div>
                    <span className="text-jarvis-gray-500 text-xs block">{t('portfolio.shares')}</span>
                    <span className="font-mono text-jarvis-gray-300">{pos.shares}</span>
                  </div>
                  <div>
                    <span className="text-jarvis-gray-500 text-xs block">{t('portfolio.avgCost')}</span>
                    <span className="font-mono text-jarvis-gray-300">{formatPrice(pos.avgCost)}</span>
                  </div>
                  <div>
                    <span className="text-jarvis-gray-500 text-xs block">{t('portfolio.totalValue')}</span>
                    <span className="font-mono text-jarvis-white">{formatPrice(pos.marketValue)}</span>
                  </div>
                  <div>
                    <span className="text-jarvis-gray-500 text-xs block">P&L</span>
                    <span className={cn('font-mono', isUp ? 'text-jarvis-green' : 'text-jarvis-red')}>
                      {isUp ? '+' : ''}{formatPrice(pos.unrealizedPnl)}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                {editingNotes === pos.ticker ? (
                  <div className="mt-2">
                    <textarea
                      value={tempNotes}
                      onChange={e => setTempNotes(e.target.value)}
                      className="w-full p-2 rounded-lg bg-jarvis-darker border border-jarvis-gray-800 text-jarvis-gray-300 text-xs font-mono resize-none focus:outline-none focus:border-jarvis-accent/50 min-h-[60px]"
                      placeholder={t('portfolio.notesPlaceholder')}
                    />
                    <div className="flex justify-end gap-2 mt-1">
                      <button onClick={() => setEditingNotes(null)} className="text-xs text-jarvis-gray-500 hover:text-jarvis-gray-300">{t('common.cancel')}</button>
                      <button onClick={() => { updateNotes(pos.ticker, tempNotes); setEditingNotes(null); }} className="text-xs text-jarvis-accent hover:text-jarvis-white">{t('common.save')}</button>
                    </div>
                  </div>
                ) : pos.notes ? (
                  <div
                    className="mt-2 p-2 rounded bg-jarvis-darker/50 border border-jarvis-gray-800/20 text-sm text-jarvis-gray-400 cursor-pointer hover:border-jarvis-gray-700/30 transition-all"
                    onClick={() => { setEditingNotes(pos.ticker); setTempNotes(pos.notes); }}
                  >
                    <FileText className="w-3 h-3 inline mr-1 text-jarvis-gray-600" />
                    {pos.notes}
                  </div>
                ) : null}

                {/* Actions */}
                <div className="flex items-center gap-2 mt-3 pt-2 border-t border-jarvis-gray-800/20">
                  <button
                    onClick={() => { setEditingNotes(pos.ticker); setTempNotes(pos.notes); }}
                    className="text-xs text-jarvis-gray-500 hover:text-jarvis-accent flex items-center gap-1 transition-all"
                  >
                    <Edit3 className="w-3 h-3" /> {t('portfolio.notes')}
                  </button>
                  <button
                    onClick={() => {
                      if (editingShares === pos.ticker) {
                        updateShares(pos.ticker, Number(tempShares) || pos.shares, Number(tempCost) || pos.avgCost);
                        setEditingShares(null);
                      } else {
                        setEditingShares(pos.ticker);
                        setTempShares(String(pos.shares));
                        setTempCost(String(pos.avgCost));
                      }
                    }}
                    className="text-xs text-jarvis-gray-500 hover:text-jarvis-accent flex items-center gap-1 transition-all"
                  >
                    <DollarSign className="w-3 h-3" /> {t('common.edit')}
                  </button>
                  <button
                    onClick={() => removePosition(pos.ticker)}
                    className="text-xs text-jarvis-gray-500 hover:text-jarvis-red flex items-center gap-1 transition-all ml-auto"
                  >
                    <Trash2 className="w-3 h-3" /> {t('common.remove')}
                  </button>
                </div>

                {/* Edit shares inline */}
                {editingShares === pos.ticker && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-jarvis-gray-800/20">
                    <input type="number" value={tempShares} onChange={e => setTempShares(e.target.value)} className="flex-1 px-2 py-1 rounded bg-jarvis-darker border border-jarvis-gray-800 text-xs font-mono text-jarvis-white focus:outline-none" placeholder="Shares" />
                    <input type="number" value={tempCost} onChange={e => setTempCost(e.target.value)} className="flex-1 px-2 py-1 rounded bg-jarvis-darker border border-jarvis-gray-800 text-xs font-mono text-jarvis-white focus:outline-none" placeholder="Avg Cost" />
                    <button onClick={() => { updateShares(pos.ticker, Number(tempShares), Number(tempCost)); setEditingShares(null); }} className="text-xs text-jarvis-accent">{t('common.save')}</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Stress Test */}
      <StressTestPanel />

      {/* Add Stock Modal */}
      {showAddModal && (
        <AddStockModal ticker={showAddModal} onClose={() => setShowAddModal(null)} />
      )}
    </div>
  );
}
