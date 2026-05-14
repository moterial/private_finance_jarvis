import { RedditPost } from '../types';

const SUBREDDITS = ['wallstreetbets', 'stocks', 'investing', 'stockmarket'];

/**
 * Fetch Reddit posts using public JSON API — NO API KEY needed.
 * Reddit exposes .json endpoints on every subreddit URL.
 */
export async function fetchRedditPosts(): Promise<RedditPost[]> {
  const allPosts: RedditPost[] = [];

  for (const sub of SUBREDDITS) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=25`, {
        headers: { 'User-Agent': 'JarvisFinance/1.0 (educational project)' },
        next: { revalidate: 300 }, // cache 5 min
      });

      if (!res.ok) {
        console.warn(`[Reddit] r/${sub} returned ${res.status}, skipping`);
        continue;
      }

      const json = await res.json();
      const children = json?.data?.children ?? [];

      for (const child of children) {
        const d = child.data;
        if (!d || d.stickied) continue;

        const text = `${d.title || ''} ${(d.selftext || '').slice(0, 800)}`;
        const tickers = extractTickers(text);
        if (tickers.length === 0) continue; // only keep finance-relevant posts

        const { sentiment, score } = analyzeSentiment(text);

        allPosts.push({
          id: d.id,
          title: d.title,
          subreddit: d.subreddit,
          score: d.score ?? 0,
          numComments: d.num_comments ?? 0,
          url: `https://reddit.com${d.permalink}`,
          created: new Date((d.created_utc ?? 0) * 1000).toISOString(),
          sentiment,
          sentimentScore: score,
          tickers,
          selfText: (d.selftext || '').slice(0, 500),
          author: d.author ?? 'unknown',
        });
      }
    } catch (err) {
      console.error(`[Reddit] Failed to fetch r/${sub}:`, err);
    }
  }

  if (allPosts.length === 0) {
    console.warn('[Reddit] No posts fetched from any subreddit, returning empty');
    return [];
  }

  // Sort by score descending, return top results
  return allPosts.sort((a, b) => b.score - a.score).slice(0, 30);
}

// ============ Ticker Extraction ============
const KNOWN_TICKERS = new Set([
  'AAPL', 'MSFT', 'GOOGL', 'GOOG', 'AMZN', 'NVDA', 'META', 'TSLA',
  'AMD', 'INTC', 'NFLX', 'DIS', 'BA', 'JPM', 'V', 'MA',
  'PYPL', 'SQ', 'COIN', 'PLTR', 'SOFI', 'NIO', 'RIVN',
  'AVGO', 'CRM', 'ORCL', 'UBER', 'ABNB', 'SNAP', 'SHOP',
  'ARM', 'SMCI', 'MRVL', 'MU', 'QCOM', 'TSM', 'ASML',
]);

// Common words that look like tickers but aren't
const TICKER_BLACKLIST = new Set([
  'A', 'I', 'AM', 'AN', 'AS', 'AT', 'BE', 'BY', 'DO', 'GO', 'IF',
  'IN', 'IS', 'IT', 'ME', 'MY', 'NO', 'OF', 'ON', 'OR', 'SO', 'TO',
  'UP', 'US', 'WE', 'AI', 'CEO', 'CFO', 'CTO', 'ETF', 'IPO', 'USA',
  'GDP', 'SEC', 'FBI', 'FDA', 'FED', 'IMF', 'ATH', 'DD', 'EPS', 'PE',
  'ALL', 'ARE', 'BUT', 'CAN', 'DID', 'FOR', 'GET', 'GOT', 'HAS', 'HAD',
  'HIS', 'HOW', 'ITS', 'LET', 'MAY', 'NEW', 'NOT', 'NOW', 'OLD', 'OUR',
  'OUT', 'OWN', 'PUT', 'RUN', 'SAY', 'SHE', 'THE', 'TOO', 'TWO', 'WAY',
  'WHO', 'WHY', 'WIN', 'WON', 'YET', 'YOU',
]);

function extractTickers(text: string): string[] {
  const found = new Set<string>();

  // Match $TICKER pattern
  const dollarMatches = text.match(/\$([A-Z]{1,5})\b/g) || [];
  for (const m of dollarMatches) {
    const t = m.slice(1);
    if (!TICKER_BLACKLIST.has(t)) found.add(t);
  }

  // Match known tickers as standalone words
  const words = text.split(/[\s,;.!?()[\]{}'"]+/);
  for (const w of words) {
    if (KNOWN_TICKERS.has(w) && !TICKER_BLACKLIST.has(w)) {
      found.add(w);
    }
  }

  return [...found].slice(0, 5);
}

// ============ Sentiment ============
const BULLISH_WORDS = ['buy', 'bull', 'moon', 'rocket', 'calls', 'long', 'breakout', 'undervalued', 'growth', 'surge', 'rally', 'pump', 'gains', 'upside', 'beat', 'upgrade', 'strong', '🚀', '📈', '💎'];
const BEARISH_WORDS = ['sell', 'bear', 'crash', 'puts', 'short', 'overvalued', 'dump', 'decline', 'drop', 'bubble', 'risk', 'downside', 'warning', 'miss', 'downgrade', 'weak', '📉', 'loss'];

function analyzeSentiment(text: string): { sentiment: 'bullish' | 'bearish' | 'neutral'; score: number } {
  const lower = text.toLowerCase();
  let score = 0;

  for (const w of BULLISH_WORDS) { if (lower.includes(w)) score += 0.12; }
  for (const w of BEARISH_WORDS) { if (lower.includes(w)) score -= 0.12; }

  score = Math.max(-1, Math.min(1, score));
  return {
    sentiment: score > 0.1 ? 'bullish' : score < -0.1 ? 'bearish' : 'neutral',
    score,
  };
}

// Dead mock removed — all data must be real
