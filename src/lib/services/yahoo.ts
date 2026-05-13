// ============ Yahoo Finance Authenticated Fetcher ============
// Yahoo Finance v7/v8 APIs now require a crumb token + cookie
// This module handles auth transparently for all Yahoo API calls

let cachedCrumb: string | null = null;
let cachedCookie: string | null = null;
let crumbExpiry = 0;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const CRUMB_TTL = 10 * 60 * 1000; // 10 minutes

async function refreshCrumb(): Promise<{ crumb: string; cookie: string }> {
  // Strategy 1: consent page approach (works from datacenters)
  try {
    const consentRes = await fetch('https://consent.yahoo.com/v2/collectConsent?sessionId=1', {
      headers: { 'User-Agent': UA },
      redirect: 'manual',
    });
    const consentCookies = extractCookies(consentRes);
    if (consentCookies) {
      const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
        headers: { 'User-Agent': UA, 'Cookie': consentCookies },
      });
      if (crumbRes.ok) {
        const crumb = await crumbRes.text();
        if (crumb && !crumb.includes('{') && !crumb.includes('<')) {
          console.log('[Yahoo] Got crumb via consent approach');
          return { crumb, cookie: consentCookies };
        }
      }
    }
  } catch (e) {
    console.warn('[Yahoo] Consent approach failed:', e);
  }

  // Strategy 2: fc.yahoo.com approach (original)
  try {
    const cookieRes = await fetch('https://fc.yahoo.com', {
      headers: { 'User-Agent': UA },
      redirect: 'manual',
    });
    const cookies = extractCookies(cookieRes);
    if (cookies) {
      const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
        headers: { 'User-Agent': UA, 'Cookie': cookies },
      });
      if (crumbRes.ok) {
        const crumb = await crumbRes.text();
        if (crumb && !crumb.includes('{') && !crumb.includes('<')) {
          console.log('[Yahoo] Got crumb via fc.yahoo.com');
          return { crumb, cookie: cookies };
        }
      }
    }
  } catch (e) {
    console.warn('[Yahoo] fc.yahoo.com approach failed:', e);
  }

  // Strategy 3: finance.yahoo.com homepage scrape
  try {
    const homeRes = await fetch('https://finance.yahoo.com/quote/AAPL/', {
      headers: { 'User-Agent': UA },
      redirect: 'follow',
    });
    const homeCookies = extractCookies(homeRes);
    if (homeCookies) {
      const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
        headers: { 'User-Agent': UA, 'Cookie': homeCookies },
      });
      if (crumbRes.ok) {
        const crumb = await crumbRes.text();
        if (crumb && !crumb.includes('{') && !crumb.includes('<')) {
          console.log('[Yahoo] Got crumb via finance.yahoo.com');
          return { crumb, cookie: homeCookies };
        }
      }
    }
  } catch (e) {
    console.warn('[Yahoo] finance.yahoo.com approach failed:', e);
  }

  throw new Error('All Yahoo crumb strategies failed');
}

function extractCookies(res: Response): string | null {
  // Node.js undici may use getSetCookie() for multiple set-cookie headers
  let rawCookies: string[] = [];
  if (typeof (res.headers as any).getSetCookie === 'function') {
    rawCookies = (res.headers as any).getSetCookie();
  } else {
    const setCookieHeader = res.headers.get('set-cookie') || '';
    if (setCookieHeader) rawCookies = setCookieHeader.split(',');
  }
  const cookies = rawCookies.map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');
  return cookies || null;
}

async function getCrumb(): Promise<{ crumb: string; cookie: string }> {
  if (cachedCrumb && cachedCookie && Date.now() < crumbExpiry) {
    return { crumb: cachedCrumb, cookie: cachedCookie };
  }

  const { crumb, cookie } = await refreshCrumb();
  cachedCrumb = crumb;
  cachedCookie = cookie;
  crumbExpiry = Date.now() + CRUMB_TTL;
  return { crumb, cookie };
}

/**
 * Fetch from Yahoo Finance API with automatic crumb authentication.
 * Automatically appends the crumb parameter and required cookies.
 * Retries once if crumb is expired.
 */
export async function yahooFetch(url: string, options?: { revalidate?: number }): Promise<Response> {
  const attempt = async (retry: boolean): Promise<Response> => {
    const { crumb, cookie } = await getCrumb();
    const separator = url.includes('?') ? '&' : '?';
    const fullUrl = `${url}${separator}crumb=${encodeURIComponent(crumb)}`;

    const res = await fetch(fullUrl, {
      headers: {
        'User-Agent': UA,
        'Cookie': cookie,
      },
      next: options?.revalidate != null ? { revalidate: options.revalidate } : undefined,
    } as any);

    if (res.status === 401 && retry) {
      // Crumb expired — force refresh and retry
      cachedCrumb = null;
      cachedCookie = null;
      crumbExpiry = 0;
      return attempt(false);
    }

    return res;
  };

  return attempt(true);
}

/** Use query2 base for all Yahoo Finance API calls */
export const YF_BASE = 'https://query2.finance.yahoo.com';
