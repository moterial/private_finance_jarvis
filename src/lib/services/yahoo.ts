// ============ Yahoo Finance Data Layer ============
// Direct raw fetch approach — avoids yahoo-finance2 package overhead.
// v8 chart works WITHOUT crumb (for quotes, candles).
// v7 options NEEDS crumb — we cache cookie+crumb aggressively (1hr).

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const YF_HOST = 'https://query2.finance.yahoo.com';

// ============ Crumb Cache (for options & other v7 endpoints) ============
let _cachedCrumb: { cookie: string; crumb: string; ts: number } | null = null;
const CRUMB_TTL = 60 * 60 * 1000; // 1 hour

async function getCrumb(): Promise<{ cookie: string; crumb: string }> {
  if (_cachedCrumb && Date.now() - _cachedCrumb.ts < CRUMB_TTL) {
    return _cachedCrumb;
  }

  // Try multiple approaches to get crumb (Render datacenter IPs may be throttled)
  const hosts = ['https://query2.finance.yahoo.com', 'https://query1.finance.yahoo.com'];

  for (const host of hosts) {
    try {
      // Step 1: Get cookies from fc.yahoo.com
      const r1 = await fetch('https://fc.yahoo.com', {
        redirect: 'manual',
        headers: { 'User-Agent': UA },
        cache: 'no-store',
      });
      const setCookie = r1.headers.get('set-cookie') || '';
      // Try multiple cookie patterns
      const cookieMatch = setCookie.match(/(A3=[^;]+)/) || setCookie.match(/(A1=[^;]+)/);
      const cookie = cookieMatch ? cookieMatch[1] : '';
      if (!cookie) continue;

      // Step 2: Get crumb
      const r2 = await fetch(`${host}/v1/test/getcrumb`, {
        headers: { 'User-Agent': UA, 'Cookie': cookie },
        cache: 'no-store',
      });
      if (!r2.ok) continue;
      const crumb = await r2.text();
      if (!crumb || crumb.length > 50 || crumb.includes('<')) continue;

      _cachedCrumb = { cookie, crumb, ts: Date.now() };
      return _cachedCrumb;
    } catch {
      continue;
    }
  }

  throw new Error('Failed to get Yahoo crumb from all hosts');
}

// ============ Raw Yahoo Fetch Helpers ============

/** Fetch v8 chart data (NO crumb needed — works from any IP) */
export async function yfChart(
  symbol: string,
  opts: { period1?: string; range?: string; interval?: string } = {},
): Promise<any> {
  const params = new URLSearchParams();
  if (opts.period1) {
    params.set('period1', String(Math.floor(new Date(opts.period1).getTime() / 1000)));
    params.set('period2', String(Math.floor(Date.now() / 1000)));
  }
  params.set('interval', opts.interval || '1d');
  if (opts.range && !opts.period1) params.set('range', opts.range);

  const url = `${YF_HOST}/v8/finance/chart/${encodeURIComponent(symbol)}?${params}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, cache: 'no-store' });
  if (!res.ok) throw new Error(`yfChart ${symbol}: ${res.status}`);
  const json = await res.json();
  return json?.chart?.result?.[0] || null;
}

/** Get latest quote from v8 chart meta (NO crumb needed) */
export async function yfQuote(symbol: string): Promise<{
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  previousClose: number;
  regularMarketOpen: number;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
  shortName: string;
  symbol: string;
  marketCap?: number;
  longName?: string;
  exchange?: string;
} | null> {
  const data = await yfChart(symbol, { range: '2d', interval: '1d' });
  if (!data?.meta) return null;
  const m = data.meta;
  const prevClose = m.chartPreviousClose ?? m.previousClose ?? 0;
  const price = m.regularMarketPrice ?? 0;
  // Volume from indicators if available
  const vol = data.indicators?.quote?.[0]?.volume;
  const lastVol = Array.isArray(vol) ? vol[vol.length - 1] ?? 0 : 0;
  return {
    regularMarketPrice: price,
    regularMarketChange: price - prevClose,
    regularMarketChangePercent: prevClose ? ((price - prevClose) / prevClose) * 100 : 0,
    previousClose: prevClose,
    regularMarketOpen: m.regularMarketOpen ?? price,
    regularMarketDayHigh: m.regularMarketDayHigh ?? price,
    regularMarketDayLow: m.regularMarketDayLow ?? price,
    regularMarketVolume: m.regularMarketVolume ?? lastVol,
    shortName: m.shortName || m.symbol || symbol,
    symbol: m.symbol || symbol,
    longName: m.longName,
    exchange: m.exchangeName,
  };
}

/** Batch quote — fetches quotes in parallel using v8 chart */
export async function yfQuoteBatch(symbols: string[]): Promise<any[]> {
  const results = await Promise.allSettled(symbols.map(s => yfQuote(s)));
  return results
    .map(r => r.status === 'fulfilled' ? r.value : null)
    .filter(Boolean);
}

// yahoo-finance2 fallback client — handles Yahoo's cookie/crumb/consent flow
// internally. The raw fc.yahoo.com cookie trick used by getCrumb() no longer
// works from all networks, so this is the reliable path.
let _yf2: any = null;
async function getYf2(): Promise<any> {
  if (_yf2) return _yf2;
  const mod: any = await import('yahoo-finance2');
  const YF = mod.default;
  _yf2 = typeof YF === 'function' ? new YF() : YF;
  return _yf2;
}

/** Fetch v7 options chain via raw crumb fetch, falling back to yahoo-finance2 */
export async function yfOptions(symbol: string, date?: string): Promise<any> {
  // Attempt 1: raw v7 fetch with cached crumb (fastest when it works)
  try {
    const { cookie, crumb } = await getCrumb();
    const params = new URLSearchParams({ crumb });
    if (date) params.set('date', String(Math.floor(new Date(date).getTime() / 1000)));

    const url = `${YF_HOST}/v7/finance/options/${encodeURIComponent(symbol)}?${params}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Cookie': cookie },
      cache: 'no-store',
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) _cachedCrumb = null;
      throw new Error(`yfOptions ${symbol}: ${res.status}`);
    }
    const json = await res.json();
    return json?.optionChain?.result?.[0] || null;
  } catch {
    // fall through to yahoo-finance2
  }

  // Attempt 2: yahoo-finance2 (its own cookie jar + consent handling).
  // Normalize Dates to epoch seconds so callers see the raw v7 shape.
  const yf2 = await getYf2();
  const result = await yf2.options(symbol, date ? { date: new Date(date) } : {});
  if (!result) return null;

  const toEpoch = (d: unknown): number =>
    d instanceof Date ? Math.floor(d.getTime() / 1000)
    : typeof d === 'number' ? d
    : Math.floor(new Date(d as string).getTime() / 1000);

  return {
    ...result,
    expirationDates: (result.expirationDates || []).map(toEpoch),
    options: (result.options || []).map((o: any) => ({
      ...o,
      expirationDate: toEpoch(o.expirationDate),
      calls: (o.calls || []).map((c: any) => ({ ...c, expiration: toEpoch(c.expiration) })),
      puts: (o.puts || []).map((p: any) => ({ ...p, expiration: toEpoch(p.expiration) })),
    })),
  };
}

/**
 * Retry wrapper for any yahoo call.
 */
export async function yfRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const is429 = e?.message?.includes('429') || e?.message?.includes('Too Many Requests');
      if (!is429 || i === retries - 1) throw e;
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, i)));
    }
  }
  throw new Error('yfRetry exhausted');
}
