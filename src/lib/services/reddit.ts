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
    console.warn('[Reddit] No posts fetched from any subreddit, using fallback');
    return getMockRedditPosts();
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

// ============ Fallback Mock ============
function getMockRedditPosts(): RedditPost[] {
  return [
    { id: 'r1', title: '$NVDA earnings next week - massive AI demand driving growth 🚀', subreddit: 'wallstreetbets', score: 15234, numComments: 2341, url: 'https://reddit.com/r/wallstreetbets/1', created: new Date(Date.now() - 3600000).toISOString(), sentiment: 'bullish', sentimentScore: 0.85, tickers: ['NVDA'], author: 'diamond_hands_42' },
    { id: 'r2', title: 'AAPL breaking out of consolidation - $200 price target', subreddit: 'stocks', score: 8921, numComments: 1205, url: 'https://reddit.com/r/stocks/2', created: new Date(Date.now() - 7200000).toISOString(), sentiment: 'bullish', sentimentScore: 0.72, tickers: ['AAPL'], author: 'value_investor99' },
    { id: 'r3', title: 'TSLA overvalued at current levels? PE ratio is insane', subreddit: 'investing', score: 6543, numComments: 3421, url: 'https://reddit.com/r/investing/3', created: new Date(Date.now() - 10800000).toISOString(), sentiment: 'bearish', sentimentScore: -0.65, tickers: ['TSLA'], author: 'bear_thesis' },
    { id: 'r4', title: 'AMD stealing market share from Intel - DD inside 📊', subreddit: 'wallstreetbets', score: 12100, numComments: 1890, url: 'https://reddit.com/r/wallstreetbets/4', created: new Date(Date.now() - 14400000).toISOString(), sentiment: 'bullish', sentimentScore: 0.78, tickers: ['AMD', 'INTC'], author: 'chipgang' },
    { id: 'r5', title: 'META AI investments paying off - Llama models crushing it', subreddit: 'stocks', score: 9870, numComments: 1567, url: 'https://reddit.com/r/stocks/5', created: new Date(Date.now() - 18000000).toISOString(), sentiment: 'bullish', sentimentScore: 0.69, tickers: ['META'], author: 'ai_bull_2024' },
    { id: 'r6', title: 'PLTR government contracts expanding - long term hold 💎', subreddit: 'stocks', score: 7650, numComments: 980, url: 'https://reddit.com/r/stocks/6', created: new Date(Date.now() - 21600000).toISOString(), sentiment: 'bullish', sentimentScore: 0.61, tickers: ['PLTR'], author: 'data_miner' },
    { id: 'r7', title: 'Warning: Commercial real estate impacting JPM and regional banks', subreddit: 'investing', score: 5430, numComments: 2100, url: 'https://reddit.com/r/investing/7', created: new Date(Date.now() - 25200000).toISOString(), sentiment: 'bearish', sentimentScore: -0.55, tickers: ['JPM'], author: 'macro_watcher' },
    { id: 'r8', title: 'MSFT Copilot revenue exceeding expectations - cloud dominance', subreddit: 'stocks', score: 11200, numComments: 1340, url: 'https://reddit.com/r/stocks/8', created: new Date(Date.now() - 28800000).toISOString(), sentiment: 'bullish', sentimentScore: 0.82, tickers: ['MSFT'], author: 'cloud_king' },
  ];
}
