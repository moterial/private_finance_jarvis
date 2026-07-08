import { CandleData, PriceActionSignal, TechnicalReport } from '../types/extended';

/** Fetch REAL OHLCV candles from Yahoo Finance v8 chart API */
export async function fetchRealCandles(ticker: string, days: number = 60): Promise<CandleData[]> {
  try {
    const { yfChart } = await import('../services/yahoo');
    const range = days <= 30 ? '1mo' : days <= 90 ? '3mo' : '6mo';
    // yfChart already returns json.chart.result[0] — do NOT double-unwrap
    const ts = await yfChart(ticker, { range, interval: '1d' });
    if (!ts) return [];

    const timestamps: number[] = ts.timestamp || [];
    const q = ts.indicators?.quote?.[0];
    if (!q || timestamps.length === 0) return [];

    const candles: CandleData[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i], v = q.volume?.[i];
      if (o == null || h == null || l == null || c == null) continue;
      candles.push({
        date: new Date(timestamps[i] * 1000).toISOString().split('T')[0],
        open: Number(o.toFixed(2)),
        high: Number(h.toFixed(2)),
        low: Number(l.toFixed(2)),
        close: Number(c.toFixed(2)),
        volume: v || 0,
      });
    }
    return candles;
  } catch (e) {
    console.error(`[PriceAction] Failed to fetch real candles for ${ticker}:`, e);
    return [];
  }
}

/** @deprecated Use fetchRealCandles() instead. Kept only as last-resort empty fallback. */
export function generateCandleData(_ticker: string, _days: number = 60): CandleData[] {
  // Return empty — forces caller to handle missing data gracefully
  return [];
}

export function analyzePriceAction(candles: CandleData[], ticker: string): TechnicalReport {
  if (candles.length < 5) {
    return getEmptyReport(ticker);
  }

  const recent = candles.slice(-20);
  const current = candles[candles.length - 1];
  const prev = candles[candles.length - 2];

  // Determine trend using moving averages
  const sma10 = calcSMA(candles.slice(-10));
  const sma20 = calcSMA(candles.slice(-20));
  const sma50 = candles.length >= 50 ? calcSMA(candles.slice(-50)) : sma20;

  let trend: 'uptrend' | 'downtrend' | 'sideways' = 'sideways';
  let trendStrength = 0;

  if (current.close > sma10 && sma10 > sma20 && sma20 > sma50) {
    trend = 'uptrend';
    trendStrength = Math.min(((current.close - sma50) / sma50) * 100, 100);
  } else if (current.close < sma10 && sma10 < sma20 && sma20 < sma50) {
    trend = 'downtrend';
    trendStrength = Math.min(((sma50 - current.close) / sma50) * 100, 100);
  } else {
    trendStrength = 30;
  }

  // Find support & resistance levels
  const supportLevels = findSupport(candles);
  const resistanceLevels = findResistance(candles);

  // Detect Price Action signals
  const priceActionSignals = detectPriceActionPatterns(candles);

  // Detect candlestick patterns
  const candlePattern = detectCandlePattern(current, prev);

  // Generate recommendation
  const { recommendation, entryZone, stopLoss, targets } = generateRecommendation(
    current, trend, supportLevels, resistanceLevels, priceActionSignals
  );

  // Risk/Reward ratio (works for both buy and sell)
  let riskRewardRatio: number | null = null;
  if (entryZone && stopLoss && targets.length > 0) {
    if (recommendation === 'buy') {
      const risk = entryZone.low - stopLoss;
      const reward = targets[0] - entryZone.high;
      if (risk > 0 && reward > 0) riskRewardRatio = Number((reward / risk).toFixed(2));
    } else if (recommendation === 'sell') {
      const risk = stopLoss - entryZone.high;
      const reward = entryZone.low - targets[0];
      if (risk > 0 && reward > 0) riskRewardRatio = Number((reward / risk).toFixed(2));
    }
  }

  // Key levels
  const keyLevels = [
    ...supportLevels.slice(0, 3).map(p => ({ price: p, label: `Support $${p.toFixed(2)}`, type: 'support' as const })),
    ...resistanceLevels.slice(0, 3).map(p => ({ price: p, label: `Resistance $${p.toFixed(2)}`, type: 'resistance' as const })),
  ];

  const trendWord = trend === 'uptrend' ? 'bullish uptrend' : trend === 'downtrend' ? 'bearish downtrend' : 'sideways consolidation';
  const summary = `${ticker} is in a ${trendWord}. ${candlePattern ? `Recent pattern: ${candlePattern}. ` : ''}` +
    `Key support at $${supportLevels[0]?.toFixed(2) || 'N/A'}, resistance at $${resistanceLevels[0]?.toFixed(2) || 'N/A'}. ` +
    `Recommendation: ${recommendation.toUpperCase()}${riskRewardRatio ? ` (R:R ${riskRewardRatio})` : ''}.`;

  return {
    ticker,
    trend,
    trendStrength: Number(trendStrength.toFixed(1)),
    supportLevels,
    resistanceLevels,
    priceActionSignals,
    keyLevels,
    recommendation,
    entryZone,
    stopLoss,
    targets,
    riskRewardRatio,
    candlePattern,
    summary,
  };
}

