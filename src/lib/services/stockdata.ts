import { CandleData } from '../types/extended';
import { yf, yfRetry } from './yahoo';

/**
 * Stock data service: Finnhub (if key available) → Yahoo Finance (free fallback).
 */
const FH_BASE = 'https://finnhub.io/api/v1';

function getFinnhubKey(): string | null {
  return process.env.FINNHUB_API_KEY || null;
}

// ============ Real-Time Quote ============
export interface StockQuote {
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
}

export async function getQuote(ticker: string): Promise<StockQuote | null> {
  // Try Finnhub first
  const fhQuote = await getQuoteFinnhub(ticker);
  if (fhQuote) return fhQuote;

  // Fallback to Yahoo Finance
  return getQuoteYahoo(ticker);
}

async function getQuoteFinnhub(ticker: string): Promise<StockQuote | null> {
  const key = getFinnhubKey();
  if (!key) return null;

  try {
    const res = await fetch(
      `${FH_BASE}/quote?symbol=${encodeURIComponent(ticker)}&token=${encodeURIComponent(key)}`
    );
    if (!res.ok) return null;
    const d = await res.json();
    if (!d.c || d.c === 0) return null;

    return {
      currentPrice: d.c,
      change: d.d ?? 0,
      changePercent: d.dp ?? 0,
      high: d.h ?? d.c,
      low: d.l ?? d.c,
      open: d.o ?? d.c,
      previousClose: d.pc ?? 0,
      timestamp: d.t ?? Math.floor(Date.now() / 1000),
    };
  } catch (error) {
    console.error(`[Finnhub] Quote failed for ${ticker}:`, error);
    return null;
  }
}

async function getQuoteYahoo(ticker: string): Promise<StockQuote | null> {
  try {
    const q = await yfRetry(() => yf.quote(ticker));
    if (!q || !q.regularMarketPrice) return null;

    return {
      currentPrice: q.regularMarketPrice,
      change: q.regularMarketChange ?? 0,
      changePercent: q.regularMarketChangePercent ?? 0,
      high: q.regularMarketDayHigh ?? q.regularMarketPrice,
      low: q.regularMarketDayLow ?? q.regularMarketPrice,
      open: q.regularMarketOpen ?? q.regularMarketPrice,
      previousClose: q.regularMarketPreviousClose ?? 0,
      timestamp: q.regularMarketTime instanceof Date
        ? Math.floor(q.regularMarketTime.getTime() / 1000)
        : Math.floor(Date.now() / 1000),
    };
  } catch (error) {
    console.error(`[Yahoo] Quote failed for ${ticker}:`, error);
    return null;
  }
}

// ============ Real Candle Data ============
export async function getRealCandles(ticker: string, days: number = 60, interval: string = '1d'): Promise<CandleData[] | null> {
  // Try Finnhub first
  const fhCandles = await getCandlesFinnhub(ticker, days, interval);
  if (fhCandles) return fhCandles;

  // Fallback to Yahoo Finance
  return getCandlesYahoo(ticker, days, interval);
}

async function getCandlesFinnhub(ticker: string, days: number, interval: string = '1d'): Promise<CandleData[] | null> {
  const key = getFinnhubKey();
  if (!key) return null;

  const now = Math.floor(Date.now() / 1000);
  const from = now - days * 24 * 60 * 60;

  // Map interval to Finnhub resolution
  const resolutionMap: Record<string, string> = {
    '5m': '5', '15m': '15', '30m': '30', '1h': '60',
    '1d': 'D', '1wk': 'W', '1mo': 'M',
  };
  const resolution = resolutionMap[interval] || 'D';

  try {
    const res = await fetch(
      `${FH_BASE}/stock/candle?symbol=${encodeURIComponent(ticker)}&resolution=${resolution}&from=${from}&to=${now}&token=${encodeURIComponent(key)}`
    );
    if (!res.ok) return null;
    const d = await res.json();
    if (d.s !== 'ok' || !d.c) return null;

    const candles: CandleData[] = [];
    for (let i = 0; i < d.c.length; i++) {
      candles.push({
        date: new Date(d.t[i] * 1000).toISOString().split('T')[0],
        open: d.o[i],
        high: d.h[i],
        low: d.l[i],
        close: d.c[i],
        volume: d.v[i],
      });
    }
    return candles.length > 0 ? candles : null;
  } catch (error) {
    console.error(`[Finnhub] Candle failed for ${ticker}:`, error);
    return null;
  }
}

async function getCandlesYahoo(ticker: string, days: number, interval: string = '1d'): Promise<CandleData[] | null> {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const yahooIntervalMap: Record<string, string> = {
      '5m': '5m', '15m': '15m', '30m': '30m', '1h': '1h',
      '1d': '1d', '1wk': '1wk', '1mo': '1mo',
    };
    const yahooInterval = yahooIntervalMap[interval] || '1d';

    const chartData = await yfRetry(() => yf.chart(ticker, {
      period1: startDate.toISOString().split('T')[0],
      interval: yahooInterval as any,
    }));

    if (!chartData?.quotes || chartData.quotes.length === 0) return null;

    const candles: CandleData[] = [];
    for (const q of chartData.quotes) {
      if (q.open == null || q.close == null) continue;
      candles.push({
        date: q.date instanceof Date ? q.date.toISOString().split('T')[0] : new Date(q.date).toISOString().split('T')[0],
        open: q.open,
        high: q.high ?? q.close,
        low: q.low ?? q.close,
        close: q.close,
        volume: q.volume || 0,
      });
    }

    return candles.length > 0 ? candles : null;
  } catch (error) {
    console.error(`[StockData] Candle fetch failed for ${ticker}:`, error);
    return null;
  }
}

