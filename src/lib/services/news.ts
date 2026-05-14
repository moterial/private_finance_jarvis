import { NewsArticle } from '../types';

/**
 * Fetch financial news from free RSS feeds — NO API KEY needed.
 * Sources: Yahoo Finance, MarketWatch, CNBC, Google News.
 * Falls back to mock data if all feeds fail.
 */

interface RSSFeed {
  url: string;
  source: string;
}

const RSS_FEEDS: RSSFeed[] = [
  // ── Financial / stock-specific ──
  { url: 'https://feeds.finance.yahoo.com/rss/2.0/headline?s=AAPL,NVDA,MSFT,GOOGL,TSLA,AMD,META,AMZN,PLTR,JPM&region=US&lang=en-US', source: 'Yahoo Finance' },
  { url: 'https://news.google.com/rss/search?q=stock+market+OR+NVDA+OR+AAPL+OR+TSLA+OR+MSFT&hl=en-US&gl=US&ceid=US:en', source: 'Google News' },
  { url: 'https://feeds.marketwatch.com/marketwatch/topstories/', source: 'MarketWatch' },
  { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', source: 'CNBC' },
  // ── Political / geopolitical (market-moving) ──
  { url: 'https://news.google.com/rss/search?q=Trump+OR+president+tariff+OR+trade+deal+OR+sanctions+OR+executive+order+stock+market+OR+economy&hl=en-US&gl=US&ceid=US:en', source: 'Google News Politics' },
  { url: 'https://news.google.com/rss/search?q=US+China+trade+OR+CEO+visit+Beijing+OR+White+House+economy+OR+Fed+rate&hl=en-US&gl=US&ceid=US:en', source: 'Google News Geopolitics' },
  { url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000113', source: 'CNBC Politics' },
  // ── Key figure X/social posts (via Google News) ──
  { url: 'https://news.google.com/rss/search?q=%22Trump+said%22+OR+%22Trump+posted%22+OR+%22Truth+Social%22+market+OR+economy+OR+tariff+OR+trade&hl=en-US&gl=US&ceid=US:en', source: 'X - Trump' },
  { url: 'https://news.google.com/rss/search?q=%22Elon+Musk%22+tweet+OR+post+OR+said+stock+OR+crypto+OR+Tesla+OR+DOGE&hl=en-US&gl=US&ceid=US:en', source: 'X - Elon Musk' },
];

export async function fetchNews(): Promise<NewsArticle[]> {
  const allArticles: NewsArticle[] = [];

  // Try all RSS feeds in parallel
  const results = await Promise.allSettled(
    RSS_FEEDS.map(feed => fetchRSSFeed(feed))
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allArticles.push(...result.value);
    }
  }

  if (allArticles.length === 0) {
    console.warn('[News] All RSS feeds failed, returning empty');
    return [];
  }

  // Sort by date descending, deduplicate by title similarity
  const sorted = allArticles.sort((a, b) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return deduplicateArticles(sorted).slice(0, 40);
}

async function fetchRSSFeed(feed: RSSFeed): Promise<NewsArticle[]> {
  try {
    const res = await fetch(feed.url, {
      headers: { 'User-Agent': 'JarvisFinance/1.0' },
      next: { revalidate: 600 }, // cache 10 min
    });

    if (!res.ok) {
      console.warn(`[News] ${feed.source} RSS returned ${res.status}`);
      return [];
    }

    const xml = await res.text();
    return parseRSSXml(xml, feed.source);
  } catch (err) {
    console.error(`[News] ${feed.source} RSS failed:`, err);
    return [];
  }
}

// Simple XML parser for RSS — no external dependency needed
function parseRSSXml(xml: string, source: string): NewsArticle[] {
  const articles: NewsArticle[] = [];

  // Extract <item> blocks
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  let idx = 0;

  while ((match = itemRegex.exec(xml)) !== null && idx < 20) {
    const block = match[1];

    const title = extractTag(block, 'title');
    const description = extractTag(block, 'description') || extractTag(block, 'media:description') || '';
    const link = extractTag(block, 'link') || extractTag(block, 'guid') || '';
    const pubDate = extractTag(block, 'pubDate');
    const imageUrl = extractMediaImage(block);

    if (!title) continue;

    // Clean HTML from description
    const cleanDesc = description.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").slice(0, 400);
    const cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '');

    const tickers = extractTickersFromNews(cleanTitle + ' ' + cleanDesc);
    const { sentiment, score } = analyzeNewsSentiment(cleanTitle + ' ' + cleanDesc);
    const category = detectCategory(cleanTitle + ' ' + cleanDesc, source, tickers);

    articles.push({
      id: `rss-${source.toLowerCase().replace(/\s/g, '')}-${idx}`,
      title: cleanTitle,
      description: cleanDesc,
      source,
      url: link.replace(/<!\[CDATA\[|\]\]>/g, ''),
      imageUrl: imageUrl || undefined,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      sentiment,
      sentimentScore: score,
      tickers,
      category,
    });

    idx++;
  }

  return articles;
}

function extractTag(block: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = block.match(regex);
  if (!match) return '';
  return match[1].replace(/<!\[CDATA\[|\]\]>/g, '').trim();
}

function extractMediaImage(block: string): string | null {
  // Try media:content url
  const mediaMatch = block.match(/url="(https?:\/\/[^"]+\.(jpg|jpeg|png|webp|gif)[^"]*)"/i);
  if (mediaMatch) return mediaMatch[1];

  // Try enclosure
  const encMatch = block.match(/<enclosure[^>]+url="(https?:\/\/[^"]+)"/i);
  if (encMatch) return encMatch[1];

  return null;
}

