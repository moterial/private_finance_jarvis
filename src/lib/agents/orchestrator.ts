import { AgentState, AgentFinding, ExpertSummary, ExpertPick, ChainReaction, SectorRotation } from '../types/extended';
import { StockSignal, RedditPost, Tweet, NewsArticle, TrendingTopic, AnalysisReport } from '../types';
import { analyzeSupplyChain } from '../analysis/supply-chain';
import { fetchRealCandles, analyzePriceAction } from '../analysis/price-action';
import { generateAIExpertNarrative, generateAISectorRotation, isAIEnabled } from '../services/ai';

// ============ Agent States ============
export function createInitialAgentStates(): AgentState[] {
  return [
    { id: 'news', name: 'News Monitor', status: 'idle', lastRun: null, findings: [] },
    { id: 'social', name: 'Social Sentinel', status: 'idle', lastRun: null, findings: [] },
    { id: 'technical', name: 'Technical Analyst', status: 'idle', lastRun: null, findings: [] },
    { id: 'supplyChain', name: 'Supply Chain Mapper', status: 'idle', lastRun: null, findings: [] },
    { id: 'expert', name: 'Expert Strategist', status: 'idle', lastRun: null, findings: [] },
  ];
}

// ============ News Agent ============
export function runNewsAgent(articles: NewsArticle[]): AgentFinding[] {
  const findings: AgentFinding[] = [];

  // Find high-impact news
  const bullishNews = articles.filter(a => a.sentimentScore > 0.5);
  const bearishNews = articles.filter(a => a.sentimentScore < -0.4);

  for (const article of bullishNews) {
    findings.push({
      id: `news-${article.id}`,
      agentId: 'news',
      type: 'signal',
      severity: article.sentimentScore > 0.7 ? 'high' : 'medium',
      title: `Bullish catalyst: ${article.tickers.join(', ') || 'Market'}`,
      description: article.title,
      tickers: article.tickers,
      confidence: Math.round(Math.abs(article.sentimentScore) * 100),
      timestamp: article.publishedAt,
    });
  }

  for (const article of bearishNews) {
    findings.push({
      id: `news-bear-${article.id}`,
      agentId: 'news',
      type: 'alert',
      severity: article.sentimentScore < -0.6 ? 'high' : 'medium',
      title: `Bearish warning: ${article.tickers.join(', ') || 'Market'}`,
      description: article.title,
      tickers: article.tickers,
      confidence: Math.round(Math.abs(article.sentimentScore) * 100),
      timestamp: article.publishedAt,
    });
  }

  return findings;
}

// ============ Social Agent ============
export function runSocialAgent(redditPosts: RedditPost[], tweets: Tweet[]): AgentFinding[] {
  const findings: AgentFinding[] = [];

  // Detect viral sentiment shifts
  const highEngagementPosts = redditPosts.filter(p => p.score > 5000);
  for (const post of highEngagementPosts) {
    findings.push({
      id: `social-r-${post.id}`,
      agentId: 'social',
      type: 'insight',
      severity: post.score > 10000 ? 'high' : 'medium',
      title: `Viral ${post.sentiment} sentiment on r/${post.subreddit}`,
      description: post.title,
      tickers: post.tickers,
      confidence: Math.round(Math.abs(post.sentimentScore) * 85),
      timestamp: post.created,
    });
  }

  // Detect influential tweets
  const influentialTweets = tweets.filter(t => t.authorFollowers > 50000 || t.isVerified);
  for (const tweet of influentialTweets) {
    findings.push({
      id: `social-t-${tweet.id}`,
      agentId: 'social',
      type: 'insight',
      severity: tweet.authorFollowers > 100000 ? 'high' : 'medium',
      title: `Influencer @${tweet.author} ${tweet.sentiment} on ${tweet.tickers.join(', ')}`,
      description: tweet.text.slice(0, 200),
      tickers: tweet.tickers,
      confidence: Math.round(Math.abs(tweet.sentimentScore) * 80),
      timestamp: tweet.created,
    });
  }

  return findings;
}

