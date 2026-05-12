import { CandleData, PriceActionSignal, TechnicalReport } from '../types/extended';

export function generateCandleData(ticker: string, days: number = 60): CandleData[] {
  // Deterministic seed from ticker name
  let seed = 0;
  for (let i = 0; i < ticker.length; i++) seed += ticker.charCodeAt(i) * (i + 1);

  const basePrice = getBasePrice(ticker);
  const volatility = getVolatility(ticker);
  const candles: CandleData[] = [];
  let price = basePrice * (0.85 + pseudoRandom(seed++) * 0.15);

  for (let i = days; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    const change = (pseudoRandom(seed++) - 0.48) * volatility * price;
    const open = price;
    const close = price + change;
    const highExtra = Math.abs(change) * (0.2 + pseudoRandom(seed++) * 0.8);
    const lowExtra = Math.abs(change) * (0.2 + pseudoRandom(seed++) * 0.8);
    const high = Math.max(open, close) + highExtra;
    const low = Math.min(open, close) - lowExtra;
    const volume = Math.floor(1000000 + pseudoRandom(seed++) * 50000000);

    candles.push({
      date: date.toISOString().split('T')[0],
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });

    price = close;
  }

  return candles;
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

  // Risk/Reward ratio
  let riskRewardRatio: number | null = null;
  if (entryZone && stopLoss && targets.length > 0) {
    const risk = entryZone.low - stopLoss;
    const reward = targets[0] - entryZone.high;
    if (risk > 0) riskRewardRatio = Number((reward / risk).toFixed(2));
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

  const nearestSupport = supports[0] || current.close * 0.95;
  const nearestResistance = resistances[0] || current.close * 1.1;

  let entryZone: { low: number; high: number } | null = null;
  let stopLoss: number | null = null;
  let targets: number[] = [];

  if (recommendation === 'buy') {
    entryZone = {
      low: Number((current.close * 0.98).toFixed(2)),
      high: Number((current.close * 1.01).toFixed(2)),
    };
    stopLoss = Number((nearestSupport * 0.98).toFixed(2));
    targets = [
      Number((nearestResistance).toFixed(2)),
      Number((nearestResistance * 1.05).toFixed(2)),
      Number((nearestResistance * 1.10).toFixed(2)),
    ];
  } else if (recommendation === 'sell') {
    entryZone = {
      low: Number((current.close * 0.99).toFixed(2)),
      high: Number((current.close * 1.02).toFixed(2)),
    };
    stopLoss = Number((nearestResistance * 1.02).toFixed(2));
    targets = [
      Number((nearestSupport).toFixed(2)),
      Number((nearestSupport * 0.95).toFixed(2)),
    ];
  }

  return { recommendation, entryZone, stopLoss, targets };
}

function getBasePrice(ticker: string): number {
  const prices: Record<string, number> = {
    NVDA: 142.50, AAPL: 198.30, MSFT: 445.20, GOOGL: 178.90, AMZN: 195.40,
    META: 525.80, TSLA: 248.60, AMD: 168.40, PLTR: 27.80, INTC: 31.20,
    JPM: 205.10, NFLX: 685.30, COIN: 225.40, DIS: 112.80, BA: 178.50,
    V: 285.60, MA: 468.90, PYPL: 67.30, SQ: 78.40, SOFI: 8.90,
    NIO: 5.40, RIVN: 12.80, SNOW: 165.20, CRM: 275.40, SHOP: 78.60,
  };
  return prices[ticker] || 100;
}

function getVolatility(ticker: string): number {
  const vol: Record<string, number> = {
    NVDA: 0.035, TSLA: 0.04, AMD: 0.035, COIN: 0.045, PLTR: 0.04,
    NIO: 0.05, RIVN: 0.045, SOFI: 0.04, AAPL: 0.015, MSFT: 0.015,
    GOOGL: 0.02, JPM: 0.015, V: 0.012, MA: 0.012,
  };
  return vol[ticker] || 0.025;
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

function getEmptyReport(ticker: string): TechnicalReport {
  return {
    ticker, trend: 'sideways', trendStrength: 0, supportLevels: [], resistanceLevels: [],
    priceActionSignals: [], keyLevels: [], recommendation: 'wait',
    entryZone: null, stopLoss: null, targets: [], riskRewardRatio: null,
    candlePattern: null, summary: `Insufficient data for ${ticker} technical analysis.`,
  };
}
