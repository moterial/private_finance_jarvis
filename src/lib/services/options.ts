// ============ Options Chain Data Service ============

export interface OptionContract {
  contractSymbol: string;
  strike: number;
  lastPrice: number;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  expiration: string;
  type: 'call' | 'put';
  inTheMoney: boolean;
  // Greeks (calculated)
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
}

export interface OptionsChain {
  ticker: string;
  currentPrice: number;
  expirationDates: string[];
  calls: OptionContract[];
  puts: OptionContract[];
  fetchedAt: string;
}

export interface OptionsStrategy {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral' | 'volatile';
  legs: StrategyLeg[];
  maxProfit: number | 'unlimited';
  maxLoss: number | 'unlimited';
  breakeven: number[];
  netDebit: number; // negative = credit
  riskRewardRatio: string;
  profitProbability?: number;
}

export interface StrategyLeg {
  action: 'buy' | 'sell';
  type: 'call' | 'put';
  strike: number;
  premium: number;
  quantity: number;
  expiration: string;
}

// ============ Fetch Options Chain from Yahoo Finance ============
export async function fetchOptionsChain(ticker: string, expirationDate?: string): Promise<OptionsChain | null> {
  try {
    const url = expirationDate
      ? `https://query1.finance.yahoo.com/v7/finance/options/${ticker}?date=${expirationDate}`
      : `https://query1.finance.yahoo.com/v7/finance/options/${ticker}`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 300 },
    });

    if (!res.ok) return null;
    const data = await res.json();
    const result = data.optionChain?.result?.[0];
    if (!result) return null;

    const currentPrice = result.quote?.regularMarketPrice ?? 0;
    const expirationDates = (result.expirationDates || []).map((ts: number) =>
      new Date(ts * 1000).toISOString().split('T')[0]
    );

    const mapContract = (c: any, type: 'call' | 'put'): OptionContract => ({
      contractSymbol: c.contractSymbol || '',
      strike: c.strike ?? 0,
      lastPrice: c.lastPrice ?? 0,
      bid: c.bid ?? 0,
      ask: c.ask ?? 0,
      volume: c.volume ?? 0,
      openInterest: c.openInterest ?? 0,
      impliedVolatility: c.impliedVolatility ?? 0,
      expiration: new Date((c.expiration ?? 0) * 1000).toISOString().split('T')[0],
      type,
      inTheMoney: c.inTheMoney ?? false,
    });

    const calls: OptionContract[] = (result.options?.[0]?.calls || []).map((c: any) => mapContract(c, 'call'));
    const puts: OptionContract[] = (result.options?.[0]?.puts || []).map((c: any) => mapContract(c, 'put'));

    // Calculate approximate Greeks
    calls.forEach(c => calculateGreeks(c, currentPrice, 0.05));
    puts.forEach(p => calculateGreeks(p, currentPrice, 0.05));

    return {
      ticker: ticker.toUpperCase(),
      currentPrice,
      expirationDates,
      calls,
      puts,
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.error(`[Options] Failed to fetch chain for ${ticker}:`, e);
    return null;
  }
}

