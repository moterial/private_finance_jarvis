// ============ Earnings Calendar Service ============

export interface EarningsEvent {
  ticker: string;
  name: string;
  date: string;
  hour: 'bmo' | 'amc' | 'dmh' | ''; // before market open, after market close, during market hours
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  surprise: number | null; // percentage
  quarter: string;
}

// Fetch earnings calendar from Finnhub
export async function fetchEarningsCalendar(fromDate: string, toDate: string): Promise<EarningsEvent[]> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) return fetchEarningsFromYahoo();

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/calendar/earnings?from=${fromDate}&to=${toDate}&token=${apiKey}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return fetchEarningsFromYahoo();
    const data = await res.json();

    return (data.earningsCalendar || []).map((e: any) => ({
      ticker: e.symbol || '',
      name: e.symbol || '',
      date: e.date || '',
      hour: e.hour === 'bmo' ? 'bmo' : e.hour === 'amc' ? 'amc' : e.hour === 'dmh' ? 'dmh' : '',
      epsEstimate: e.epsEstimate ?? null,
      epsActual: e.epsActual ?? null,
      revenueEstimate: e.revenueEstimate ?? null,
      revenueActual: e.revenueActual ?? null,
      surprise: e.epsActual != null && e.epsEstimate != null && e.epsEstimate !== 0
        ? parseFloat((((e.epsActual - e.epsEstimate) / Math.abs(e.epsEstimate)) * 100).toFixed(2))
        : null,
      quarter: `Q${e.quarter || '?'} ${e.year || ''}`,
    }));
  } catch (e) {
    console.error('[Earnings] Finnhub fetch failed:', e);
    return fetchEarningsFromYahoo();
  }
}

// Fallback: fetch earnings dates from Yahoo Finance RSS
async function fetchEarningsFromYahoo(): Promise<EarningsEvent[]> {
  const events: EarningsEvent[] = [];

  // Use Google News RSS to find upcoming earnings announcements
  try {
    const res = await fetch(
      'https://news.google.com/rss/search?q=earnings+report+next+week+OR+this+week+AAPL+OR+MSFT+OR+NVDA+OR+GOOGL+OR+AMZN+OR+META+OR+TSLA&hl=en-US&gl=US&ceid=US:en',
      { headers: { 'User-Agent': 'JarvisFinance/1.0' }, next: { revalidate: 3600 } }
    );
    if (res.ok) {
      const xml = await res.text();
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let match;
      const seen = new Set<string>();
      const TICKER_MAP: Record<string, string> = {
        'apple': 'AAPL', 'microsoft': 'MSFT', 'nvidia': 'NVDA', 'alphabet': 'GOOGL', 'google': 'GOOGL',
        'amazon': 'AMZN', 'meta': 'META', 'tesla': 'TSLA', 'jpmorgan': 'JPM', 'netflix': 'NFLX',
        'amd': 'AMD', 'intel': 'INTC', 'disney': 'DIS', 'salesforce': 'CRM', 'oracle': 'ORCL',
        'walmart': 'WMT', 'visa': 'V', 'boeing': 'BA', 'palantir': 'PLTR', 'coinbase': 'COIN',
      };

      while ((match = itemRegex.exec(xml)) !== null && events.length < 20) {
        const block = match[1];
        const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = titleMatch?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').toLowerCase() || '';
        const pubMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
        const pubDate = pubMatch?.[1]?.trim();

        if (!title.includes('earning')) continue;

        for (const [name, ticker] of Object.entries(TICKER_MAP)) {
          if (title.includes(name) && !seen.has(ticker)) {
            seen.add(ticker);
            const hour = title.includes('before') || title.includes('morning') ? 'bmo' :
                         title.includes('after') || title.includes('close') ? 'amc' : '';
            events.push({
              ticker,
              name: ticker,
              date: pubDate ? new Date(pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
              hour: hour as 'bmo' | 'amc' | 'dmh' | '',
              epsEstimate: null, epsActual: null,
              revenueEstimate: null, revenueActual: null,
              surprise: null,
              quarter: 'FY',
            });
          }
        }
      }
    }
  } catch (e) {
    console.error('[Earnings] Yahoo fallback failed:', e);
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}
