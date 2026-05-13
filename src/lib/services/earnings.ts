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

// Fallback: generate upcoming earnings from well-known tickers
async function fetchEarningsFromYahoo(): Promise<EarningsEvent[]> {
  const majorTickers = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'WMT',
    'DIS', 'NFLX', 'AMD', 'CRM', 'ORCL', 'INTC', 'BA', 'GS', 'MS', 'UNH'];

  const events: EarningsEvent[] = [];
  const today = new Date();

  // Use yahoo-finance2 to get earnings dates
  const batchSize = 5;
  for (let i = 0; i < majorTickers.length; i += batchSize) {
    const batch = majorTickers.slice(i, i + batchSize);
    try {
      const { yf, yfRetry } = await import('./yahoo');
      const quotes = await yfRetry(() => yf.quote(batch));
      const quoteArr = Array.isArray(quotes) ? quotes : [quotes];

      for (const q of quoteArr) {
        if (!q) continue;
        const earningsDate = q.earningsTimestamp || q.earningsTimestampStart || q.earningsTimestampEnd;
        if (!earningsDate) continue;
        const ed = earningsDate instanceof Date ? earningsDate : new Date(earningsDate * 1000);
        const diffDays = (ed.getTime() - today.getTime()) / (1000 * 3600 * 24);
        if (diffDays < -7) continue;

        events.push({
          ticker: q.symbol || '',
          name: q.shortName || q.longName || q.symbol || '',
          date: ed.toISOString().split('T')[0],
          hour: ed.getHours() < 12 ? 'bmo' : 'amc',
          epsEstimate: (q as any).epsForward ? parseFloat(((q as any).epsForward / 4).toFixed(2)) : null,
          epsActual: null,
          revenueEstimate: null,
          revenueActual: null,
          surprise: null,
          quarter: `FY`,
        });
      }
    } catch {
      // Skip batch on error
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}
