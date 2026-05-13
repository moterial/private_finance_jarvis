'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import { Loader2, Bitcoin, DollarSign, Gem, TrendingUp, TrendingDown } from 'lucide-react';

interface AssetData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  category: 'crypto' | 'forex' | 'commodity';
  marketCap?: number;
  volume24h?: number;
}

const CATEGORY_CONFIG = {
  crypto: { label: { en: 'Crypto', zh: '\u52A0\u5BC6\u8CA8\u5E63' }, icon: Bitcoin, color: 'text-jarvis-amber' },
  forex: { label: { en: 'Forex', zh: '\u5916\u532F' }, icon: DollarSign, color: 'text-jarvis-blue' },
  commodity: { label: { en: 'Commodities', zh: '\u5927\u5B97\u5546\u54C1' }, icon: Gem, color: 'text-jarvis-green' },
};

export default function MultiAssetPanel() {
  const { locale } = useI18n();
  const [assets, setAssets] = useState<AssetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'crypto' | 'forex' | 'commodity'>('all');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/multi-asset');
        const json = await res.json();
        if (json.success) setAssets(json.data.assets);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-jarvis-accent animate-spin" />
        <span className="ml-3 text-sm text-jarvis-gray-400 font-mono">
          {locale === 'zh' ? '\u8F09\u5165\u591A\u8CC7\u7522\u6578\u64DA...' : 'Loading multi-asset data...'}
        </span>
      </div>
    );
  }

  const filtered = filter === 'all' ? assets : assets.filter(a => a.category === filter);
  const categories = ['all', 'crypto', 'forex', 'commodity'] as const;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Filter Buttons */}
      <div className="flex items-center gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-mono uppercase transition-all',
              filter === cat
                ? 'bg-jarvis-gray-800/80 text-jarvis-white border border-jarvis-gray-700/50'
                : 'text-jarvis-gray-500 hover:text-jarvis-gray-300 border border-transparent'
            )}
          >
            {cat === 'all'
              ? (locale === 'zh' ? '\u5168\u90E8' : 'All')
              : CATEGORY_CONFIG[cat].label[locale === 'zh' ? 'zh' : 'en']}
            <span className="ml-1 text-jarvis-gray-600">
              ({cat === 'all' ? assets.length : assets.filter(a => a.category === cat).length})
            </span>
          </button>
        ))}
      </div>

      {/* Asset Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((asset, i) => {
          const catConfig = CATEGORY_CONFIG[asset.category];
          const CatIcon = catConfig.icon;
          const isUp = asset.changePercent24h >= 0;

          return (
            <div key={i} className="glass-panel p-4 hover:border-jarvis-gray-600/50 transition-all">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CatIcon className={cn('w-4 h-4', catConfig.color)} />
                  <span className="text-sm font-bold text-jarvis-white">{asset.symbol}</span>
                  <span className="text-xs text-jarvis-gray-600 truncate max-w-[100px]">{asset.name}</span>
                </div>
                {isUp ? (
                  <TrendingUp className="w-4 h-4 text-jarvis-green" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-jarvis-red" />
                )}
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-bold font-mono text-jarvis-white">
                  ${asset.price < 1 ? asset.price.toFixed(4) : asset.price < 100 ? asset.price.toFixed(2) : asset.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
                <div className="text-right">
                  <span className={cn('text-sm font-mono font-bold', isUp ? 'text-jarvis-green' : 'text-jarvis-red')}>
                    {isUp ? '+' : ''}{asset.changePercent24h.toFixed(2)}%
                  </span>
                  <div className={cn('text-xs font-mono', isUp ? 'text-jarvis-green/70' : 'text-jarvis-red/70')}>
                    {isUp ? '+' : ''}${Math.abs(asset.change24h) < 1 ? asset.change24h.toFixed(4) : asset.change24h.toFixed(2)}
                  </div>
                </div>
              </div>
              {(asset.marketCap || asset.volume24h) && (
                <div className="flex items-center gap-4 mt-2 text-xs font-mono text-jarvis-gray-600">
                  {asset.marketCap ? <span>MCap: ${(asset.marketCap / 1e9).toFixed(1)}B</span> : null}
                  {asset.volume24h ? <span>Vol: ${(asset.volume24h / 1e9).toFixed(1)}B</span> : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-jarvis-gray-500 text-sm">
            {locale === 'zh' ? '\u7121\u8CC7\u7522\u6578\u64DA' : 'No asset data available'}
          </p>
        </div>
      )}
    </div>
  );
}
