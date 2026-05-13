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
// DeepSeek reasoning models spend tokens on hidden reasoning_content before generating visible content.
// We multiply max_tokens to ensure enough budget for both reasoning + output.
const IS_REASONING_MODEL = MODEL.includes('deepseek');
const TOKEN_MULTIPLIER = IS_REASONING_MODEL ? 8 : 1;

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

export async function chatJSON<T>(systemPrompt: string, userPrompt: string, maxTokens = 2000, timeoutMs = 90000): Promise<T | null> {
  const client = getClient();
  if (!client) return null;

  // Reinforce language at end of user prompt for models that deprioritize system instructions
  const finalUserPrompt = systemPrompt.includes('繁體中文')
    ? userPrompt + '\n\n[回覆語言：繁體中文。所有 JSON value 必須是中文。]'
    : userPrompt;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: finalUserPrompt },
      ],
      max_tokens: maxTokens * TOKEN_MULTIPLIER,
      temperature: 0.5,
      response_format: { type: 'json_object' },
    }, { signal: controller.signal });
    clearTimeout(timer);
    const choice = response.choices[0];
    let content = choice?.message?.content;
    // DeepSeek reasoning models: fallback to reasoning_content
    if (!content) {
      content = (choice?.message as unknown as Record<string, unknown>)?.reasoning_content as string | undefined || null;
    }
    if (!content) return null;
    return JSON.parse(content) as T;
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

  const systemPrompt = `You are JARVIS — a ruthlessly sharp hedge fund CIO with 20 years of experience who sees what others miss.

Your analytical style:
- You find the HIDDEN narrative — what the crowd is missing, where consensus is wrong
- You connect dots others don't: a supply chain shift in Taiwan → semiconductor pricing → NVDA earnings surprise
- You think in second and third-order effects: "Everyone sees X, but nobody is pricing in Y, which means Z"
- You challenge popular narratives when data contradicts them
- You identify asymmetric bets — situations where risk/reward is heavily skewed in one direction
- You use concrete numbers: "This setup has 3:1 reward-to-risk" not vague "looks promising"

Structure your response in 4-5 short paragraphs separated by newlines:
1. The Hidden Signal: What is the market MISSING right now? What's the non-obvious insight?
2. Contrarian Edge: Where is consensus wrong? What's the crowd overlooking?
3. The Play: Exact trades — tickers, entries, stops, targets. Position sizing.
4. Risk Radar: The scenario that would invalidate your thesis. What to watch.
5. Conviction Call: One bold sentence. Your highest-conviction move right now.

Keep it under 400 words. Be provocative. Challenge lazy thinking. Name specific catalysts with dates when possible.
Do NOT give disclaimers.${getLanguageInstruction(locale)}`;

  const today = new Date().toISOString().split('T')[0];
  const userPrompt = `TODAY'S DATE: ${today}. All dates and catalysts you mention must be in the future relative to today.

Generate a comprehensive market analysis narrative based on this data:

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

Do NOT write a generic market briefing. Find the HIDDEN story in this data — the connection others aren't making, the signal buried in the noise. What asymmetric opportunity does this data reveal? What is the crowd getting wrong? End with your single highest-conviction call.`;

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

  const systemPrompt = `You are JARVIS — a contrarian market analyst who finds alpha where others see noise.

Generate exactly 5 market insights. Each MUST reveal a NON-OBVIOUS connection or contrarian angle:
- Cross-reference different data sources to find hidden patterns (Reddit buzz + news + price action = ?)
- Identify divergences: where sentiment and price disagree, opportunity hides
- Spot the "second derivative" — not what's moving, but what's ABOUT to move and why
- Challenge the obvious narrative when data supports a different conclusion

Bad: "Tech sector shows momentum" — everyone can see that.
Bad: "NVDA is bullish based on AI trends" — that's consensus, not insight.
Good: "Reddit retail is piling into AMD calls while smart money flows show institutional accumulation in MRVL — the real AI infrastructure play is shifting downstream. Buy MRVL $85-88."
Good: "Social sentiment on TSLA is 80% bullish but options flow shows massive put buying — insiders see something retail doesn't. Hedge or reduce."

Each insight: 1-2 sentences. Must include a specific action with ticker and price.
Return as JSON: { "insights": ["insight1", "insight2", ...] }${getLanguageInstruction(locale)}`;

  const topNews = news.slice(0, 5).map(n => n.title).join('; ');
  const topReddit = redditPosts.slice(0, 3).map(r => `[${r.subreddit}] ${r.title} (score: ${r.score})`).join('; ');
  const topTweets = tweets.slice(0, 3).map(t => `@${t.author}: ${t.text.slice(0, 100)}`).join('; ');

  const today = new Date().toISOString().split('T')[0];
  const userPrompt = `TODAY'S DATE: ${today}. Any dates mentioned must be future dates.

Analyze this market data and generate insights:

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

  const systemPrompt = `You are JARVIS — a sharp equity analyst who sees beyond the chart.
Do NOT give a generic technical summary. Instead:
- What is the ASYMMETRIC opportunity here? Calculate the reward-to-risk ratio.
- What catalyst could trigger the next major move? Be specific (earnings date, product launch, regulatory decision).
- What is the crowd missing about this stock? Where is consensus wrong?
- If bullish: where exactly to buy and what would make you wrong.
- If bearish: where to short/sell and what's the bear case everyone ignores.
Return JSON: { "analysis": "2-3 sentences with a unique insight, specific prices, and reward/risk ratio", "buyOrSell": "BUY|SELL|HOLD", "reasoning": "1-2 sentences explaining the NON-OBVIOUS catalyst or edge" }${getLanguageInstruction(locale)}`;

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

  const result = await chatJSON<StrategyPlan>(systemPrompt, userPrompt, 2500, 45000);
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
