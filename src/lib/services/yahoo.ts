// ============ Yahoo Finance Authenticated Fetcher ============
// Yahoo Finance v7/v8 APIs now require a crumb token + cookie
// This module handles auth transparently for all Yahoo API calls

let cachedCrumb: string | null = null;
let cachedCookie: string | null = null;
let crumbExpiry = 0;

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const CRUMB_TTL = 10 * 60 * 1000; // 10 minutes

async function refreshCrumb(): Promise<{ crumb: string; cookie: string }> {
  // Step 1: Hit fc.yahoo.com to get the auth cookie
  const cookieRes = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': UA },
    redirect: 'manual',
  });
  const setCookieHeader = cookieRes.headers.get('set-cookie') || '';
  // Extract all cookie values
  const cookies = setCookieHeader.split(',').map(c => c.split(';')[0].trim()).filter(Boolean).join('; ');

  // Step 2: Use the cookie to get a crumb
  const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: {
      'User-Agent': UA,
      'Cookie': cookies,
    },
  });
  if (!crumbRes.ok) throw new Error(`Failed to get Yahoo crumb: ${crumbRes.status}`);
  const crumb = await crumbRes.text();
  if (!crumb || crumb.includes('{')) throw new Error('Invalid crumb response');

  return { crumb, cookie: cookies };
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
