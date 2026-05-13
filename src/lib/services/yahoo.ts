// ============ Yahoo Finance Data Layer ============
// Uses yahoo-finance2 package which handles crumb/cookie auth internally.
// When YAHOO_PROXY_URL is set, routes requests through a Cloudflare Worker proxy
// to bypass datacenter IP blocking.

import YahooFinance from 'yahoo-finance2';

const PROXY_URL = process.env.YAHOO_PROXY_URL || '';
const PROXY_SECRET = process.env.YAHOO_PROXY_SECRET || '';

/**
 * Custom fetch that routes through proxy when YAHOO_PROXY_URL is configured.
 * yahoo-finance2 calls this for all HTTP requests (cookie, crumb, API).
 */
function createProxiedFetch() {
  if (!PROXY_URL) return undefined; // Use default fetch

  return async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const targetUrl = typeof url === 'string' ? url : url instanceof URL ? url.toString() : (url as Request).url;
    const proxyTarget = `${PROXY_URL}?url=${encodeURIComponent(targetUrl)}`;

    const headers: Record<string, string> = {
      ...(init?.headers as Record<string, string> || {}),
    };
    if (PROXY_SECRET) {
      headers['X-Proxy-Secret'] = PROXY_SECRET;
    }
    // Forward cookies via custom header
    if (headers['Cookie'] || headers['cookie']) {
      headers['X-Yahoo-Cookie'] = headers['Cookie'] || headers['cookie'] || '';
    }

    const res = await globalThis.fetch(proxyTarget, {
      ...init,
      headers,
      redirect: 'manual',
    });

    // If proxy returned set-cookie in custom header, we still get it
    return res;
  };
}

const proxyFetch = createProxiedFetch();

const yfOpts: any = {
  suppressNotices: ['yahooSurvey'],
  queue: { concurrency: 1 },
  fetchOptions: {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
  },
};

if (proxyFetch) {
  yfOpts.fetch = proxyFetch;
}

const yf = new YahooFinance(yfOpts);

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
