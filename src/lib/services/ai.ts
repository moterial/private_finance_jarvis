import OpenAI from 'openai';
import { StockSignal, AnalysisReport, TrendingTopic, NewsArticle, RedditPost, Tweet } from '../types';
import { ExpertPick, ChainReaction, SectorRotation } from '../types/extended';

// ============ LLM Client (OpenAI-compatible) ============
function getClient(): OpenAI | null {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
  });
}

function isAIEnabled(): boolean {
  return !!process.env.LLM_API_KEY;
}

const MODEL = process.env.LLM_MODEL_NAME || 'gpt-4o-mini';

// ============ Helper ============
async function chatCompletion(systemPrompt: string, userPrompt: string, maxTokens = 1500): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    });
    return response.choices[0]?.message?.content ?? null;
  } catch (error) {
    console.error('[AI Service] OpenAI API error:', error);
    return null;
  }
}

async function chatJSON<T>(systemPrompt: string, userPrompt: string, maxTokens = 2000): Promise<T | null> {
  const client = getClient();
  if (!client) return null;

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.5,
      response_format: { type: 'json_object' },
    });
    const content = response.choices[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as T;
  } catch (error) {
    console.error('[AI Service] OpenAI JSON parse error:', error);
    return null;
  }
}

// ============ Locale Helpers ============
function getLanguageInstruction(locale: string): string {
  if (locale === 'zh') {
    return '\n\nIMPORTANT: You MUST respond entirely in Traditional Chinese (繁體中文). All text, analysis, and explanations must be in Chinese.';
  }
  return '';
}

// ============ Expert Market Analysis ============
export async function generateAIExpertNarrative(
  outlook: string,
  marketPhase: string,
  topPicks: ExpertPick[],
  avoidList: string[],
  chainReactions: ChainReaction[],
  keyRisks: string[],
  marketSentimentScore: number,
  locale: string = 'en',
): Promise<string | null> {
  if (!isAIEnabled()) return null;

  const systemPrompt = `You are a top-tier Wall Street quantitative strategist and personal investment advisor.
You speak with authority and precision. Your analysis is data-driven, actionable, and direct.
Keep it under 400 words. Structure your response in 4-5 short paragraphs separated by newlines.

Your paragraphs MUST follow this structure:
1. Market Overview: Current market regime and sentiment assessment
2. Action Plan: Specific buy/sell/hold recommendations with entry points and reasoning. Tell the user exactly what to do.
3. Sector Strategy: Which sectors to overweight/underweight right now and why
4. Risk Management: Specific stop-loss levels, position sizing advice, hedging suggestions
5. Bottom Line: A clear, bold 1-2 sentence verdict — e.g. "Aggressively accumulate NVDA on any dip below $140" or "Reduce exposure to tech and rotate into defensives"

Be OPINIONATED. Do NOT just describe the market — tell the user what actions to take, what to buy, what to sell, and when.
Do NOT give financial advice disclaimers — the user understands this is analysis, not advice.${getLanguageInstruction(locale)}`;

  const userPrompt = `Generate a comprehensive market analysis narrative based on this data:

MARKET STATE:
- Overall Outlook: ${outlook}
- Market Phase: ${marketPhase}
- Sentiment Score: ${marketSentimentScore.toFixed(2)} (-1 bearish to +1 bullish)

TOP PICKS (BUY signals):
${topPicks.map(p => `- ${p.ticker}: ${p.action} (${p.confidence}% confidence) — ${p.reasoning}`).join('\n')}

AVOID LIST (SELL/STAY AWAY):
${avoidList.length > 0 ? avoidList.join(', ') : 'None'}

SUPPLY CHAIN REACTIONS:
${chainReactions.slice(0, 5).map(c => `- ${c.triggerTicker} → impacts ${c.impactedTickers.map(t => t.ticker).join(', ')}: ${c.narrative}`).join('\n')}

KEY RISKS:
${keyRisks.map(r => `- ${r}`).join('\n')}

Write a professional market briefing with SPECIFIC actionable recommendations. Tell the user exactly what to buy, sell, or hold. Include entry prices, stop-losses, and target prices. End with a bold, clear bottom-line verdict.`;

  return chatCompletion(systemPrompt, userPrompt, 1500);
}

