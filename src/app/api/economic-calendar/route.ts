import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface EconEvent {
  date: string;
  event: string;
  importance: 'high' | 'medium' | 'low';
  actual?: string;
  forecast?: string;
  previous?: string;
}

// Fetch economic calendar from Finnhub
async function fetchFromFinnhub(): Promise<EconEvent[]> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return [];

  const from = new Date().toISOString().split('T')[0];
  const to = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${key}`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) return [];
    const json = await res.json();
    const events: EconEvent[] = (json.economicCalendar || [])
      .filter((e: Record<string, string>) => e.country === 'US')
      .map((e: Record<string, string>) => ({
        date: e.time?.split('T')[0] || e.date,
        event: e.event,
        importance: e.impact === '3' ? 'high' : e.impact === '2' ? 'medium' : 'low',
        actual: e.actual?.toString() || undefined,
        forecast: e.estimate?.toString() || undefined,
        previous: e.prev?.toString() || undefined,
      }));
    return events;
  } catch {
    return [];
  }
}

// Fallback: known 2025 US economic calendar dates
function getKnownDates2025(): EconEvent[] {
  const now = new Date();
  const events: EconEvent[] = [
    // FOMC meetings 2025
    { date: '2025-01-29', event: 'FOMC Rate Decision', importance: 'high' },
    { date: '2025-03-19', event: 'FOMC Rate Decision', importance: 'high' },
    { date: '2025-05-07', event: 'FOMC Rate Decision', importance: 'high' },
    { date: '2025-06-18', event: 'FOMC Rate Decision', importance: 'high' },
    { date: '2025-07-30', event: 'FOMC Rate Decision', importance: 'high' },
    { date: '2025-09-17', event: 'FOMC Rate Decision', importance: 'high' },
    { date: '2025-10-29', event: 'FOMC Rate Decision', importance: 'high' },
    { date: '2025-12-17', event: 'FOMC Rate Decision', importance: 'high' },
    // CPI releases 2025 (approximate — usually 2nd week of month)
    { date: '2025-01-15', event: 'CPI (Dec)', importance: 'high' },
    { date: '2025-02-12', event: 'CPI (Jan)', importance: 'high' },
    { date: '2025-03-12', event: 'CPI (Feb)', importance: 'high' },
    { date: '2025-04-10', event: 'CPI (Mar)', importance: 'high' },
    { date: '2025-05-13', event: 'CPI (Apr)', importance: 'high' },
    { date: '2025-06-11', event: 'CPI (May)', importance: 'high' },
    { date: '2025-07-10', event: 'CPI (Jun)', importance: 'high' },
    { date: '2025-08-12', event: 'CPI (Jul)', importance: 'high' },
    { date: '2025-09-10', event: 'CPI (Aug)', importance: 'high' },
    { date: '2025-10-14', event: 'CPI (Sep)', importance: 'high' },
    { date: '2025-11-12', event: 'CPI (Oct)', importance: 'high' },
    { date: '2025-12-10', event: 'CPI (Nov)', importance: 'high' },
    // NFP releases 2025 (first Friday of month)
    { date: '2025-01-10', event: 'Non-Farm Payrolls (Dec)', importance: 'high' },
    { date: '2025-02-07', event: 'Non-Farm Payrolls (Jan)', importance: 'high' },
    { date: '2025-03-07', event: 'Non-Farm Payrolls (Feb)', importance: 'high' },
    { date: '2025-04-04', event: 'Non-Farm Payrolls (Mar)', importance: 'high' },
    { date: '2025-05-02', event: 'Non-Farm Payrolls (Apr)', importance: 'high' },
    { date: '2025-06-06', event: 'Non-Farm Payrolls (May)', importance: 'high' },
    { date: '2025-07-03', event: 'Non-Farm Payrolls (Jun)', importance: 'high' },
    { date: '2025-08-01', event: 'Non-Farm Payrolls (Jul)', importance: 'high' },
    { date: '2025-09-05', event: 'Non-Farm Payrolls (Aug)', importance: 'high' },
    { date: '2025-10-03', event: 'Non-Farm Payrolls (Sep)', importance: 'high' },
    { date: '2025-11-07', event: 'Non-Farm Payrolls (Oct)', importance: 'high' },
    { date: '2025-12-05', event: 'Non-Farm Payrolls (Nov)', importance: 'high' },
    // GDP
    { date: '2025-01-30', event: 'GDP (Q4 Advance)', importance: 'high' },
    { date: '2025-03-27', event: 'GDP (Q4 Second)', importance: 'medium' },
    { date: '2025-04-30', event: 'GDP (Q1 Advance)', importance: 'high' },
    { date: '2025-06-26', event: 'GDP (Q1 Third)', importance: 'medium' },
    { date: '2025-07-30', event: 'GDP (Q2 Advance)', importance: 'high' },
  ];

  const todayStr = now.toISOString().split('T')[0];
  return events.filter(e => e.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date));
}

export async function GET() {
  let events = await fetchFromFinnhub();

  // If Finnhub returns nothing, use known dates
  if (events.length === 0) {
    events = getKnownDates2025();
  } else {
    // Filter to high-importance US events only
    events = events.filter(e => e.importance === 'high' || e.importance === 'medium');
  }

  // Limit to next 20 events
  return NextResponse.json({ success: true, data: events.slice(0, 20) });
}
