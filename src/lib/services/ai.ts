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
// Reasoning models (DeepSeek R1, Gemini 2.5 thinking) spend tokens on hidden reasoning
// before generating visible content — with a tight max_tokens they return EMPTY content.
// We multiply max_tokens to ensure enough budget for both reasoning + output.
const IS_REASONING_MODEL = MODEL.includes('deepseek') || MODEL.includes('gemini') || MODEL.includes('glm') || MODEL.includes('gpt-oss') || MODEL.includes('qwen');
const TOKEN_MULTIPLIER = IS_REASONING_MODEL ? 8 : 1;

// Gemini thinking models accept reasoning_effort via the OpenAI-compat endpoint.
// Cap it at 'low' — unbounded thinking regularly blows past our request timeouts
// on large JSON generations (e.g. the strategy plan).
const EXTRA_PARAMS: Record<string, unknown> = MODEL.includes('gemini') ? { reasoning_effort: 'low' } : {};

// NVIDIA NIM free tier queues GLM requests for minutes at a time (measured
// ~275s per request). Stretch timeouts so calls can actually complete; results
// are server-cached for 15 min so users mostly hit the cache, not the queue.
const IS_SLOW_QUEUE_MODEL = MODEL.includes('glm');
// 180s default: large-brain models (Qwen 397B) need >90s for big JSON
// generations like the strategy plan. AI runs as background enrichment, so a
// longer wait beats a fallback.
const DEFAULT_JSON_TIMEOUT = IS_SLOW_QUEUE_MODEL ? 340000 : 180000;

export async function chatCompletion(systemPrompt: string, userPrompt: string, maxTokens = 1500): Promise<string | null> {
  const client = getClient();
  if (!client) return null;

  // Reinforce language at end of user prompt for models that deprioritize system instructions
  const finalUserPrompt = systemPrompt.includes('繁體中文')
    ? userPrompt + '\n\n[回覆語言：繁體中文。請用中文回答。]'
    : userPrompt;

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: finalUserPrompt },
      ],
      max_tokens: maxTokens * TOKEN_MULTIPLIER,
      temperature: 0.7,
      ...EXTRA_PARAMS,
    });
    const choice = response.choices[0];
    // DeepSeek reasoning models may return content in reasoning_content when content is empty
    const content = choice?.message?.content;
    if (content) return content;
    const reasoning = (choice?.message as unknown as Record<string, unknown>)?.reasoning_content as string | undefined;
    return reasoning || null;
  } catch (error) {
    console.error('[AI Service] OpenAI API error:', error);
    return null;
  }
}

export async function chatJSON<T>(systemPrompt: string, userPrompt: string, maxTokens = 2000, timeoutMs = DEFAULT_JSON_TIMEOUT): Promise<T | null> {
  const client = getClient();
  if (!client) return null;

  // Reinforce language at end of user prompt for models that deprioritize system instructions
  const finalUserPrompt = systemPrompt.includes('繁體中文')
    ? userPrompt + '\n\n[回覆語言：繁體中文。所有 JSON value 必須是中文。]'
    : userPrompt;

  const runRequest = async (useJsonMode: boolean): Promise<string | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await client.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: finalUserPrompt },
        ],
        max_tokens: maxTokens * TOKEN_MULTIPLIER,
        temperature: 0.5,
        ...(useJsonMode ? { response_format: { type: 'json_object' as const } } : {}),
        ...EXTRA_PARAMS,
      }, { signal: controller.signal });
      const choice = response.choices[0];
      // Reasoning models may put output in reasoning_content when content is empty
      return choice?.message?.content
        || ((choice?.message as unknown as Record<string, unknown>)?.reasoning_content as string | undefined)
        || null;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    let content: string | null;
    try {
      content = await runRequest(true);
    } catch (e: unknown) {
      // Some providers (e.g. certain NVIDIA NIM models) reject response_format —
      // retry once in plain mode and parse the JSON out of the text.
      const msg = String((e as Error)?.message || e);
      const isBadRequest = msg.includes('400') || /response_format|json_object/i.test(msg);
      if (!isBadRequest) throw e;
      content = await runRequest(false);
    }
    if (!content) return null;
    // Strip markdown fences / surrounding prose if the model added any
    const jsonText = content.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1]
      || content.slice(content.indexOf('{'), content.lastIndexOf('}') + 1)
      || content;
    return JSON.parse(jsonText) as T;
  } catch (error) {
    console.error('[AI Service] OpenAI JSON parse error:', error);
    return null;
  }
}