// ============ AI-Powered Insights ============
export async function generateAIInsights(
  bullish: StockSignal[],
  bearish: StockSignal[],
  topics: TrendingTopic[],
  news: NewsArticle[],
  redditPosts: RedditPost[],
  tweets: Tweet[],
  marketSentiment: number,
  locale: string = 'en',
): Promise<string[] | null> {
  if (!isAIEnabled()) return null;

  const systemPrompt = `You are a financial intelligence AI and personal trading advisor. Generate exactly 5 concise, actionable market insights.
Each insight MUST include a specific recommendation — tell the user what to do (buy, sell, hold, hedge, rotate).
Bad example: "Tech sector shows momentum" — too vague.
Good example: "Buy NVDA on pullbacks to $135-140 range, momentum and AI capex cycle support 15% upside to $165"
Each insight should be 1-2 sentences max. Be direct and opinionated.
Return as JSON: { "insights": ["insight1", "insight2", ...] }${getLanguageInstruction(locale)}`;

  const topNews = news.slice(0, 5).map(n => n.title).join('; ');
  const topReddit = redditPosts.slice(0, 3).map(r => `[${r.subreddit}] ${r.title} (score: ${r.score})`).join('; ');
  const topTweets = tweets.slice(0, 3).map(t => `@${t.author}: ${t.text.slice(0, 100)}`).join('; ');

  const userPrompt = `Analyze this market data and generate insights:

BULLISH SIGNALS: ${bullish.slice(0, 5).map(s => `${s.ticker}(${s.confidence}%)`).join(', ')}
BEARISH SIGNALS: ${bearish.slice(0, 5).map(s => `${s.ticker}(${s.confidence}%)`).join(', ')}
TRENDING TOPICS: ${topics.map(t => `${t.topic}(${t.sentiment})`).join(', ')}
MARKET SENTIMENT: ${marketSentiment.toFixed(2)}

TOP NEWS: ${topNews}
REDDIT BUZZ: ${topReddit}
TWITTER: ${topTweets}`;

  const result = await chatJSON<{ insights: string[] }>(systemPrompt, userPrompt, 800);
  return result?.insights ?? null;
}

// ============ Stock-Specific AI Analysis ============
export async function generateAIStockAnalysis(
  ticker: string,
  technicalSummary: string,
  trend: string,
  recommendation: string,
  supportLevels: number[],
  resistanceLevels: number[],
  chainReactions: ChainReaction[],
  locale: string = 'en',
): Promise<{ analysis: string; buyOrSell: string; reasoning: string } | null> {
  if (!isAIEnabled()) return null;

  const systemPrompt = `You are a professional equity research analyst and trading advisor. Provide a concise, opinionated stock analysis with a clear recommendation.
The "analysis" field should include specific entry price, stop-loss, and profit target. Be direct — tell the user exactly what to do with this stock.
The "reasoning" field should explain WHY in concrete terms (catalysts, technicals, risk/reward).
Return JSON: { "analysis": "2-3 sentence actionable overview with specific prices", "buyOrSell": "BUY|SELL|HOLD", "reasoning": "1-2 sentence key reasoning with catalyst" }${getLanguageInstruction(locale)}`;

  const userPrompt = `Analyze ${ticker}:
Technical: ${technicalSummary}
Trend: ${trend}, Recommendation: ${recommendation}
Support levels: ${supportLevels.join(', ')}
Resistance levels: ${resistanceLevels.join(', ')}
Supply chain impacts: ${chainReactions.map(c => c.narrative).join('; ') || 'None detected'}`;

  return chatJSON(systemPrompt, userPrompt, 500);
}

// ============ Portfolio AI Advice ============
export async function generateAIPortfolioAdvice(
  positions: { ticker: string; shares: number; avgCost: number; currentPrice: number; notes?: string }[],
  marketOutlook: string,
  marketSentiment: number,
  locale: string = 'en',
): Promise<{ summary: string; suggestions: string[] } | null> {
  if (!isAIEnabled()) return null;

  const systemPrompt = `You are a portfolio management advisor. Analyze the user's portfolio and provide actionable advice.
Return JSON: { "summary": "2-3 sentence portfolio assessment", "suggestions": ["suggestion1", "suggestion2", ...] }
Max 5 suggestions. Be specific about which positions to adjust and why.${getLanguageInstruction(locale)}`;

  const positionStr = positions.map(p => {
    const pnl = ((p.currentPrice - p.avgCost) / p.avgCost * 100).toFixed(1);
    return `${p.ticker}: ${p.shares} shares @ $${p.avgCost} (now $${p.currentPrice}, ${pnl}%)${p.notes ? ` [User note: ${p.notes}]` : ''}`;
  }).join('\n');

  const userPrompt = `Portfolio positions:
${positionStr}

Market outlook: ${marketOutlook}
Market sentiment: ${marketSentiment.toFixed(2)}

Analyze diversification, risk exposure, and provide specific rebalancing suggestions.`;

  return chatJSON(systemPrompt, userPrompt, 800);
}