// ============ Black-Scholes Greeks Approximation ============
function calculateGreeks(contract: OptionContract, stockPrice: number, riskFreeRate: number) {
  const T = Math.max(
    (new Date(contract.expiration).getTime() - Date.now()) / (365.25 * 24 * 3600 * 1000),
    0.001
  );
  const S = stockPrice;
  const K = contract.strike;
  const sigma = contract.impliedVolatility || 0.3;
  const r = riskFreeRate;

  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  const Nd1 = normalCDF(d1);
  const nd1 = normalPDF(d1);

  if (contract.type === 'call') {
    contract.delta = parseFloat(Nd1.toFixed(3));
    contract.gamma = parseFloat((nd1 / (S * sigma * Math.sqrt(T))).toFixed(4));
    contract.theta = parseFloat(((-S * nd1 * sigma / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * normalCDF(d2)) / 365).toFixed(3));
    contract.vega = parseFloat((S * nd1 * Math.sqrt(T) / 100).toFixed(3));
  } else {
    contract.delta = parseFloat((Nd1 - 1).toFixed(3));
    contract.gamma = parseFloat((nd1 / (S * sigma * Math.sqrt(T))).toFixed(4));
    contract.theta = parseFloat(((-S * nd1 * sigma / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * normalCDF(-d2)) / 365).toFixed(3));
    contract.vega = parseFloat((S * nd1 * Math.sqrt(T) / 100).toFixed(3));
  }
}

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// ============ Strategy Builders ============
export function buildStrategies(chain: OptionsChain): OptionsStrategy[] {
  const strategies: OptionsStrategy[] = [];
  const price = chain.currentPrice;
  if (!price || chain.calls.length === 0 || chain.puts.length === 0) return strategies;

  // Filter to nearest expiration with good liquidity
  const nearCalls = chain.calls.filter(c => c.volume > 0 || c.openInterest > 10);
  const nearPuts = chain.puts.filter(p => p.volume > 0 || p.openInterest > 10);
  if (nearCalls.length < 3 || nearPuts.length < 3) return strategies;

  // Find ATM options
  const atmCall = nearCalls.reduce((a, b) => Math.abs(a.strike - price) < Math.abs(b.strike - price) ? a : b);
  const atmPut = nearPuts.reduce((a, b) => Math.abs(a.strike - price) < Math.abs(b.strike - price) ? a : b);

  // OTM options
  const otmCalls = nearCalls.filter(c => c.strike > price).sort((a, b) => a.strike - b.strike);
  const otmPuts = nearPuts.filter(p => p.strike < price).sort((a, b) => b.strike - a.strike);

  // 1. Covered Call (if bullish-neutral)
  if (otmCalls.length > 0) {
    const sellCall = otmCalls[Math.min(1, otmCalls.length - 1)]; // ~1 strike OTM
    const premium = sellCall.bid || sellCall.lastPrice;
    const maxProfit = (sellCall.strike - price + premium) * 100;
    const maxLoss = (price - premium) * 100;
    strategies.push({
      name: 'Covered Call',
      type: 'bullish',
      legs: [
        { action: 'buy', type: 'call', strike: price, premium: price, quantity: 100, expiration: sellCall.expiration },
        { action: 'sell', type: 'call', strike: sellCall.strike, premium, quantity: 1, expiration: sellCall.expiration },
      ],
      maxProfit: round(maxProfit),
      maxLoss: round(maxLoss),
      breakeven: [round(price - premium)],
      netDebit: round((price - premium) * 100),
      riskRewardRatio: `1:${(maxProfit / maxLoss).toFixed(1)}`,
    });
  }

  // 2. Bull Call Spread
  if (otmCalls.length >= 2) {
    const buyCall = atmCall;
    const sellCall = otmCalls[Math.min(2, otmCalls.length - 1)];
    const debit = (buyCall.ask || buyCall.lastPrice) - (sellCall.bid || sellCall.lastPrice);
    const maxProfit = (sellCall.strike - buyCall.strike - debit) * 100;
    const maxLoss = debit * 100;
    strategies.push({
      name: 'Bull Call Spread',
      type: 'bullish',
      legs: [
        { action: 'buy', type: 'call', strike: buyCall.strike, premium: buyCall.ask || buyCall.lastPrice, quantity: 1, expiration: buyCall.expiration },
        { action: 'sell', type: 'call', strike: sellCall.strike, premium: sellCall.bid || sellCall.lastPrice, quantity: 1, expiration: sellCall.expiration },
      ],
      maxProfit: round(maxProfit),
      maxLoss: round(maxLoss),
      breakeven: [round(buyCall.strike + debit)],
      netDebit: round(debit * 100),
      riskRewardRatio: maxLoss > 0 ? `1:${(maxProfit / maxLoss).toFixed(1)}` : 'N/A',
    });
  }

  // 3. Bear Put Spread
  if (otmPuts.length >= 2) {
    const buyPut = atmPut;
    const sellPut = otmPuts[Math.min(2, otmPuts.length - 1)];
    const debit = (buyPut.ask || buyPut.lastPrice) - (sellPut.bid || sellPut.lastPrice);
    const maxProfit = (buyPut.strike - sellPut.strike - debit) * 100;
    const maxLoss = debit * 100;
    strategies.push({
      name: 'Bear Put Spread',
      type: 'bearish',
      legs: [
        { action: 'buy', type: 'put', strike: buyPut.strike, premium: buyPut.ask || buyPut.lastPrice, quantity: 1, expiration: buyPut.expiration },
        { action: 'sell', type: 'put', strike: sellPut.strike, premium: sellPut.bid || sellPut.lastPrice, quantity: 1, expiration: sellPut.expiration },
      ],
      maxProfit: round(maxProfit),
      maxLoss: round(maxLoss),
      breakeven: [round(buyPut.strike - debit)],
      netDebit: round(debit * 100),
      riskRewardRatio: maxLoss > 0 ? `1:${(maxProfit / maxLoss).toFixed(1)}` : 'N/A',
    });
  }

  // 4. Iron Condor (neutral)
  if (otmCalls.length >= 2 && otmPuts.length >= 2) {
    const sellPut = otmPuts[0];
    const buyPut = otmPuts[Math.min(2, otmPuts.length - 1)];
    const sellCall = otmCalls[0];
    const buyCall = otmCalls[Math.min(2, otmCalls.length - 1)];
    const credit = (sellPut.bid || sellPut.lastPrice) - (buyPut.ask || buyPut.lastPrice)
                 + (sellCall.bid || sellCall.lastPrice) - (buyCall.ask || buyCall.lastPrice);
    const width = Math.max(sellCall.strike - sellPut.strike, buyCall.strike - buyPut.strike);
    const maxLoss = (width - credit) * 100;
    const maxProfit = credit * 100;
    strategies.push({
      name: 'Iron Condor',
      type: 'neutral',
      legs: [
        { action: 'buy', type: 'put', strike: buyPut.strike, premium: buyPut.ask || buyPut.lastPrice, quantity: 1, expiration: buyPut.expiration },
        { action: 'sell', type: 'put', strike: sellPut.strike, premium: sellPut.bid || sellPut.lastPrice, quantity: 1, expiration: sellPut.expiration },
        { action: 'sell', type: 'call', strike: sellCall.strike, premium: sellCall.bid || sellCall.lastPrice, quantity: 1, expiration: sellCall.expiration },
        { action: 'buy', type: 'call', strike: buyCall.strike, premium: buyCall.ask || buyCall.lastPrice, quantity: 1, expiration: buyCall.expiration },
      ],
      maxProfit: round(maxProfit),
      maxLoss: round(Math.abs(maxLoss)),
      breakeven: [round(sellPut.strike - credit), round(sellCall.strike + credit)],
      netDebit: round(-credit * 100),
      riskRewardRatio: maxLoss > 0 ? `1:${(maxProfit / Math.abs(maxLoss)).toFixed(1)}` : 'N/A',
    });
  }

  // 5. Straddle (volatile)
  {
    const callPremium = atmCall.ask || atmCall.lastPrice;
    const putPremium = atmPut.ask || atmPut.lastPrice;
    const totalDebit = callPremium + putPremium;
    strategies.push({
      name: 'Long Straddle',
      type: 'volatile',
      legs: [
        { action: 'buy', type: 'call', strike: atmCall.strike, premium: callPremium, quantity: 1, expiration: atmCall.expiration },
        { action: 'buy', type: 'put', strike: atmPut.strike, premium: putPremium, quantity: 1, expiration: atmPut.expiration },
      ],
      maxProfit: 'unlimited',
      maxLoss: round(totalDebit * 100),
      breakeven: [round(atmCall.strike - totalDebit), round(atmCall.strike + totalDebit)],
      netDebit: round(totalDebit * 100),
      riskRewardRatio: 'Unlimited upside',
    });
  }

  // 6. Protective Put (hedging)
  if (otmPuts.length > 0) {
    const buyPut = otmPuts[0]; // 1 strike OTM
    const premium = buyPut.ask || buyPut.lastPrice;
    strategies.push({
      name: 'Protective Put',
      type: 'bullish',
      legs: [
        { action: 'buy', type: 'put', strike: buyPut.strike, premium, quantity: 1, expiration: buyPut.expiration },
      ],
      maxProfit: 'unlimited',
      maxLoss: round((price - buyPut.strike + premium) * 100),
      breakeven: [round(price + premium)],
      netDebit: round(premium * 100),
      riskRewardRatio: 'Insurance hedge',
    });
  }

  return strategies.filter(s => s.maxLoss !== 0 && (s.maxLoss === 'unlimited' || s.maxLoss > 0));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// ============ Put/Call Ratio ============
export function calculatePutCallRatio(chain: OptionsChain): { volumeRatio: number; oiRatio: number; signal: string } {
  const callVolume = chain.calls.reduce((sum, c) => sum + c.volume, 0);
  const putVolume = chain.puts.reduce((sum, p) => sum + p.volume, 0);
  const callOI = chain.calls.reduce((sum, c) => sum + c.openInterest, 0);
  const putOI = chain.puts.reduce((sum, p) => sum + p.openInterest, 0);

  const volumeRatio = callVolume > 0 ? putVolume / callVolume : 0;
  const oiRatio = callOI > 0 ? putOI / callOI : 0;

  let signal = 'Neutral';
  if (volumeRatio > 1.5) signal = 'Very Bearish (high put buying)';
  else if (volumeRatio > 1.0) signal = 'Bearish leaning';
  else if (volumeRatio < 0.5) signal = 'Very Bullish (call heavy)';
  else if (volumeRatio < 0.7) signal = 'Bullish leaning';

  return { volumeRatio: round(volumeRatio), oiRatio: round(oiRatio), signal };
}
