export type Sentiment = 'bullish' | 'bearish' | 'neutral';
export type SignalStrength = 'strong' | 'moderate' | 'weak';
export type DataSource = 'reddit' | 'twitter' | 'news' | 'technical';

export interface StockSignal {
  ticker: string;
  name: string;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  sentiment: Sentiment;
  signalStrength: SignalStrength;
  confidence: number; // 0-100
  direction: 'up' | 'down';
  reasons: string[];
  sources: SourceMention[];
  volume: number;
  marketCap: string;
  sector: string;
  lastUpdated: string;
}

export interface SourceMention {
  source: DataSource;
  count: number;
  sentiment: Sentiment;
  score: number; // -1 to 1
  highlights: string[];
}

export interface RedditPost {
  id: string;
  title: string;
  subreddit: string;
  score: number;
  numComments: number;
  url: string;
  created: string;
  sentiment: Sentiment;
  sentimentScore: number;
  tickers: string[];
  selfText?: string;
  author: string;
}

export interface Tweet {
  id: string;
  text: string;
  author: string;
  authorFollowers: number;
  likes: number;
  retweets: number;
  created: string;
  sentiment: Sentiment;
  sentimentScore: number;
  tickers: string[];
  isVerified: boolean;
}

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  imageUrl?: string;
  publishedAt: string;
  sentiment: Sentiment;
  sentimentScore: number;
  tickers: string[];
  category: string;
}

export interface MarketOverview {
  sp500: MarketIndex;
  nasdaq: MarketIndex;
  dowJones: MarketIndex;
  vix: MarketIndex;
  fearGreedIndex: number;
  marketStatus: 'open' | 'closed' | 'pre-market' | 'after-hours';
  lastUpdated: string;
}

export interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

export interface TrendingTopic {
  topic: string;
  mentions: number;
  sentiment: Sentiment;
  sentimentScore: number;
  relatedTickers: string[];
  sources: DataSource[];
  trend: 'rising' | 'falling' | 'stable';
}

export interface AnalysisReport {
  generatedAt: string;
  marketSentiment: Sentiment;
  marketSentimentScore: number;
  topBullish: StockSignal[];
  topBearish: StockSignal[];
  trendingTopics: TrendingTopic[];
  keyInsights: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  dataSourceStatus: {
    reddit: boolean;
    twitter: boolean;
    news: boolean;
  };
}

export interface DashboardState {
  isLoading: boolean;
  lastRefresh: string | null;
  activeTab: 'overview' | 'bullish' | 'bearish' | 'news' | 'social';
  selectedStock: StockSignal | null;
}