// ============ Category Detection ============
const POLITICAL_KEYWORDS = [
  'trump', 'president', 'white house', 'congress', 'senate', 'tariff',
  'trade war', 'trade deal', 'sanctions', 'executive order', 'biden',
  'xi jinping', 'beijing', 'geopolitical', 'diplomatic', 'election',
  'truth social', 'political', 'government', 'legislation', 'policy',
  'elon musk', 'ceo visit', 'state visit',
];

function detectCategory(text: string, source: string, tickers: string[]): string {
  const lower = text.toLowerCase();

  // Political/geopolitical
  if (source.includes('Politics') || source.includes('Geopolitics') || source.startsWith('X -')) {
    return 'political';
  }
  if (POLITICAL_KEYWORDS.some(kw => lower.includes(kw))) {
    return 'political';
  }

  // Other categories
  if (lower.includes('earning') || lower.includes('revenue') || lower.includes('quarterly')) return 'earnings';
  if (lower.includes('fed ') || lower.includes('interest rate') || lower.includes('inflation')) return 'macro';
  if (tickers.length > 0) return 'stocks';
  return 'market';
}

function deduplicateArticles(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Set<string>();
  return articles.filter(a => {
    const key = a.title.toLowerCase().slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ============ Ticker Extraction ============
const COMPANY_TO_TICKER: Record<string, string> = {
  'apple': 'AAPL', 'microsoft': 'MSFT', 'google': 'GOOGL', 'alphabet': 'GOOGL',
  'amazon': 'AMZN', 'nvidia': 'NVDA', 'meta': 'META', 'facebook': 'META',
  'tesla': 'TSLA', 'amd': 'AMD', 'intel': 'INTC', 'netflix': 'NFLX',
  'palantir': 'PLTR', 'coinbase': 'COIN', 'disney': 'DIS', 'boeing': 'BA',
  'jpmorgan': 'JPM', 'jp morgan': 'JPM', 'visa': 'V', 'paypal': 'PYPL',
  'broadcom': 'AVGO', 'salesforce': 'CRM', 'oracle': 'ORCL',
  'uber': 'UBER', 'airbnb': 'ABNB', 'shopify': 'SHOP',
  'qualcomm': 'QCOM', 'micron': 'MU', 'taiwan semi': 'TSM', 'tsmc': 'TSM',
};

function extractTickersFromNews(text: string): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();

  for (const [name, ticker] of Object.entries(COMPANY_TO_TICKER)) {
    if (lower.includes(name)) found.add(ticker);
  }

  const explicit = text.match(/\$([A-Z]{1,5})\b/g) || [];
  for (const m of explicit) {
    found.add(m.slice(1));
  }

  return [...found].slice(0, 5);
}

// ============ Sentiment ============
function analyzeNewsSentiment(text: string): { sentiment: 'bullish' | 'bearish' | 'neutral'; score: number } {
  const bullish = [
    'growth', 'surge', 'rally', 'beat', 'record', 'upgrade', 'strong', 'gain',
    'profit', 'revenue growth', 'outperform', 'breakthrough', 'innovation',
    'soars', 'jumps', 'rises',
    // political / geopolitical bullish
    'trade deal', 'deal signed', 'tariff cut', 'tariff reduction', 'tariff pause',
    'sanctions lifted', 'trade agreement', 'open up', 'cooperation',
    'rate cut', 'stimulus', 'infrastructure bill', 'deregulation',
    'peace', 'ceasefire', 'diplomatic', 'partnership',
  ];
  const bearish = [
    'decline', 'fall', 'crash', 'miss', 'loss', 'downgrade', 'weak', 'risk',
    'layoff', 'recession', 'investigation', 'lawsuit', 'fine',
    'plunges', 'drops', 'slides', 'slumps',
    // political / geopolitical bearish
    'tariff hike', 'new tariff', 'trade war', 'sanctions', 'ban', 'embargo',
    'executive order restrict', 'government shutdown', 'debt ceiling',
    'impeach', 'indictment', 'escalation', 'military strike', 'invasion',
    'retaliation', 'blacklist', 'export control',
  ];

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

// Dead mock removed — all data must be real
