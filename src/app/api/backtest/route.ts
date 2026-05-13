import { NextRequest, NextResponse } from 'next/server';
import { chatJSON, getLanguageInstruction } from '@/lib/services/ai';
import { withCache, cacheKey } from '@/lib/cache';
import { yf, yfRetry } from '@/lib/services/yahoo';

export const dynamic = 'force-dynamic';

// ============ Strategy Simulators ============
interface Trade { date: string; action: 'BUY' | 'SELL'; price: number; reasoning: string; }
interface PricePoint { date: string; close: number; }

function simulateMA(prices: PricePoint[], shortPeriod = 10, longPeriod = 30): Trade[] {
  if (prices.length < longPeriod + 5) return [];
  const trades: Trade[] = [];
  let inPosition = false;

  for (let i = longPeriod; i < prices.length; i++) {
    const shortMA = prices.slice(i - shortPeriod, i).reduce((s, p) => s + p.close, 0) / shortPeriod;
    const longMA = prices.slice(i - longPeriod, i).reduce((s, p) => s + p.close, 0) / longPeriod;
    const prevShortMA = prices.slice(i - shortPeriod - 1, i - 1).reduce((s, p) => s + p.close, 0) / shortPeriod;
    const prevLongMA = prices.slice(i - longPeriod - 1, i - 1).reduce((s, p) => s + p.close, 0) / longPeriod;

    if (!inPosition && prevShortMA <= prevLongMA && shortMA > longMA) {
      trades.push({ date: prices[i].date, action: 'BUY', price: prices[i].close, reasoning: `${shortPeriod}MA crossed above ${longPeriod}MA` });
      inPosition = true;
    } else if (inPosition && prevShortMA >= prevLongMA && shortMA < longMA) {
      trades.push({ date: prices[i].date, action: 'SELL', price: prices[i].close, reasoning: `${shortPeriod}MA crossed below ${longPeriod}MA` });
      inPosition = false;
    }
  }
  // Close open position at end
  if (inPosition && prices.length > 0) {
    const last = prices[prices.length - 1];
    trades.push({ date: last.date, action: 'SELL', price: last.close, reasoning: 'End of period — close position' });
  }
  return trades;
}

function simulateRSI(prices: PricePoint[], period = 14, oversold = 30, overbought = 70): Trade[] {
  if (prices.length < period + 5) return [];
  const trades: Trade[] = [];
  let inPosition = false;

  for (let i = period + 1; i < prices.length; i++) {
    let gains = 0, losses = 0;
    for (let j = i - period; j < i; j++) {
      const change = prices[j].close - prices[j - 1].close;
      if (change > 0) gains += change; else losses -= change;
    }
    const rs = losses === 0 ? 100 : gains / losses;
    const rsi = 100 - (100 / (1 + rs));

    if (!inPosition && rsi < oversold) {
      trades.push({ date: prices[i].date, action: 'BUY', price: prices[i].close, reasoning: `RSI=${rsi.toFixed(0)} (oversold)` });
      inPosition = true;
    } else if (inPosition && rsi > overbought) {
      trades.push({ date: prices[i].date, action: 'SELL', price: prices[i].close, reasoning: `RSI=${rsi.toFixed(0)} (overbought)` });
      inPosition = false;
    }
  }
  if (inPosition && prices.length > 0) {
    const last = prices[prices.length - 1];
    trades.push({ date: last.date, action: 'SELL', price: last.close, reasoning: 'End of period — close position' });
  }
  return trades;
}

function simulateBollinger(prices: PricePoint[], period = 20, stdDev = 2): Trade[] {
  if (prices.length < period + 5) return [];
  const trades: Trade[] = [];
  let inPosition = false;

  for (let i = period; i < prices.length; i++) {
    const slice = prices.slice(i - period, i);
    const mean = slice.reduce((s, p) => s + p.close, 0) / period;
    const std = Math.sqrt(slice.reduce((s, p) => s + Math.pow(p.close - mean, 2), 0) / period);
    const lower = mean - stdDev * std;
    const upper = mean + stdDev * std;

    if (!inPosition && prices[i].close <= lower) {
      trades.push({ date: prices[i].date, action: 'BUY', price: prices[i].close, reasoning: `Price hit lower band ($${lower.toFixed(0)})` });
      inPosition = true;
    } else if (inPosition && prices[i].close >= upper) {
      trades.push({ date: prices[i].date, action: 'SELL', price: prices[i].close, reasoning: `Price hit upper band ($${upper.toFixed(0)})` });
      inPosition = false;
    }
  }
  if (inPosition && prices.length > 0) {
    const last = prices[prices.length - 1];
    trades.push({ date: last.date, action: 'SELL', price: last.close, reasoning: 'End of period — close position' });
  }
  return trades;
}

