import { NextResponse } from 'next/server';
import { yahooFetch, YF_BASE } from '@/lib/services/yahoo';

export const dynamic = 'force-dynamic';

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

export async function GET() {
  const assets: AssetData[] = [];

  // Fetch crypto from CoinGecko (free, no key)
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=12&sparkline=false&price_change_percentage=24h',
      { next: { revalidate: 300 } }
    );
    if (res.ok) {
      const data = await res.json();
      for (const coin of data) {
        assets.push({
          symbol: coin.symbol?.toUpperCase() || '',
          name: coin.name || '',
          price: coin.current_price ?? 0,
          change24h: coin.price_change_24h ?? 0,
          changePercent24h: coin.price_change_percentage_24h ?? 0,
          category: 'crypto',
          marketCap: coin.market_cap ?? 0,
          volume24h: coin.total_volume ?? 0,
        });
      }
    }
  } catch (e) {
    console.error('[MultiAsset] CoinGecko fetch failed:', e);
  }

  // Fetch forex & commodities from Yahoo Finance
  const forexSymbols = ['EURUSD=X', 'GBPUSD=X', 'USDJPY=X', 'AUDUSD=X', 'USDCAD=X', 'USDCHF=X'];
  const commoditySymbols = ['GC=F', 'SI=F', 'CL=F', 'NG=F', 'HG=F'];
  const commodityNames: Record<string, string> = {
    'GC=F': 'Gold', 'SI=F': 'Silver', 'CL=F': 'Crude Oil', 'NG=F': 'Natural Gas', 'HG=F': 'Copper',
  };
  const forexNames: Record<string, string> = {
    'EURUSD=X': 'EUR/USD', 'GBPUSD=X': 'GBP/USD', 'USDJPY=X': 'USD/JPY',
    'AUDUSD=X': 'AUD/USD', 'USDCAD=X': 'USD/CAD', 'USDCHF=X': 'USD/CHF',
  };

  try {
    const allSymbols = [...forexSymbols, ...commoditySymbols].join(',');
    const res = await yahooFetch(
      `${YF_BASE}/v7/finance/quote?symbols=${allSymbols}`,
      { revalidate: 300 }
    );
    if (res.ok) {
      const data = await res.json();
      const quotes = data.quoteResponse?.result || [];
      for (const q of quotes) {
        const isForex = forexSymbols.includes(q.symbol);
        assets.push({
          symbol: q.symbol,
          name: isForex ? (forexNames[q.symbol] || q.symbol) : (commodityNames[q.symbol] || q.shortName || q.symbol),
          price: q.regularMarketPrice ?? 0,
          change24h: q.regularMarketChange ?? 0,
          changePercent24h: q.regularMarketChangePercent ?? 0,
          category: isForex ? 'forex' : 'commodity',
        });
      }
    }
  } catch (e) {
    console.error('[MultiAsset] Yahoo fetch failed:', e);
  }

  return NextResponse.json({
    success: true,
    data: { assets },
  });
}