function calcSMA(candles: CandleData[]): number {
  return candles.reduce((sum, c) => sum + c.close, 0) / candles.length;
}

function findSupport(candles: CandleData[]): number[] {
  const lows = candles.map(c => c.low);
  const supports: number[] = [];

  for (let i = 2; i < lows.length - 2; i++) {
    if (lows[i] <= lows[i-1] && lows[i] <= lows[i-2] && lows[i] <= lows[i+1] && lows[i] <= lows[i+2]) {
      supports.push(Number(lows[i].toFixed(2)));
    }
  }

  return [...new Set(supports)].sort((a, b) => b - a).slice(0, 5);
}

function findResistance(candles: CandleData[]): number[] {
  const highs = candles.map(c => c.high);
  const resistances: number[] = [];

  for (let i = 2; i < highs.length - 2; i++) {
    if (highs[i] >= highs[i-1] && highs[i] >= highs[i-2] && highs[i] >= highs[i+1] && highs[i] >= highs[i+2]) {
      resistances.push(Number(highs[i].toFixed(2)));
    }
  }

  return [...new Set(resistances)].sort((a, b) => a - b).slice(0, 5);
}

function detectPriceActionPatterns(candles: CandleData[]): PriceActionSignal[] {
  const signals: PriceActionSignal[] = [];
  if (candles.length < 5) return signals;

  const recent = candles.slice(-5);
  const current = recent[recent.length - 1];
  const prev = recent[recent.length - 2];
  const prev2 = recent[recent.length - 3];

  // Bullish engulfing
  if (prev.close < prev.open && current.close > current.open &&
      current.open <= prev.close && current.close >= prev.open) {
    signals.push({
      type: 'reversal', pattern: 'Bullish Engulfing',
      price: current.close, strength: 'strong', direction: 'bullish',
      description: 'Bullish engulfing candle suggests strong buying pressure and potential reversal upward.',
    });
  }

  // Bearish engulfing
  if (prev.close > prev.open && current.close < current.open &&
      current.open >= prev.close && current.close <= prev.open) {
    signals.push({
      type: 'reversal', pattern: 'Bearish Engulfing',
      price: current.close, strength: 'strong', direction: 'bearish',
      description: 'Bearish engulfing candle indicates strong selling pressure and potential reversal downward.',
    });
  }

  // Hammer (bullish reversal)
  const body = Math.abs(current.close - current.open);
  const lowerWick = Math.min(current.open, current.close) - current.low;
  const upperWick = current.high - Math.max(current.open, current.close);
  if (lowerWick > body * 2 && upperWick < body * 0.5 && body > 0) {
    signals.push({
      type: 'reversal', pattern: 'Hammer',
      price: current.close, strength: 'moderate', direction: 'bullish',
      description: 'Hammer pattern with long lower wick shows rejection of lower prices.',
    });
  }

  // Shooting star (bearish reversal)
  if (upperWick > body * 2 && lowerWick < body * 0.5 && body > 0) {
    signals.push({
      type: 'reversal', pattern: 'Shooting Star',
      price: current.close, strength: 'moderate', direction: 'bearish',
      description: 'Shooting star with long upper wick shows rejection of higher prices.',
    });
  }

  // Three consecutive bullish candles
  if (recent.slice(-3).every(c => c.close > c.open)) {
    signals.push({
      type: 'continuation', pattern: 'Three White Soldiers',
      price: current.close, strength: 'moderate', direction: 'bullish',
      description: 'Three consecutive bullish candles indicate sustained buying momentum.',
    });
  }

  // Three consecutive bearish candles
  if (recent.slice(-3).every(c => c.close < c.open)) {
    signals.push({
      type: 'continuation', pattern: 'Three Black Crows',
      price: current.close, strength: 'moderate', direction: 'bearish',
      description: 'Three consecutive bearish candles indicate sustained selling pressure.',
    });
  }

  // Support bounce
  const supports = findSupport(candles.slice(0, -2));
  for (const sup of supports) {
    if (current.low <= sup * 1.01 && current.close > sup && current.close > current.open) {
      signals.push({
        type: 'support', pattern: 'Support Bounce',
        price: sup, strength: 'strong', direction: 'bullish',
        description: `Price bounced off support level at $${sup.toFixed(2)}, confirming support holds.`,
      });
      break;
    }
  }

  // Resistance rejection
  const resistances = findResistance(candles.slice(0, -2));
  for (const res of resistances) {
    if (current.high >= res * 0.99 && current.close < res && current.close < current.open) {
      signals.push({
        type: 'resistance', pattern: 'Resistance Rejection',
        price: res, strength: 'strong', direction: 'bearish',
        description: `Price rejected at resistance level $${res.toFixed(2)}, confirming resistance holds.`,
      });
      break;
    }
  }

  return signals;
}

