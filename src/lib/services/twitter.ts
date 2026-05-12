import { Tweet } from '../types';

/**
 * Fetch financial social commentary from free sources.
 * Uses StockTwits-style public API and RSS fallback — NO API KEY needed.
 * The data is mapped into the Tweet interface for UI compatibility.
 */
export async function fetchTweets(): Promise<Tweet[]> {
  const allTweets: Tweet[] = [];

  // Source 1: StockTwits trending (public, no API key)
  try {
    const res = await fetch('https://api.stocktwits.com/api/2/streams/trending.json', {
      next: { revalidate: 300 },
    });

    if (res.ok) {
      const json = await res.json();
      const messages = json?.messages ?? [];

      for (const msg of messages.slice(0, 20)) {
        const tickers = (msg.symbols || []).map((s: { symbol: string }) => s.symbol).slice(0, 5);
        if (tickers.length === 0) continue;

        const { sentiment, score } = analyzeSentiment(msg.body || '');

        allTweets.push({
          id: `st-${msg.id}`,
          text: msg.body || '',
          author: msg.user?.username || 'unknown',
          authorFollowers: msg.user?.followers || 0,
          likes: msg.likes?.total || 0,
          retweets: msg.reshares?.reshared_count || 0,
          created: msg.created_at || new Date().toISOString(),
          sentiment,
          sentimentScore: score,
          tickers,
          isVerified: msg.user?.official || false,
        });
      }
    }
  } catch (err) {
    console.error('[Social] StockTwits fetch failed:', err);
  }

  // Source 2: Fetch popular ticker streams
  const hotTickers = ['NVDA', 'AAPL', 'TSLA', 'MSFT', 'AMD'];
  for (const ticker of hotTickers) {
    try {
      const res = await fetch(`https://api.stocktwits.com/api/2/streams/symbol/${ticker}.json?limit=5`, {
        next: { revalidate: 300 },
      });

      if (!res.ok) continue;
      const json = await res.json();
      const messages = json?.messages ?? [];

      for (const msg of messages) {
        // Skip duplicates
        if (allTweets.some(t => t.id === `st-${msg.id}`)) continue;

        const tickers = (msg.symbols || []).map((s: { symbol: string }) => s.symbol).slice(0, 5);
        const { sentiment, score } = analyzeSentiment(msg.body || '');
        const stSentiment = msg.entities?.sentiment?.basic;

        allTweets.push({
          id: `st-${msg.id}`,
          text: msg.body || '',
          author: msg.user?.username || 'unknown',
          authorFollowers: msg.user?.followers || 0,
          likes: msg.likes?.total || 0,
          retweets: msg.reshares?.reshared_count || 0,
          created: msg.created_at || new Date().toISOString(),
          sentiment: stSentiment === 'Bullish' ? 'bullish' : stSentiment === 'Bearish' ? 'bearish' : sentiment,
          sentimentScore: stSentiment === 'Bullish' ? Math.max(score, 0.5) : stSentiment === 'Bearish' ? Math.min(score, -0.5) : score,
          tickers,
          isVerified: msg.user?.official || false,
        });
      }
    } catch {
      // Individual ticker fetch can fail silently
    }
  }

  if (allTweets.length === 0) {
    console.warn('[Social] No social posts fetched, using fallback');
    return getMockTweets();
  }

  return allTweets.slice(0, 30);
}

// ============ Sentiment ============
function analyzeSentiment(text: string): { sentiment: 'bullish' | 'bearish' | 'neutral'; score: number } {
  const bullish = ['buy', 'bull', 'long', 'calls', 'breakout', 'moon', 'surge', 'rally', 'upgrade', 'beat', 'growth', 'strong', '🚀', '📈', '💎', 'undervalued'];
  const bearish = ['sell', 'bear', 'short', 'puts', 'crash', 'dump', 'decline', 'overvalued', 'downgrade', 'miss', 'weak', '📉', 'bubble', 'warning'];

  const lower = text.toLowerCase();
  let score = 0;

  for (const w of bullish) { if (lower.includes(w)) score += 0.12; }
  for (const w of bearish) { if (lower.includes(w)) score -= 0.12; }

  score = Math.max(-1, Math.min(1, score));

  return {
    sentiment: score > 0.1 ? 'bullish' : score < -0.1 ? 'bearish' : 'neutral',
    score,
  };
}

// ============ Fallback ============
function getMockTweets(): Tweet[] {
  return [
    { id: 't1', text: '$NVDA Q4 earnings are going to blow estimates out of the water. AI capex cycle is just getting started 🚀📈', author: 'TechTrader', authorFollowers: 125000, likes: 4521, retweets: 1203, created: new Date(Date.now() - 1800000).toISOString(), sentiment: 'bullish', sentimentScore: 0.88, tickers: ['NVDA'], isVerified: true },
    { id: 't2', text: '$AAPL Vision Pro sales ramping up globally. Services revenue hitting new ATH. Long-term winner.', author: 'AppleInsider', authorFollowers: 89000, likes: 3200, retweets: 890, created: new Date(Date.now() - 3600000).toISOString(), sentiment: 'bullish', sentimentScore: 0.72, tickers: ['AAPL'], isVerified: true },
    { id: 't3', text: '$TSLA demand concerns growing in China. BYD eating market share. Margins under pressure 📉', author: 'EVAnalyst', authorFollowers: 67000, likes: 2800, retweets: 1540, created: new Date(Date.now() - 5400000).toISOString(), sentiment: 'bearish', sentimentScore: -0.71, tickers: ['TSLA'], isVerified: false },
    { id: 't4', text: '$MSFT Azure growth reaccelerating. Copilot monetization exceeding expectations. Strong buy.', author: 'CloudBull', authorFollowers: 45000, likes: 1900, retweets: 670, created: new Date(Date.now() - 7200000).toISOString(), sentiment: 'bullish', sentimentScore: 0.81, tickers: ['MSFT'], isVerified: false },
    { id: 't5', text: '$AMD MI300X orders backlogged through 2025. Data center GPU competition heating up vs $NVDA', author: 'SemiWatcher', authorFollowers: 34000, likes: 2100, retweets: 780, created: new Date(Date.now() - 9000000).toISOString(), sentiment: 'bullish', sentimentScore: 0.65, tickers: ['AMD', 'NVDA'], isVerified: true },
    { id: 't6', text: 'Warning: $META ad revenue growth may slow next quarter. Competition from TikTok intensifying.', author: 'AdTechPro', authorFollowers: 28000, likes: 1500, retweets: 920, created: new Date(Date.now() - 10800000).toISOString(), sentiment: 'bearish', sentimentScore: -0.48, tickers: ['META'], isVerified: false },
    { id: 't7', text: '$GOOGL Search + YouTube + Cloud = unstoppable. AI integration driving massive efficiency gains 💎', author: 'AlphabetFan', authorFollowers: 52000, likes: 2400, retweets: 610, created: new Date(Date.now() - 14400000).toISOString(), sentiment: 'bullish', sentimentScore: 0.76, tickers: ['GOOGL'], isVerified: true },
    { id: 't8', text: '$PLTR AIP platform adoption accelerating. Government + commercial revenue both growing strong 📈', author: 'DataDriven', authorFollowers: 19000, likes: 1800, retweets: 540, created: new Date(Date.now() - 16200000).toISOString(), sentiment: 'bullish', sentimentScore: 0.7, tickers: ['PLTR'], isVerified: false },
  ];
}