// ============ Market Indices ============
export interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

export async function getRealMarketOverview(): Promise<{
  sp500: MarketIndex;
  nasdaq: MarketIndex;
  dowJones: MarketIndex;
  vix: MarketIndex;
} | null> {
  // Yahoo Finance symbols for major indices
  const symbols = [
    { symbol: '^GSPC', name: 'S&P 500' },
    { symbol: '^IXIC', name: 'NASDAQ' },
    { symbol: '^DJI', name: 'Dow Jones' },
    { symbol: '^VIX', name: 'VIX' },
  ];

  try {
    const quotes = await Promise.all(
      symbols.map(async s => {
        const q = await getQuote(s.symbol);
        return { ...s, quote: q };
      })
    );

    // If none succeeded, return null to fall back to mock
    if (quotes.every(q => !q.quote)) return null;

    const toIndex = (q: typeof quotes[0]): MarketIndex => ({
      name: q.name,
      value: q.quote?.currentPrice ?? 0,
      change: q.quote?.change ?? 0,
      changePercent: q.quote?.changePercent ?? 0,
    });

    return {
      sp500: toIndex(quotes[0]),
      nasdaq: toIndex(quotes[1]),
      dowJones: toIndex(quotes[2]),
      vix: toIndex(quotes[3]),
    };
  } catch (error) {
    console.error('[StockData] Market overview fetch failed:', error);
    return null;
  }
}

// ============ Batch Quotes ============
export async function getBatchQuotes(tickers: string[]): Promise<Map<string, StockQuote>> {
  const results = new Map<string, StockQuote>();

  // Fetch in parallel with small batches to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async ticker => {
        const quote = await getQuote(ticker);
        return { ticker, quote };
      })
    );

    for (const { ticker, quote } of batchResults) {
      if (quote) results.set(ticker, quote);
    }
  }

  return results;
}

// ============ Company News (via Yahoo RSS) ============
export interface CompanyNews {
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
  category: string;
}

export async function getCompanyNews(ticker: string, daysBack: number = 7): Promise<CompanyNews[]> {
  // Try Finnhub first
  const fhNews = await getCompanyNewsFinnhub(ticker, daysBack);
  if (fhNews.length > 0) return fhNews;

  // Fallback to Yahoo RSS
  return getCompanyNewsYahoo(ticker);
}

async function getCompanyNewsFinnhub(ticker: string, daysBack: number): Promise<CompanyNews[]> {
  const key = getFinnhubKey();
  if (!key) return [];

  const to = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - daysBack * 86400000).toISOString().split('T')[0];

  try {
    const res = await fetch(
      `${FH_BASE}/company-news?symbol=${encodeURIComponent(ticker)}&from=${from}&to=${to}&token=${encodeURIComponent(key)}`
    );
    if (!res.ok) return [];
    const data = await res.json();

    return (data as Array<Record<string, unknown>>).slice(0, 10).map((item) => ({
      headline: String(item.headline || ''),
      summary: String(item.summary || '').slice(0, 300),
      source: String(item.source || ''),
      url: String(item.url || ''),
      datetime: Number(item.datetime || 0),
      category: String(item.category || 'general'),
    }));
  } catch (error) {
    console.error(`[Finnhub] News failed for ${ticker}:`, error);
    return [];
  }
}

async function getCompanyNewsYahoo(ticker: string): Promise<CompanyNews[]> {
  try {
    const res = await fetch(
      `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(ticker)}&region=US&lang=en-US`,
      { headers: { 'User-Agent': 'JarvisFinance/1.0' }, next: { revalidate: 600 } }
    );

    if (!res.ok) return [];

    const xml = await res.text();
    const news: CompanyNews[] = [];

    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && news.length < 10) {
      const block = match[1];
      const title = extractXmlTag(block, 'title');
      const desc = extractXmlTag(block, 'description');
      const link = extractXmlTag(block, 'link');
      const pubDate = extractXmlTag(block, 'pubDate');

      if (title) {
        news.push({
          headline: title.replace(/<!\[CDATA\[|\]\]>/g, ''),
          summary: (desc || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').slice(0, 300),
          source: 'Yahoo Finance',
          url: link || '',
          datetime: pubDate ? Math.floor(new Date(pubDate).getTime() / 1000) : Math.floor(Date.now() / 1000),
          category: 'general',
        });
      }
    }

    return news;
  } catch (error) {
    console.error(`[StockData] News fetch failed for ${ticker}:`, error);
    return [];
  }
}

function extractXmlTag(block: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = block.match(regex);
  return match ? match[1].trim() : '';
}

// ============ Company Profile ============
export interface CompanyProfile {
  name: string;
  ticker: string;
  marketCap: number;
  sector: string;
  logo: string;
  weburl: string;
}

export async function getCompanyProfile(ticker: string): Promise<CompanyProfile | null> {
  try {
    const q = await yfRetry(() => yf.quote(ticker));
    if (!q) return null;

    return {
      name: q.shortName || q.longName || ticker,
      ticker: q.symbol || ticker,
      marketCap: q.marketCap ?? 0,
      sector: q.exchange || 'Unknown',
      logo: '',
      weburl: '',
    };
  } catch {
    return null;
  }
}

// Always enabled — no API key needed
export function isStockDataEnabled(): boolean {
  return true;
}
