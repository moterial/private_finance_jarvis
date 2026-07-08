// ============ Unusual Options Activity Scanner (期權異動掃描) ============
// Scans option chains across tracked tickers and flags contracts where
// today's volume dwarfs open interest — the classic footprint of fresh,
// aggressive positioning ("new money"). Data is Yahoo's delayed feed, so
// this detects daily unusual activity, not tick-level sweeps, and the
// buy/sell side is inferred (call volume ≈ bullish, put volume ≈ bearish).

import { fetchOptionsChain, OptionContract } from './options';

export interface UnusualOption {
  ticker: string;
  currentPrice: number;
  contractSymbol: string;
  type: 'call' | 'put';
  strike: number;
  expiration: string;
  lastPrice: number;
  volume: number;
  openInterest: number;
  /** volume ÷ open interest — >2 means most of today's volume is NEW positioning */
  volOiRatio: number;
  /** volume × lastPrice × 100 — dollar premium traded today */
  premiumVolume: number;
  impliedVolatility: number;
  /** % distance of strike from spot; positive = OTM */
  pctOtm: number;
  sentiment: 'bullish' | 'bearish';
  score: number;
}

export interface TickerFlowSummary {
  ticker: string;
  currentPrice: number;
  putCallVolumeRatio: number;
  totalCallPremium: number;
  totalPutPremium: number;
  netSentiment: 'bullish' | 'bearish' | 'neutral';
  unusualCount: number;
}

export interface OptionsFlowResult {
  unusual: UnusualOption[];
  summaries: TickerFlowSummary[];
  scannedTickers: string[];
  failedTickers: string[];
  generatedAt: string;
}

// Thresholds for flagging a contract as unusual
const MIN_VOLUME = 200;          // ignore illiquid noise
const MIN_VOL_OI_RATIO = 2;      // volume must be 2x open interest
const MIN_PREMIUM = 200_000;     // $200k+ traded premium

function evaluateContract(c: OptionContract, ticker: string, spot: number): UnusualOption | null {
  if (!c.volume || c.volume < MIN_VOLUME || !c.lastPrice) return null;

  const volOiRatio = c.volume / Math.max(c.openInterest, 1);
  const premiumVolume = c.volume * c.lastPrice * 100;
  if (volOiRatio < MIN_VOL_OI_RATIO || premiumVolume < MIN_PREMIUM) return null;

  const pctOtm = c.type === 'call'
    ? ((c.strike - spot) / spot) * 100
    : ((spot - c.strike) / spot) * 100;

  return {
    ticker,
    currentPrice: spot,
    contractSymbol: c.contractSymbol,
    type: c.type,
    strike: c.strike,
    expiration: c.expiration,
    lastPrice: c.lastPrice,
    volume: c.volume,
    openInterest: c.openInterest,
    volOiRatio: Number(volOiRatio.toFixed(1)),
    premiumVolume: Math.round(premiumVolume),
    impliedVolatility: Number((c.impliedVolatility * 100).toFixed(1)),
    pctOtm: Number(pctOtm.toFixed(1)),
    sentiment: c.type === 'call' ? 'bullish' : 'bearish',
    // Premium-weighted score; cap the vol/OI multiplier so one 0-OI contract
    // doesn't drown out a $5M institutional print
    score: Math.round(premiumVolume * Math.min(volOiRatio, 8)),
  };
}

async function scanTicker(ticker: string): Promise<{ unusual: UnusualOption[]; summary: TickerFlowSummary } | null> {
  // Nearest expiration only — that's where the bulk of daily flow concentrates
  const chain = await fetchOptionsChain(ticker);
  if (!chain || !chain.currentPrice) return null;

  const all = [...chain.calls, ...chain.puts];
  const unusual = all
    .map(c => evaluateContract(c, ticker, chain.currentPrice))
    .filter((u): u is UnusualOption => u !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5); // top 5 per ticker

  const callVol = chain.calls.reduce((s, c) => s + (c.volume || 0), 0);
  const putVol = chain.puts.reduce((s, p) => s + (p.volume || 0), 0);
  const totalCallPremium = Math.round(chain.calls.reduce((s, c) => s + (c.volume || 0) * (c.lastPrice || 0) * 100, 0));
  const totalPutPremium = Math.round(chain.puts.reduce((s, p) => s + (p.volume || 0) * (p.lastPrice || 0) * 100, 0));
  const pcRatio = callVol > 0 ? putVol / callVol : 0;

  let netSentiment: TickerFlowSummary['netSentiment'] = 'neutral';
  if (pcRatio < 0.6 && totalCallPremium > totalPutPremium * 1.5) netSentiment = 'bullish';
  else if (pcRatio > 1.3 && totalPutPremium > totalCallPremium * 1.2) netSentiment = 'bearish';

  return {
    unusual,
    summary: {
      ticker,
      currentPrice: chain.currentPrice,
      putCallVolumeRatio: Number(pcRatio.toFixed(2)),
      totalCallPremium,
      totalPutPremium,
      netSentiment,
      unusualCount: unusual.length,
    },
  };
}

export async function scanUnusualOptions(tickers: string[]): Promise<OptionsFlowResult> {
  const unusual: UnusualOption[] = [];
  const summaries: TickerFlowSummary[] = [];
  const failedTickers: string[] = [];

  // Limited concurrency — Yahoo rate-limits aggressive parallel fetching
  const BATCH = 4;
  for (let i = 0; i < tickers.length; i += BATCH) {
    const batch = tickers.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(t => scanTicker(t)));
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled' && r.value) {
        unusual.push(...r.value.unusual);
        summaries.push(r.value.summary);
      } else {
        failedTickers.push(batch[idx]);
      }
    });
  }

  unusual.sort((a, b) => b.score - a.score);
  summaries.sort((a, b) => (b.totalCallPremium + b.totalPutPremium) - (a.totalCallPremium + a.totalPutPremium));

  return {
    unusual: unusual.slice(0, 25),
    summaries,
    scannedTickers: tickers,
    failedTickers,
    generatedAt: new Date().toISOString(),
  };
}
