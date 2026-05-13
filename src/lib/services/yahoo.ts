// ============ Yahoo Finance Data Layer ============
// Uses yahoo-finance2 package which handles crumb/cookie auth internally.
// Falls back to manual fetch if package fails.

import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

export { yf };

/** Legacy base URL for any remaining raw fetch calls */
export const YF_BASE = 'https://query2.finance.yahoo.com';

/**
 * Legacy yahooFetch — kept for backward compatibility.
 * Wraps a raw fetch with crumb auth. Prefer using `yf` directly.
 */
export async function yahooFetch(url: string, _options?: { revalidate?: number }): Promise<Response> {
  // Try raw fetch with user-agent (chart API sometimes works without crumb)
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
  });
  return res;
}