function detectCandlePattern(current: CandleData, prev: CandleData): string | null {
  const body = Math.abs(current.close - current.open);
  const totalRange = current.high - current.low;
  const lowerWick = Math.min(current.open, current.close) - current.low;
  const upperWick = current.high - Math.max(current.open, current.close);

  if (totalRange > 0 && body / totalRange < 0.1) return 'Doji';
  if (lowerWick > body * 2.5 && upperWick < body * 0.3) return current.close > current.open ? 'Hammer' : 'Hanging Man';
  if (upperWick > body * 2.5 && lowerWick < body * 0.3) return 'Shooting Star';
  if (body > 0 && totalRange > 0 && body / totalRange > 0.8) return current.close > current.open ? 'Marubozu (Bullish)' : 'Marubozu (Bearish)';

  return null;
}

function generateRecommendation(
  current: CandleData,
  trend: string,
  supports: number[],
  resistances: number[],
  signals: PriceActionSignal[]
) {
  let bullScore = 0;
  let bearScore = 0;

  if (trend === 'uptrend') bullScore += 2;
  if (trend === 'downtrend') bearScore += 2;

  for (const sig of signals) {
    if (sig.direction === 'bullish') bullScore += sig.strength === 'strong' ? 2 : 1;
    else bearScore += sig.strength === 'strong' ? 2 : 1;
  }

  let recommendation: 'buy' | 'sell' | 'hold' | 'wait' = 'hold';
  if (bullScore >= 4) recommendation = 'buy';
  else if (bearScore >= 4) recommendation = 'sell';
  else if (bullScore > bearScore + 1) recommendation = 'buy';
  else if (bearScore > bullScore + 1) recommendation = 'sell';
  else recommendation = 'wait';

  // Nearest support must be BELOW price and nearest resistance ABOVE it —
  // a swing low above the current price is not a usable stop level.
  const nearestSupport = supports.find(s => s < current.close) || current.close * 0.95;
  const nearestResistance = resistances.find(r => r > current.close) || current.close * 1.1;

  let entryZone: { low: number; high: number } | null = null;
  let stopLoss: number | null = null;
  let targets: number[] = [];

  if (recommendation === 'buy') {
    entryZone = {
      low: Number((current.close * 0.98).toFixed(2)),
      high: Number((current.close * 1.01).toFixed(2)),
    };
    stopLoss = Number((nearestSupport * 0.98).toFixed(2));
    // Ensure targets are ABOVE entry
    const t1 = Math.max(nearestResistance, current.close * 1.03);
    targets = [
      Number(t1.toFixed(2)),
      Number((t1 * 1.05).toFixed(2)),
    ];
  } else if (recommendation === 'sell') {
    entryZone = {
      low: Number((current.close * 0.99).toFixed(2)),
      high: Number((current.close * 1.02).toFixed(2)),
    };
    stopLoss = Number((nearestResistance * 1.02).toFixed(2));
    // Ensure targets are BELOW entry
    const t1 = Math.min(nearestSupport, current.close * 0.97);
    targets = [
      Number(t1.toFixed(2)),
      Number((t1 * 0.95).toFixed(2)),
    ];
  }

  return { recommendation, entryZone, stopLoss, targets };
}

function getEmptyReport(ticker: string): TechnicalReport {
  return {
    ticker, trend: 'sideways', trendStrength: 0, supportLevels: [], resistanceLevels: [],
    priceActionSignals: [], keyLevels: [], recommendation: 'wait',
    entryZone: null, stopLoss: null, targets: [], riskRewardRatio: null,
    candlePattern: null, summary: `Insufficient data for ${ticker} technical analysis.`,
  };
}