// ============ Locale Helpers ============
export function getLanguageInstruction(locale: string): string {
  if (locale === 'zh') {
    return '\n\n[LANGUAGE REQUIREMENT — MANDATORY]\n你必須完全使用繁體中文回覆。所有分析、見解、建議和解釋都必須是中文。不要使用英文。This is non-negotiable: respond ENTIRELY in Traditional Chinese (繁體中文).';
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

  const systemPrompt = `You are JARVIS — a macro strategist who reads the battlefield.

Your job: Give the user a 2-3 sentence STRATEGIC CONTEXT for today's market. NOT individual trade ideas (those are handled separately).

What to say:
- What REGIME are we in? (risk-on, risk-off, rotation, compression before breakout)
- What is the ONE macro factor driving everything today? (yields, dollar, oil, earnings season, FOMC)
- What is the market pricing in vs what could surprise? (positioning asymmetry)
- If there's a sector rotation happening, name it: "Money flowing FROM [sector] TO [sector]"

Examples of GOOD responses:
- "Risk-on regime. 10Y yield broke below 4.2% — this unlocks tech multiple expansion. Growth > Value until yields reverse. Key level: SPX 5,500 support."
- "市場處於壓縮階段。VIX在14附近，期權隱含波動率創新低。大行情即將到來，方向待定。關鍵催化劑：下週三CPI數據。"
- "Sector rotation accelerating: institutions dumping defensives (XLU -2.3%), piling into semis. This leg has 5-7 days left before mean reversion."

Do NOT:
- Mention specific entry/stop/target (that's in the trade cards below)
- Repeat the same tickers that appear in the top picks
- Say generic things like "market is volatile" or "be careful"

Max 3 sentences. Pure macro context. Think like a CIO briefing the trading desk at 7am.${getLanguageInstruction(locale)}`;

  const today = new Date().toISOString().split('T')[0];
  const userPrompt = `TODAY'S DATE: ${today}. All dates and catalysts you mention must be in the future relative to today.

Generate a comprehensive market analysis narrative based on this data:

MARKET STATE:
- Overall Outlook: ${outlook}
- Market Phase: ${marketPhase}
- Sentiment Score: ${marketSentimentScore.toFixed(2)} (-1 bearish to +1 bullish)

TOP PICKS (with REAL technical levels from price action analysis):
${topPicks.map(p => `- ${p.ticker}: ${p.action} (${p.confidence}% confidence)
    Entry Zone: $${p.entryZone.low.toFixed(2)} – $${p.entryZone.high.toFixed(2)}
    Stop Loss: $${p.stopLoss.toFixed(2)}
    Targets: ${p.targets.map(t => '$' + t.toFixed(2)).join(' → ')}
    Timeframe: ${p.timeframe}
    Thesis: ${p.reasoning}`).join('\n')}

AVOID LIST (SELL/STAY AWAY):
${avoidList.length > 0 ? avoidList.join(', ') : 'None'}

SUPPLY CHAIN REACTIONS:
${chainReactions.slice(0, 5).map(c => `- ${c.triggerTicker} → impacts ${c.impactedTickers.map(t => t.ticker).join(', ')}: ${c.narrative}`).join('\n')}

KEY RISKS:
${keyRisks.map(r => `- ${r}`).join('\n')}

CRITICAL INSTRUCTIONS:
- Use the EXACT entry/stop/target prices above. Do NOT invent different numbers.
- Calculate risk:reward ratio from the levels given (e.g. entry $150, target $165, stop $143 = 1:2.1 R:R).
- Tell the user EXACTLY what to do: "Buy NVDA at $X, stop at $Y, first target $Z."
- Explain WHY this setup works in 1-2 sentences (catalyst, technical pattern, flow data).
- If the data shows conflicting signals, say so — don't force a directional call.
- End with ONE highest-conviction trade with exact numbers.`;

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

  const systemPrompt = `You are JARVIS — a signal hunter who spots ANOMALIES and DIVERGENCES that others miss.

Generate exactly 3 MICRO-SIGNALS. Each must be a SPECIFIC, ACTIONABLE observation that is NOT obvious from just looking at prices.

What counts as a good signal:
- DIVERGENCE: "${bullish[0]?.ticker || 'NVDA'} price up 3% but social sentiment turning negative — smart money distribution. Tighten stop to $X."
- FLOW ANOMALY: "Reddit going crazy bullish on ${bearish[0]?.ticker || 'TSLA'} but price falling — retail is bagholding. Avoid or short."
- TIMING: "${bullish[0]?.ticker || 'AAPL'} earnings in 5 days, implied vol 45% vs realized 28% — sell premium or wait for post-earnings dip."
- HIDDEN CONNECTION: "News says copper demand up → check FCX/SCCO. Not on anyone's radar yet."

What does NOT count:
- Repeating the top picks that are already shown (don't say "NVDA looks bullish" — they can see that)
- Generic statements about sector momentum
- Anything without a specific ticker and price/action

Each signal: 1 sentence MAX. Format: "[SIGNAL TYPE] ticker + observation + action"
Return as JSON: { "insights": ["signal1", "signal2", "signal3"] }${getLanguageInstruction(locale)}`;

  const topNews = news.slice(0, 5).map(n => n.title).join('; ');
  const topReddit = redditPosts.slice(0, 3).map(r => `[${r.subreddit}] ${r.title} (score: ${r.score})`).join('; ');
  const topTweets = tweets.slice(0, 3).map(t => `@${t.author}: ${t.text.slice(0, 100)}`).join('; ');

  const today = new Date().toISOString().split('T')[0];
  const userPrompt = `TODAY'S DATE: ${today}. Any dates mentioned must be future dates.

Analyze this market data and generate insights:

BULLISH SIGNALS (with real prices):
${bullish.slice(0, 5).map(s => `- ${s.ticker} $${s.currentPrice.toFixed(2)} (${s.priceChangePercent > 0 ? '+' : ''}${s.priceChangePercent.toFixed(1)}%) conf:${s.confidence}%${s.entryPrice ? ` entry:$${s.entryPrice} target:$${s.exitTarget} stop:$${s.stopLoss} R:R=${s.riskReward}` : ''} — ${s.reasons[0] || ''}`).join('\n')}

BEARISH SIGNALS:
${bearish.slice(0, 5).map(s => `- ${s.ticker} $${s.currentPrice.toFixed(2)} (${s.priceChangePercent > 0 ? '+' : ''}${s.priceChangePercent.toFixed(1)}%) conf:${s.confidence}% — ${s.reasons[0] || ''}`).join('\n')}

TRENDING TOPICS: ${topics.map(t => `${t.topic}(${t.sentiment})`).join(', ')}
MARKET SENTIMENT: ${marketSentiment.toFixed(2)}

NEWS: ${topNews}
REDDIT: ${topReddit}
TWITTER: ${topTweets}

IMPORTANT: Use the EXACT prices and levels above. Each insight must include a specific ticker, price, and action.`;

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

  const systemPrompt = `You are JARVIS — a ruthless equity sniper. You do NOT give generic analysis. You give EXACT trades.

Rules:
- State your EXACT entry price, stop loss, and profit target. No ranges wider than 2%.
- Calculate risk:reward ratio. If worse than 1:1.5, say PASS.
- Name the specific catalyst: earnings date, ex-div date, options expiry, macro event.
- If the chart shows nothing actionable, say "NO SETUP — WAIT" instead of forcing a weak trade.
- Be brutally honest. If support is broken, say SHORT. If uptrend is intact, say BUY THE DIP.
- One paragraph max. Every sentence must contain a number or a date.

Return JSON: { "analysis": "1-3 sentences: EXACT entry, stop, target, catalyst, R:R ratio", "buyOrSell": "BUY|SELL|HOLD|WAIT", "reasoning": "1 sentence: the ONE non-obvious edge" }${getLanguageInstruction(locale)}`;

  const today = new Date().toISOString().split('T')[0];
  const userPrompt = `TODAY'S DATE: ${today}.
Analyze ${ticker}:
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

  const systemPrompt = `You are JARVIS — a portfolio risk manager who spots what others miss in position construction.
Don't just say "diversify more." Instead:
- Identify hidden correlations between positions (e.g. "NVDA and AMD will move together in a semiconductor downturn — you're 2x exposed to one risk factor")
- Find the portfolio's blind spot: what scenario would hurt ALL positions simultaneously?
- Suggest specific hedges: "Buy SPY puts at X strike" or "Add 5% gold exposure via GLD as a tail risk hedge"
- Calculate the portfolio's effective beta and suggest how to adjust it
Return JSON: { "summary": "2-3 sentence portfolio assessment with a NON-OBVIOUS insight", "suggestions": ["suggestion1", "suggestion2", ...] }
Max 5 suggestions. Each must be specific with ticker, action, and reasoning.${getLanguageInstruction(locale)}`;

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

  const systemPrompt = `You are JARVIS — a macro strategist who thinks in probabilities, scenarios, and asymmetric bets.

Your strategy must be DISTINCTIVE:
- Short-term: Not just "buy dips" — identify specific catalysts within days/weeks that create mispriced opportunities
- Mid-term: Think thematically — what structural shift is underpriced? What trend has 70%+ probability of continuing?
- Long-term: What is the 10x opportunity that nobody is talking about yet? What paradigm shift is underway?
- Catalysts: Be SPECIFIC with dates — earnings, Fed meetings, product launches, regulatory deadlines
- Allocation: Think like an endowment — include alternatives, hedges, and optionality, not just "buy stocks"

The user wants to feel like they have an EDGE — not generic advice they could get from any newsletter.

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

  const today = new Date().toISOString().split('T')[0];
  const userPrompt = `TODAY'S DATE: ${today}
IMPORTANT: All dates in your response (catalysts, timeframes, expectedDate) MUST be in the future relative to ${today}. Never use past dates.

Generate a forward-looking investment strategy based on current market data:

MARKET SENTIMENT: ${analysis.marketSentimentScore.toFixed(2)} (-1 to +1)
TRENDING TOPICS: ${topics.slice(0, 8).map(t => `${t.topic}(${t.sentiment})`).join(', ')}

TOP BULLISH SIGNALS:
${bullish.slice(0, 8).map(s => `- ${s.ticker} (${s.sector}): confidence ${s.confidence}%, sources: ${(s.sources || []).map(src => src.source).join(', ')}`).join('\n')}

TOP BEARISH SIGNALS:
${bearish.slice(0, 5).map(s => `- ${s.ticker} (${s.sector}): confidence ${s.confidence}%`).join('\n')}

RECENT NEWS HEADLINES:
${news.slice(0, 8).map(n => `- ${n.title}`).join('\n')}

Based on this data, find the NON-OBVIOUS opportunities. What is mispriced? Where is the crowd wrong? What second-order effect is nobody pricing in? Create a strategy that gives the user a genuine edge — not generic advice.`;

  const result = await chatJSON<StrategyPlan>(systemPrompt, userPrompt, 2500, DEFAULT_JSON_TIMEOUT);
  if (result) return result;

  // Fallback: generate a basic strategy from the data if AI fails/times out
  return generateFallbackStrategy(analysis, bullish, bearish, locale);
}

function generateFallbackStrategy(
  analysis: AnalysisReport,
  bullish: StockSignal[],
  bearish: StockSignal[],
  locale: string,
): StrategyPlan {
  const isZh = locale === 'zh';
  const topBull = bullish.slice(0, 3);
  const topBear = bearish.slice(0, 2);
  const sentiment = analysis.marketSentimentScore;
  const bullish_bias = sentiment > 0.1;

  return {
    shortTerm: {
      title: isZh
        ? `短線關注 ${topBull.map(s => s.ticker).join(', ')} 的動量機會`
        : `Short-term momentum in ${topBull.map(s => s.ticker).join(', ')}`,
      actions: topBull.map(s =>
        isZh ? `買入 ${s.ticker} (${s.sector}) — 信心度 ${s.confidence}%` : `Buy ${s.ticker} (${s.sector}) — confidence ${s.confidence}%`
      ).concat(topBear.slice(0, 1).map(s =>
        isZh ? `避開 ${s.ticker} — 看空信號強` : `Avoid ${s.ticker} — strong bearish signal`
      )),
      timeframe: isZh ? '1-2 週' : '1-2 weeks',
    },
    midTerm: {
      title: isZh
        ? `中期佈局${bullish_bias ? '偏多' : '謹慎'}策略`
        : `Mid-term ${bullish_bias ? 'bullish' : 'cautious'} positioning`,
      actions: [
        isZh ? `市場情緒分數: ${sentiment.toFixed(2)} — ${bullish_bias ? '偏多' : '中性偏空'}` : `Market sentiment: ${sentiment.toFixed(2)} — ${bullish_bias ? 'bullish' : 'cautious'}`,
        ...(topBull.slice(0, 2).map(s => isZh ? `加碼 ${s.ticker} 在回調時` : `Add ${s.ticker} on pullbacks`)),
        isZh ? '保持 10-15% 現金部位' : 'Keep 10-15% cash reserve',
      ],
      timeframe: isZh ? '1-3 個月' : '1-3 months',
    },
    longTerm: {
      title: isZh ? '長期核心持倉配置' : 'Long-term core allocation',
      actions: [
        isZh ? '科技/AI 板塊維持超配' : 'Overweight tech/AI sector',
        isZh ? '分散配置防禦性標的' : 'Diversify into defensive names',
        isZh ? '定期再平衡每季一次' : 'Rebalance quarterly',
      ],
      timeframe: isZh ? '6-12 個月' : '6-12 months',
    },
    catalysts: topBull.slice(0, 3).map(s => ({
      event: isZh ? `${s.ticker} 財報/產品發布` : `${s.ticker} earnings/product launch`,
      expectedDate: isZh ? '近期' : 'Upcoming',
      impact: 'bullish',
      affectedTickers: [s.ticker],
    })).concat(topBear.slice(0, 2).map(s => ({
      event: isZh ? `${s.ticker} 潛在風險事件` : `${s.ticker} potential risk event`,
      expectedDate: isZh ? '近期' : 'Upcoming',
      impact: 'bearish',
      affectedTickers: [s.ticker],
    }))),
    portfolioAllocation: [
      { category: isZh ? '成長股' : 'Growth', percentage: 40, reasoning: isZh ? '高動量標的' : 'High momentum names' },
      { category: isZh ? '科技/AI' : 'Tech/AI', percentage: 25, reasoning: isZh ? '長期結構性趨勢' : 'Structural long-term trend' },
      { category: isZh ? '防禦/債券' : 'Defensive/Bonds', percentage: 15, reasoning: isZh ? '下行保護' : 'Downside protection' },
      { category: isZh ? '現金' : 'Cash', percentage: 10, reasoning: isZh ? '等待機會' : 'Dry powder for opportunities' },
      { category: isZh ? '另類資產' : 'Alternatives', percentage: 10, reasoning: isZh ? '分散風險' : 'Diversification' },
    ],
    bottomLine: isZh
      ? `市場情緒${bullish_bias ? '偏多' : '中性'}，建議${bullish_bias ? '積極佈局' : '謹慎操作'}。重點關注 ${topBull.map(s => s.ticker).join(', ')}。`
      : `Market sentiment is ${bullish_bias ? 'bullish' : 'neutral'}. ${bullish_bias ? 'Lean into' : 'Be cautious with'} positions. Focus on ${topBull.map(s => s.ticker).join(', ')}.`,
  };
}

export { isAIEnabled };