// ============ Technical Agent ============
export async function runTechnicalAgent(tickers: string[]): Promise<AgentFinding[]> {
  const findings: AgentFinding[] = [];

  for (const ticker of tickers) {
    const candles = await fetchRealCandles(ticker, 60);
    const report = analyzePriceAction(candles, ticker);

    if (report.recommendation === 'buy' || report.recommendation === 'sell') {
      findings.push({
        id: `tech-${ticker}`,
        agentId: 'technical',
        type: 'signal',
        severity: report.priceActionSignals.some(s => s.strength === 'strong') ? 'high' : 'medium',
        title: `${report.recommendation.toUpperCase()} signal: ${ticker}`,
        description: report.summary,
        tickers: [ticker],
        confidence: Math.round(report.trendStrength + 30),
        timestamp: new Date().toISOString(),
        data: {
          trend: report.trend,
          entryZone: report.entryZone,
          stopLoss: report.stopLoss,
          targets: report.targets,
          candlePattern: report.candlePattern,
          riskReward: report.riskRewardRatio,
        },
      });
    }

    // Report notable patterns
    for (const signal of report.priceActionSignals.filter(s => s.strength === 'strong')) {
      findings.push({
        id: `tech-pa-${ticker}-${signal.pattern}`,
        agentId: 'technical',
        type: 'insight',
        severity: 'medium',
        title: `${signal.pattern} detected on ${ticker}`,
        description: signal.description,
        tickers: [ticker],
        confidence: 70,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return findings;
}

// ============ Supply Chain Agent ============
export function runSupplyChainAgent(signals: StockSignal[]): { findings: AgentFinding[]; chainReactions: ChainReaction[] } {
  const findings: AgentFinding[] = [];
  const allChainReactions: ChainReaction[] = [];

  for (const signal of signals.filter(s => s.confidence > 60)) {
    const sentiment = signal.direction === 'up' ? 'bullish' : 'bearish';
    const catalyst = signal.reasons[0] || `${signal.ticker} shows ${sentiment} momentum`;
    const reactions = analyzeSupplyChain(signal.ticker, sentiment as 'bullish' | 'bearish', catalyst);

    allChainReactions.push(...reactions);

    for (const reaction of reactions) {
      const impactedTickers = reaction.impactedTickers.map(t => t.ticker);
      findings.push({
        id: `chain-${signal.ticker}-${impactedTickers.join('-')}`,
        agentId: 'supplyChain',
        type: 'chain-reaction',
        severity: reaction.confidence > 70 ? 'high' : 'medium',
        title: `${signal.ticker} → ${impactedTickers.join(', ')}`,
        description: reaction.narrative,
        tickers: [signal.ticker, ...impactedTickers],
        confidence: reaction.confidence,
        timestamp: new Date().toISOString(),
        data: { reaction },
      });
    }
  }

  return { findings, chainReactions: allChainReactions };
}

// ============ Expert Agent ============
export async function runExpertAgent(
  analysis: AnalysisReport,
  allFindings: AgentFinding[],
  chainReactions: ChainReaction[],
  locale: string = 'en',
): Promise<ExpertSummary> {
  // Aggregate all findings
  const highPriorityFindings = allFindings.filter(f => f.severity === 'high');
  const signals = allFindings.filter(f => f.type === 'signal');
  const alerts = allFindings.filter(f => f.type === 'alert');

  // Determine overall outlook
  const bullishSignals = signals.filter(f => f.title.toLowerCase().includes('bull') || f.title.toLowerCase().includes('buy'));
  const bearishSignals = signals.filter(f => f.title.toLowerCase().includes('bear') || f.title.toLowerCase().includes('sell'));

  let overallOutlook: 'bullish' | 'bearish' | 'neutral' | 'cautious' = 'neutral';
  if (bullishSignals.length > bearishSignals.length * 1.5) overallOutlook = 'bullish';
  else if (bearishSignals.length > bullishSignals.length * 1.5) overallOutlook = 'bearish';
  else if (alerts.length > 3) overallOutlook = 'cautious';

  // Generate top picks
  const topPicks: ExpertPick[] = [];
  for (const signal of analysis.topBullish.slice(0, 5)) {
    const candles = await fetchRealCandles(signal.ticker, 60);
    const ta = analyzePriceAction(candles, signal.ticker);
    topPicks.push({
      ticker: signal.ticker,
      action: signal.confidence > 80 ? 'strong-buy' : signal.confidence > 60 ? 'buy' : 'hold',
      reasoning: `${signal.reasons[0] || 'Strong multi-source sentiment'}. Technical: ${ta.summary.split('.')[0]}.`,
      entryZone: ta.entryZone || { low: signal.currentPrice * 0.98, high: signal.currentPrice * 1.01 },
      targets: ta.targets.length > 0 ? ta.targets : [signal.currentPrice * 1.05, signal.currentPrice * 1.1],
      stopLoss: ta.stopLoss || signal.currentPrice * 0.95,
      timeframe: signal.confidence > 80 ? '1-2 weeks' : '2-4 weeks',
      confidence: signal.confidence,
    });
  }

  // Avoid list
  const avoidList = analysis.topBearish
    .filter(s => s.confidence > 65)
    .map(s => s.ticker);

  // Sector rotation — try AI first, fall back to static
  const fallbackSectorRotation: SectorRotation[] = [
    { sector: 'Technology', direction: 'inflow', strength: 85, relatedTickers: ['NVDA', 'MSFT', 'AAPL'] },
    { sector: 'AI/Semiconductors', direction: 'inflow', strength: 92, relatedTickers: ['NVDA', 'AMD', 'AVGO'] },
    { sector: 'Automotive/EV', direction: 'outflow', strength: 45, relatedTickers: ['TSLA', 'RIVN'] },
    { sector: 'Financial', direction: 'neutral', strength: 50, relatedTickers: ['JPM', 'GS'] },
    { sector: 'Cloud/SaaS', direction: 'inflow', strength: 78, relatedTickers: ['MSFT', 'AMZN', 'GOOGL'] },
  ];

  let sectorRotation = fallbackSectorRotation;
  const aiSectorRotation = await generateAISectorRotation(analysis.topBullish, analysis.topBearish, analysis.trendingTopics, locale);
  if (aiSectorRotation && aiSectorRotation.length > 0) {
    sectorRotation = aiSectorRotation;
  }

  // Key risks — derived from real data, not hardcoded
  const keyRisks: string[] = [];
  if (alerts.length > 0) keyRisks.push(`${alerts.length} active bearish alert(s): ${alerts.slice(0, 3).map(a => a.title).join('; ')}`);
  if (analysis.topBearish.length > 3) keyRisks.push(`${analysis.topBearish.length} stocks showing bearish signals — broad-based selling pressure`);
  if (analysis.marketSentimentScore < -0.3) keyRisks.push(`Market sentiment deeply negative (${analysis.marketSentimentScore.toFixed(2)}) — risk-off environment`);
  if (analysis.riskLevel === 'high' || analysis.riskLevel === 'extreme') keyRisks.push(`Overall risk level: ${analysis.riskLevel.toUpperCase()} — reduce position sizes`);
  for (const cr of chainReactions.filter(c => c.confidence > 70).slice(0, 2)) {
    keyRisks.push(`Supply chain risk: ${cr.triggerTicker} → ${cr.impactedTickers.map(t => t.ticker).join(', ')}`);
  }
  if (keyRisks.length === 0) keyRisks.push('No elevated risks detected — normal market conditions');

  // Determine market phase
  let marketPhase = 'Accumulation Phase';
  if (overallOutlook === 'bullish' && analysis.marketSentimentScore > 0.5) marketPhase = 'Markup Phase (Bull Run)';
  else if (overallOutlook === 'bearish') marketPhase = 'Distribution Phase';
  else if (analysis.marketSentimentScore < -0.3) marketPhase = 'Markdown Phase (Correction)';

  // Expert narrative — try AI first, fall back to rule-based
  const fallbackNarrative = generateExpertNarrative(overallOutlook, marketPhase, topPicks, avoidList, chainReactions, keyRisks);
  const aiNarrative = await generateAIExpertNarrative(
    overallOutlook,
    marketPhase,
    topPicks,
    avoidList,
    chainReactions,
    keyRisks,
    analysis.marketSentimentScore,
    locale,
  );
  const narrative = aiNarrative || fallbackNarrative;

  return {
    overallOutlook,
    marketPhase,
    topPicks,
    avoidList,
    sectorRotation,
    chainReactions,
    keyRisks,
    narrative,
    generatedAt: new Date().toISOString(),
  };
}

function generateExpertNarrative(
  outlook: string,
  phase: string,
  picks: ExpertPick[],
  avoid: string[],
  chains: ChainReaction[],
  risks: string[]
): string {
  const pickNames = picks.slice(0, 3).map(p => p.ticker).join(', ');
  const avoidNames = avoid.slice(0, 2).join(', ');
  const chainCount = chains.length;

  let narrative = `Market is currently in a ${phase} with an overall ${outlook} outlook.`;

  if (picks.length > 0) {
    const pickDetails = picks.slice(0, 3).map(p => `${p.ticker} (${p.action}, entry $${p.entryZone.low.toFixed(0)}-$${p.entryZone.high.toFixed(0)}, target $${p.targets[0]?.toFixed(0)})`).join('; ');
    narrative += `\n\nRecommendation: Actively accumulate ${pickDetails}. These are backed by cross-platform sentiment consensus and favorable price action setups with strong risk/reward profiles.`;
  }

  if (avoid.length > 0) {
    narrative += `\n\nSell or reduce exposure to ${avoidNames} immediately — bearish signals detected across multiple data sources. Consider using any bounces as exit opportunities.`;
  }

  if (chainCount > 0) {
    narrative += `\n\nSector strategy: Supply chain analysis reveals ${chainCount} active chain reactions. Follow the momentum flow — overweight sectors showing inflow signals and underweight those with outflow.`;
  }

  if (risks.length > 0) {
    narrative += `\n\nRisk management: ${risks[0]}. Keep position sizes at 3-5% max per trade and set stop-losses 5-8% below entry.`;
  }

  narrative += `\n\nBottom line: ${outlook === 'bullish' ? 'Stay aggressive — buy dips and ride the trend. Focus capital on top conviction picks above.' : outlook === 'bearish' ? 'Go defensive — raise cash, trim losers, and wait for better entries. Capital preservation is priority.' : 'Be selective — only take high-conviction setups with tight stops. Keep 30-40% cash as dry powder.'}`;

  return narrative;
}

// ============ Orchestrator ============
export interface OrchestratorResult {
  agentStates: AgentState[];
  expertSummary: ExpertSummary;
  allFindings: AgentFinding[];
  chainReactions: ChainReaction[];
}

export async function orchestrateAgents(
  analysis: AnalysisReport,
  redditPosts: RedditPost[],
  tweets: Tweet[],
  newsArticles: NewsArticle[],
  locale: string = 'en',
): Promise<OrchestratorResult> {
  const startTime = Date.now();
  const agentStates = createInitialAgentStates();
  const allFindings: AgentFinding[] = [];

  // Run News Agent
  const newsFindings = runNewsAgent(newsArticles);
  allFindings.push(...newsFindings);
  updateAgentState(agentStates, 'news', 'active', newsFindings, Date.now() - startTime);

  // Run Social Agent
  const socialFindings = runSocialAgent(redditPosts, tweets);
  allFindings.push(...socialFindings);
  updateAgentState(agentStates, 'social', 'active', socialFindings, Date.now() - startTime);

  // Run Technical Agent on all mentioned tickers
  const allTickers = [...new Set([
    ...analysis.topBullish.map(s => s.ticker),
    ...analysis.topBearish.map(s => s.ticker),
  ])];
  const techFindings = await runTechnicalAgent(allTickers);
  allFindings.push(...techFindings);
  updateAgentState(agentStates, 'technical', 'active', techFindings, Date.now() - startTime);

  // Run Supply Chain Agent
  const allSignals = [...analysis.topBullish, ...analysis.topBearish];
  const { findings: chainFindings, chainReactions } = runSupplyChainAgent(allSignals);
  allFindings.push(...chainFindings);
  updateAgentState(agentStates, 'supplyChain', 'active', chainFindings, Date.now() - startTime);

  // Run Expert Agent (synthesizes everything)
  const expertSummary = await runExpertAgent(analysis, allFindings, chainReactions, locale);
  const expertFinding: AgentFinding = {
    id: 'expert-summary',
    agentId: 'expert',
    type: 'insight',
    severity: 'high',
    title: `Market Outlook: ${expertSummary.overallOutlook.toUpperCase()}`,
    description: expertSummary.narrative,
    tickers: expertSummary.topPicks.map(p => p.ticker),
    confidence: 85,
    timestamp: new Date().toISOString(),
  };
  updateAgentState(agentStates, 'expert', 'active', [expertFinding], Date.now() - startTime);

  return { agentStates, expertSummary, allFindings, chainReactions };
}

function updateAgentState(states: AgentState[], id: string, status: AgentState['status'], findings: AgentFinding[], time: number) {
  const state = states.find(s => s.id === id);
  if (state) {
    state.status = status;
    state.lastRun = new Date().toISOString();
    state.findings = findings;
    state.processingTime = time;
  }
}
