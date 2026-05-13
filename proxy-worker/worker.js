/**
 * Cloudflare Worker — Yahoo Finance Proxy
 * Deploy this to Cloudflare Workers (free tier: 100k requests/day)
 * 
 * Setup:
 * 1. Go to https://dash.cloudflare.com → Workers & Pages → Create
 * 2. Name it "yahoo-proxy" → Deploy
 * 3. Click "Edit code" → paste this file → Save and Deploy
 * 4. Set PROXY_SECRET in Worker Settings → Variables
 * 5. Add to Render env: YAHOO_PROXY_URL=https://yahoo-proxy.<your-subdomain>.workers.dev
 *    and YAHOO_PROXY_SECRET=<same secret>
 */

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-Proxy-Secret',
        },
      });
    }

    // Verify secret to prevent abuse
    const secret = request.headers.get('X-Proxy-Secret');
    if (env.PROXY_SECRET && secret !== env.PROXY_SECRET) {
      return new Response('Unauthorized', { status: 401 });
    }

    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: 'Missing ?url= parameter' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Only allow Yahoo Finance domains
    const parsed = new URL(targetUrl);
    const allowedHosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com', 'fc.yahoo.com'];
    if (!allowedHosts.includes(parsed.hostname)) {
      return new Response(JSON.stringify({ error: 'Domain not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cookie': request.headers.get('X-Yahoo-Cookie') || '',
        },
        redirect: 'manual',
      });

      // Forward response with all headers
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Access-Control-Expose-Headers', 'Set-Cookie, X-Response-Status');
      headers.set('X-Response-Status', response.status.toString());

      // Forward set-cookie in a custom header (CORS blocks Set-Cookie)
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        headers.set('X-Set-Cookie', setCookie);
      }

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