// ============ Sector Rotation AI ============
export async function generateAISectorRotation(
  bullish: StockSignal[],
  bearish: StockSignal[],
  topics: TrendingTopic[],
  locale: string = 'en',
): Promise<SectorRotation[] | null> {
  if (!isAIEnabled()) return null;

  const systemPrompt = `You are a sector rotation analyst. Based on current market signals, determine sector flows.
Return JSON: { "rotations": [{ "sector": "name", "direction": "inflow|outflow|neutral", "strength": 0-100, "relatedTickers": ["T1","T2"] }] }
Include 5-7 sectors.${getLanguageInstruction(locale)}`;

  const userPrompt = `Current bullish: ${bullish.map(s => `${s.ticker}(${s.sector})`).join(', ')}
Current bearish: ${bearish.map(s => `${s.ticker}(${s.sector})`).join(', ')}
Trending: ${topics.map(t => `${t.topic}(${t.sentiment})`).join(', ')}`;

  const result = await chatJSON<{ rotations: SectorRotation[] }>(systemPrompt, userPrompt, 800);
  return result?.rotations ?? null;
}

// ============ Future Strategy / 未來佈局 ============
export interface StrategyPlan {
  shortTerm: { title: string; actions: string[]; timeframe: string };
  midTerm: { title: string; actions: string[]; timeframe: string };
  longTerm: { title: string; actions: string[]; timeframe: string };
  catalysts: { event: string; expectedDate: string; impact: string; affectedTickers: string[] }[];
  portfolioAllocation: { category: string; percentage: number; reasoning: string }[];
  bottomLine: string;
}

export async function generateAIStrategy(
  analysis: AnalysisReport,
  bullish: StockSignal[],
  bearish: StockSignal[],
  topics: TrendingTopic[],
  news: NewsArticle[],
  locale: string = 'en',
): Promise<StrategyPlan | null> {
  if (!isAIEnabled()) return null;

  const systemPrompt = `You are a senior portfolio strategist and investment advisor. Generate a comprehensive forward-looking investment strategy plan.
You MUST be specific and actionable — give exact ticker symbols, price targets, percentage allocations, and time horizons.
Do NOT be vague. The user needs a concrete playbook they can follow.

Return JSON with this exact structure:
{
  "shortTerm": {
    "title": "1-2 sentence strategy title",
    "actions": ["specific action 1 with ticker and price", "action 2", "action 3", "action 4"],
    "timeframe": "1-2 weeks"
  },
  "midTerm": {
    "title": "1-2 sentence strategy title",
    "actions": ["specific action 1", "action 2", "action 3"],
    "timeframe": "1-3 months"
  },
  "longTerm": {
    "title": "1-2 sentence strategy title",
    "actions": ["specific action 1", "action 2", "action 3"],
    "timeframe": "6-12 months"
  },
  "catalysts": [
    { "event": "event description", "expectedDate": "approximate date", "impact": "bullish|bearish|neutral", "affectedTickers": ["TICK1","TICK2"] }
  ],
  "portfolioAllocation": [
    { "category": "category name", "percentage": 30, "reasoning": "why" }
  ],
  "bottomLine": "2-3 sentence bold, direct verdict telling user exactly what to do right now"
}

Include 3-5 catalysts and 4-6 allocation categories. All percentages in portfolioAllocation must sum to 100.${getLanguageInstruction(locale)}`;

  const userPrompt = `Generate a forward-looking investment strategy based on current market data:

MARKET SENTIMENT: ${analysis.marketSentimentScore.toFixed(2)} (-1 to +1)
TRENDING TOPICS: ${topics.slice(0, 8).map(t => `${t.topic}(${t.sentiment})`).join(', ')}

TOP BULLISH SIGNALS:
${bullish.slice(0, 8).map(s => `- ${s.ticker} (${s.sector}): score ${s.compositeScore.toFixed(1)}, sources: ${s.sources.join(', ')}`).join('\n')}

TOP BEARISH SIGNALS:
${bearish.slice(0, 5).map(s => `- ${s.ticker} (${s.sector}): score ${s.compositeScore.toFixed(1)}`).join('\n')}

RECENT NEWS HEADLINES:
${news.slice(0, 8).map(n => `- ${n.title}`).join('\n')}

Based on this data, create a complete investment strategy with short-term trades, mid-term positioning, long-term thesis, upcoming catalysts to watch, and recommended portfolio allocation.`;

  return chatJSON<StrategyPlan>(systemPrompt, userPrompt, 2500);
}

export { isAIEnabled };
