'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
}

const COINS = ['bitcoin', 'ethereum', 'solana', 'dogecoin', 'cardano'];

export default function CryptoWidget() {
  const { locale } = useI18n();
  const [prices, setPrices] = useState<CryptoPrice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCrypto = async () => {
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${COINS.join(',')}&vs_currencies=usd&include_24hr_change=true`,
          { cache: 'no-store' }
        );
        const data = await res.json();
        const list: CryptoPrice[] = COINS.map(id => {
          const d = data[id];
          if (!d) return null;
          return {
            id,
            symbol: id === 'bitcoin' ? 'BTC' : id === 'ethereum' ? 'ETH' : id === 'solana' ? 'SOL' : id === 'dogecoin' ? 'DOGE' : 'ADA',
            name: id.charAt(0).toUpperCase() + id.slice(1),
            price: d.usd || 0,
            change24h: d.usd_24h_change || 0,
          };
        }).filter(Boolean) as CryptoPrice[];
        setPrices(list);
      } catch { /* silent */ }
      setLoading(false);
    };
    fetchCrypto();
    const interval = setInterval(fetchCrypto, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-4 animate-pulse">
        <div className="h-20 bg-gray-700/50 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-sm">₿</span>
        <h3 className="text-sm font-medium text-gray-200">
          {locale === 'zh' ? '加密貨幣' : 'Crypto'}
        </h3>
      </div>
      <div className="space-y-1.5">
        {prices.map(c => (
          <div key={c.id} className="flex items-center justify-between text-xs py-1">
            <div className="flex items-center gap-2">
              <span className="text-gray-200 font-medium w-10">{c.symbol}</span>
              <span className="text-gray-400">{c.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-200 font-mono">
                ${c.price >= 1 ? c.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : c.price.toFixed(4)}
              </span>
              <span className={cn(
                'flex items-center gap-0.5',
                c.change24h >= 0 ? 'text-green-400' : 'text-red-400'
              )}>
                {c.change24h >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {c.change24h >= 0 ? '+' : ''}{c.change24h.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
