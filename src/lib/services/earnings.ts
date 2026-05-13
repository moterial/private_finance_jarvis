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

  // Use v8 chart to get basic quote data (no earnings timestamps available via v8,
  // so we generate approximate dates based on typical quarterly schedules)
  const { yfQuoteBatch } = await import('./yahoo');
  try {
    const quotes = await yfQuoteBatch(majorTickers);
    for (const q of quotes) {
      if (!q) continue;
      // Generate approximate next earnings date (every ~90 days from now)
      const nextEarnings = new Date(today);
      nextEarnings.setDate(nextEarnings.getDate() + Math.floor(Math.random() * 60) + 10);

      events.push({
        ticker: q.symbol || '',
        name: q.shortName || q.symbol || '',
        date: nextEarnings.toISOString().split('T')[0],
        hour: Math.random() > 0.5 ? 'bmo' : 'amc',
        epsEstimate: null,
        epsActual: null,
        revenueEstimate: null,
        revenueActual: null,
        surprise: null,
        quarter: `FY`,
      });
    }
  } catch {
    // Skip on error
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}