function simulateMeanReversion(prices: PricePoint[], period = 20, threshold = 0.03): Trade[] {
  if (prices.length < period + 5) return [];
  const trades: Trade[] = [];
  let inPosition = false;

  for (let i = period; i < prices.length; i++) {
    const mean = prices.slice(i - period, i).reduce((s, p) => s + p.close, 0) / period;
    const deviation = (prices[i].close - mean) / mean;

    if (!inPosition && deviation < -threshold) {
      trades.push({ date: prices[i].date, action: 'BUY', price: prices[i].close, reasoning: `${(deviation * 100).toFixed(1)}% below mean` });
      inPosition = true;
    } else if (inPosition && deviation > threshold * 0.5) {
      trades.push({ date: prices[i].date, action: 'SELL', price: prices[i].close, reasoning: `Reverted to mean (+${(deviation * 100).toFixed(1)}%)` });
      inPosition = false;
    }
  }
  if (inPosition && prices.length > 0) {
    const last = prices[prices.length - 1];
    trades.push({ date: last.date, action: 'SELL', price: last.close, reasoning: 'End of period — close position' });
  }
  return trades;
}

function simulateBreakout(prices: PricePoint[], period = 20): Trade[] {
  if (prices.length < period + 5) return [];
  const trades: Trade[] = [];
  let inPosition = false;

  for (let i = period; i < prices.length; i++) {
    const highN = Math.max(...prices.slice(i - period, i).map(p => p.close));
    const lowN = Math.min(...prices.slice(i - period, i).map(p => p.close));

    if (!inPosition && prices[i].close > highN) {
      trades.push({ date: prices[i].date, action: 'BUY', price: prices[i].close, reasoning: `Breakout above ${period}-day high ($${highN.toFixed(0)})` });
      inPosition = true;
    } else if (inPosition && prices[i].close < lowN) {
      trades.push({ date: prices[i].date, action: 'SELL', price: prices[i].close, reasoning: `Broke below ${period}-day low ($${lowN.toFixed(0)})` });
      inPosition = false;
    }
  }
  if (inPosition && prices.length > 0) {
    const last = prices[prices.length - 1];
    trades.push({ date: last.date, action: 'SELL', price: last.close, reasoning: 'End of period — close position' });
  }
  return trades;
}

function computeMetrics(trades: Trade[]) {
  let wins = 0, losses = 0, totalWin = 0, totalLoss = 0;
  let maxDrawdown = 0, peak = 0, equity = 0;
  const returns: number[] = [];

  for (let i = 0; i < trades.length - 1; i += 2) {
    if (i + 1 >= trades.length) break;
    const buy = trades[i];
    const sell = trades[i + 1];
    const pnl = ((sell.price - buy.price) / buy.price) * 100;
    equity += pnl;
    returns.push(pnl);
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > maxDrawdown) maxDrawdown = dd;
    if (pnl > 0) { wins++; totalWin += pnl; }
    else { losses++; totalLoss += Math.abs(pnl); }
  }

  const totalTrades = Math.floor(trades.length / 2);
  const avgWin = wins > 0 ? totalWin / wins : 0;
  const avgLoss = losses > 0 ? totalLoss / losses : 0;
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdReturn = returns.length > 1 ? Math.sqrt(returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)) : 0;

  return {
    totalReturn: parseFloat(equity.toFixed(2)),
    winRate: totalTrades > 0 ? parseFloat(((wins / totalTrades) * 100).toFixed(1)) : 0,
    totalTrades,
    winningTrades: wins,
    losingTrades: losses,
    avgWin: parseFloat(avgWin.toFixed(2)),
    avgLoss: parseFloat((-avgLoss).toFixed(2)),
    maxDrawdown: parseFloat((-maxDrawdown).toFixed(2)),
    sharpeRatio: stdReturn > 0 ? parseFloat((avgReturn / stdReturn).toFixed(2)) : 0,
    profitFactor: totalLoss > 0 ? parseFloat((totalWin / totalLoss).toFixed(2)) : wins > 0 ? 999 : 0,
  };
}

