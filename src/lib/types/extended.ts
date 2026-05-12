// ============ Agent Types ============
export type AgentId = 'news' | 'social' | 'technical' | 'supplyChain' | 'expert';
export type AgentStatus = 'active' | 'processing' | 'idle' | 'error';

export interface AgentState {
  id: AgentId;
  name: string;
  status: AgentStatus;
  lastRun: string | null;
  findings: AgentFinding[];
  processingTime?: number;
}

export interface AgentFinding {
  id: string;
  agentId: AgentId;
  type: 'signal' | 'alert' | 'insight' | 'chain-reaction';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  tickers: string[];
  confidence: number;
  timestamp: string;
  data?: Record<string, unknown>;
}

export interface ExpertSummary {
  overallOutlook: 'bullish' | 'bearish' | 'neutral' | 'cautious';
  marketPhase: string;
  topPicks: ExpertPick[];
  avoidList: string[];
  sectorRotation: SectorRotation[];
  chainReactions: ChainReaction[];
  keyRisks: string[];
  narrative: string;
  generatedAt: string;
}

export interface ExpertPick {
  ticker: string;
  action: 'strong-buy' | 'buy' | 'hold' | 'sell' | 'strong-sell';
  reasoning: string;
  entryZone: { low: number; high: number };
  targets: number[];
  stopLoss: number;
  timeframe: string;
  confidence: number;
}

export interface SectorRotation {
  sector: string;
  direction: 'inflow' | 'outflow' | 'neutral';
  strength: number;
  relatedTickers: string[];
}

export interface ChainReaction {
  trigger: string;
  triggerTicker: string;
  impactedSectors: string[];
  impactedTickers: { ticker: string; impact: 'positive' | 'negative'; reason: string }[];
  confidence: number;
  narrative: string;
}

// ============ Technical Analysis Types ============
export interface CandleData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceActionSignal {
  type: 'support' | 'resistance' | 'breakout' | 'breakdown' | 'reversal' | 'continuation';
  pattern: string;
  price: number;
  strength: 'strong' | 'moderate' | 'weak';
  direction: 'bullish' | 'bearish';
  description: string;
}

export interface TechnicalReport {
  ticker: string;
  trend: 'uptrend' | 'downtrend' | 'sideways';
  trendStrength: number;
  supportLevels: number[];
  resistanceLevels: number[];
  priceActionSignals: PriceActionSignal[];
  keyLevels: { price: number; label: string; type: 'support' | 'resistance' }[];
  recommendation: 'buy' | 'sell' | 'hold' | 'wait';
  entryZone: { low: number; high: number } | null;
  stopLoss: number | null;
  targets: number[];
  riskRewardRatio: number | null;
  candlePattern: string | null;
  summary: string;
}

// ============ Portfolio Types ============
export interface PortfolioPosition {
  ticker: string;
  name: string;
  shares: number;
  avgCost: number;
  addedAt: string;
  notes: string;
  sector: string;
}

export interface Portfolio {
  positions: PortfolioPosition[];
  watchlist: string[];
  lastUpdated: string;
}

export interface PortfolioStats {
  totalValue: number;
  totalCost: number;
  todayPnl: number;
  todayPnlPercent: number;
  totalPnl: number;
  totalPnlPercent: number;
  positions: PortfolioPositionWithLive[];
}

export interface PortfolioPositionWithLive extends PortfolioPosition {
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

export interface AIPortfolioAdvice {
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
  diversificationScore: number;
  riskScore: number;
  suggestions: string[];
  rebalanceActions: { ticker: string; action: 'increase' | 'decrease' | 'hold' | 'exit'; reason: string }[];
  sectorExposure: { sector: string; percent: number; status: 'overweight' | 'underweight' | 'balanced' }[];
}

// ============ AddStock Modal Types ============
export interface StockPreview {
  ticker: string;
  name: string;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  sector: string;
  marketCap: string;
  candles: CandleData[];
  technicalReport: TechnicalReport;
  relatedNews: { title: string; source: string; sentiment: string; date: string }[];
  aiRecommendation: ExpertPick;
  chainReactions: ChainReaction[];
}
