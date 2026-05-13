// ============ Yahoo Finance Data Layer ============
// Uses yahoo-finance2 package which handles crumb/cookie auth internally.

import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({
  suppressNotices: ['yahooSurvey'],
  queue: { concurrency: 1 },  // Serialize requests to avoid 429
  fetchOptions: {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
  },
});

export { yf };

/**
 * Retry wrapper for yahoo-finance2 calls that may 429.
 * Retries up to 3 times with exponential backoff.
 */
export async function yfRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e: any) {
      const is429 = e?.message?.includes('429') || e?.message?.includes('Too Many Requests');
      if (!is429 || i === retries - 1) throw e;
      // Exponential backoff: 2s, 4s, 8s
      await new Promise(r => setTimeout(r, 2000 * Math.pow(2, i)));
    }
  }
  throw new Error('yfRetry exhausted');
}

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