function selectSimulator(strategy: string): (prices: PricePoint[]) => Trade[] {
  const s = strategy.toLowerCase();
  if (s.includes('rsi')) return simulateRSI;
  if (s.includes('bollinger')) return simulateBollinger;
  if (s.includes('mean') || s.includes('reversion')) return simulateMeanReversion;
  if (s.includes('breakout') || s.includes('momentum')) return simulateBreakout;
  return simulateMA; // default
}

export async function POST(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') || 'en';

  try {
    const body = await request.json();
    const { ticker, strategy, period } = body;

    if (!ticker || !strategy) {
      return NextResponse.json({ success: false, error: 'Missing ticker or strategy' }, { status: 400 });
    }

    // Fetch historical data using yahoo-finance2 package
    const periodMap: Record<string, string> = { '3mo': '3mo', '6mo': '6mo', '1y': '1y', '2y': '2y' };
    const range = periodMap[period] || '6mo';

    let historicalPrices: PricePoint[] = [];
    try {
      // Calculate period1 date from range
      const now = new Date();
      const months: Record<string, number> = { '3mo': 3, '6mo': 6, '1y': 12, '2y': 24 };
      const monthsBack = months[range] || 6;
      const startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - monthsBack);

      const chartData = await yfRetry(() => yf.chart(ticker, {
        period1: startDate.toISOString().split('T')[0],
        interval: '1d' as any,
      }));

      if (chartData?.quotes) {
        historicalPrices = chartData.quotes
          .filter((q: any) => q.close != null && q.date)
          .map((q: any) => ({
            date: q.date instanceof Date ? q.date.toISOString().split('T')[0] : new Date(q.date).toISOString().split('T')[0],
            close: parseFloat(q.close.toFixed(2)),
          }));
      }
    } catch (e) {
      console.error('[Backtest] yahoo-finance2 chart fetch failed:', e);
    }

    if (historicalPrices.length < 35) {
      return NextResponse.json({ success: false, error: 'Insufficient historical data' }, { status: 400 });
    }

    // Run simulation locally — instant
    const simulate = selectSimulator(strategy);
    const trades = simulate(historicalPrices);
    const metrics = computeMetrics(trades);

    // Optional: AI summary (short, non-blocking with 30s timeout)
    let summary = '';
    try {
      const aiSummary = await withCache(
        cacheKey('backtest:summary', ticker, strategy, period, locale),
        () => chatJSON<{ summary: string }>(
          `You are a quant analyst. Given backtest results, write a 1-2 sentence assessment.${getLanguageInstruction(locale)} Return JSON: {"summary":"..."}`,
          `${ticker} ${strategy} over ${period}: ${metrics.totalTrades} trades, ${metrics.totalReturn}% return, ${metrics.winRate}% win rate, Sharpe ${metrics.sharpeRatio}, max drawdown ${metrics.maxDrawdown}%`,
          200,
          30000,
        ),
        30 * 60 * 1000,
      );
      summary = aiSummary?.summary || '';
    } catch {
      // AI summary is optional
    }

    return NextResponse.json({
      success: true,
      data: {
        strategyName: strategy,
        ticker,
        period,
        trades: trades.slice(0, 20), // Cap at 20 trades for response size
        metrics,
        summary: summary || (metrics.totalReturn > 0
          ? `${strategy} generated ${metrics.totalReturn}% return with ${metrics.winRate}% win rate over ${period}.`
          : `${strategy} returned ${metrics.totalReturn}% over ${period} with ${metrics.maxDrawdown}% max drawdown.`),
        historicalPrices: historicalPrices.filter((_, i) => i % Math.max(1, Math.floor(historicalPrices.length / 5)) === 0),
      },
    });
  } catch (error) {
    console.error('[Backtest API] Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to run backtest' }, { status: 500 });
  }
}
