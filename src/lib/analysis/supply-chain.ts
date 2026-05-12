import { ChainReaction } from '../types/extended';

// Maps a ticker to its supply chain relationships
const SUPPLY_CHAIN_MAP: Record<string, {
  upstream: { ticker: string; reason: string }[];   // suppliers
  downstream: { ticker: string; reason: string }[]; // customers/beneficiaries
  competitors: { ticker: string; reason: string }[];
  sectorPeers: string[];
}> = {
  NVDA: {
    upstream: [
      { ticker: 'TSM', reason: 'Primary foundry manufacturer for NVIDIA chips' },
      { ticker: 'ASML', reason: 'Supplies EUV lithography machines to TSMC for NVIDIA chip production' },
      { ticker: 'KLAC', reason: 'Semiconductor inspection/metrology equipment provider' },
    ],
    downstream: [
      { ticker: 'MSFT', reason: 'Azure uses NVIDIA GPUs for AI cloud services' },
      { ticker: 'GOOGL', reason: 'GCP relies on NVIDIA for AI/ML workloads' },
      { ticker: 'AMZN', reason: 'AWS uses NVIDIA GPUs for cloud AI services' },
      { ticker: 'META', reason: 'Uses NVIDIA GPUs for AI training (Llama models)' },
      { ticker: 'SMCI', reason: 'Builds AI servers powered by NVIDIA GPUs' },
      { ticker: 'DELL', reason: 'Assembles AI-optimized servers with NVIDIA chips' },
    ],
    competitors: [
      { ticker: 'AMD', reason: 'Competing MI300X GPU in data center AI market' },
      { ticker: 'INTC', reason: 'Gaudi AI accelerator competing in inference market' },
    ],
    sectorPeers: ['AMD', 'INTC', 'QCOM', 'AVGO'],
  },
  AAPL: {
    upstream: [
      { ticker: 'TSM', reason: 'Manufactures Apple Silicon (M-series, A-series chips)' },
      { ticker: 'QCOM', reason: 'Supplies 5G modem chips for iPhone' },
      { ticker: 'AVGO', reason: 'Wi-Fi and Bluetooth chips for Apple devices' },
    ],
    downstream: [
      { ticker: 'AAPL', reason: 'Services ecosystem (App Store, iCloud, Apple Music)' },
    ],
    competitors: [
      { ticker: 'SAMSUNG', reason: 'Competing smartphone and device manufacturer' },
      { ticker: 'GOOGL', reason: 'Android ecosystem competes with iOS' },
    ],
    sectorPeers: ['MSFT', 'GOOGL', 'SAMSUNG'],
  },
  MSFT: {
    upstream: [
      { ticker: 'NVDA', reason: 'GPUs for Azure AI infrastructure' },
      { ticker: 'AMD', reason: 'CPUs and GPUs for Azure data centers' },
    ],
    downstream: [
      { ticker: 'CRM', reason: 'Competes in enterprise software, Copilot vs Einstein' },
      { ticker: 'SNOW', reason: 'Azure partnership for cloud data analytics' },
    ],
    competitors: [
      { ticker: 'GOOGL', reason: 'GCP competes with Azure' },
      { ticker: 'AMZN', reason: 'AWS is top competitor to Azure' },
    ],
    sectorPeers: ['GOOGL', 'AMZN', 'ORCL', 'CRM'],
  },
  TSLA: {
    upstream: [
      { ticker: 'PANASONIC', reason: 'Battery cell supplier for Tesla vehicles' },
      { ticker: 'ALB', reason: 'Lithium supplier for EV batteries' },
      { ticker: 'NVDA', reason: 'AI chips for Full Self-Driving computers' },
    ],
    downstream: [
      { ticker: 'CHPT', reason: 'EV charging infrastructure benefits from Tesla adoption' },
      { ticker: 'RIVN', reason: 'EV market expansion benefits from Tesla trailblazing' },
    ],
    competitors: [
      { ticker: 'F', reason: 'Ford EV lineup competing in electric truck/SUV market' },
      { ticker: 'GM', reason: 'GM Ultium platform competing across EV segments' },
      { ticker: 'RIVN', reason: 'Rivian competing in electric truck market' },
      { ticker: 'NIO', reason: 'Chinese EV competitor in premium segment' },
    ],
    sectorPeers: ['RIVN', 'NIO', 'LCID', 'F', 'GM'],
  },
  AMD: {
    upstream: [
      { ticker: 'TSM', reason: 'Foundry for AMD EPYC, Ryzen, and MI300 chips' },
      { ticker: 'ASML', reason: 'EUV lithography enabling AMD advanced node chips' },
    ],
    downstream: [
      { ticker: 'MSFT', reason: 'Azure uses AMD EPYC CPUs and MI300 GPUs' },
      { ticker: 'GOOGL', reason: 'GCP deploys AMD EPYC in data centers' },
      { ticker: 'DELL', reason: 'Dell servers with AMD processors' },
      { ticker: 'HPE', reason: 'HPE servers with AMD EPYC platform' },
    ],
    competitors: [
      { ticker: 'NVDA', reason: 'Dominant competitor in data center GPU market' },
      { ticker: 'INTC', reason: 'Traditional CPU competitor, Xeon vs EPYC' },
    ],
    sectorPeers: ['NVDA', 'INTC', 'QCOM', 'AVGO'],
  },
  META: {
    upstream: [
      { ticker: 'NVDA', reason: 'GPUs powering Meta AI training infrastructure' },
      { ticker: 'AMD', reason: 'Custom chips for Meta data centers' },
    ],
    downstream: [],
    competitors: [
      { ticker: 'GOOGL', reason: 'YouTube competes with Instagram/Facebook for ad spend' },
      { ticker: 'SNAP', reason: 'Snapchat competes for younger demographic' },
      { ticker: 'PINS', reason: 'Pinterest competes for visual discovery ads' },
    ],
    sectorPeers: ['GOOGL', 'SNAP', 'PINS', 'TWTR'],
  },
  GOOGL: {
    upstream: [
      { ticker: 'NVDA', reason: 'GPUs for Google Cloud and AI training' },
    ],
    downstream: [
      { ticker: 'SHOP', reason: 'Merchants depend on Google Ads for traffic' },
    ],
    competitors: [
      { ticker: 'MSFT', reason: 'Azure vs GCP, Bing+Copilot vs Search' },
      { ticker: 'META', reason: 'Competing for digital advertising market share' },
      { ticker: 'AMZN', reason: 'AWS vs GCP, Amazon Ads growing' },
    ],
    sectorPeers: ['META', 'MSFT', 'AMZN'],
  },
  PLTR: {
    upstream: [
      { ticker: 'AMZN', reason: 'Palantir runs on AWS infrastructure' },
    ],
    downstream: [],
    competitors: [
      { ticker: 'SNOW', reason: 'Snowflake competes in data analytics' },
      { ticker: 'AI', reason: 'C3.ai competes in enterprise AI' },
    ],
    sectorPeers: ['SNOW', 'AI', 'DDOG', 'MDB'],
  },
  AMZN: {
    upstream: [
      { ticker: 'NVDA', reason: 'GPUs for AWS AI services' },
      { ticker: 'AMD', reason: 'Custom Graviton and EPYC in AWS' },
    ],
    downstream: [
      { ticker: 'SHOP', reason: 'Shopify merchants use AWS' },
      { ticker: 'PLTR', reason: 'Palantir hosted on AWS' },
    ],
    competitors: [
      { ticker: 'MSFT', reason: 'Azure competes head-to-head with AWS' },
      { ticker: 'GOOGL', reason: 'GCP competing for cloud market share' },
      { ticker: 'WMT', reason: 'Walmart e-commerce competing with Amazon retail' },
    ],
    sectorPeers: ['MSFT', 'GOOGL', 'WMT'],
  },
  JPM: {
    upstream: [],
    downstream: [],
    competitors: [
      { ticker: 'BAC', reason: 'Bank of America - top banking competitor' },
      { ticker: 'GS', reason: 'Goldman Sachs - investment banking competitor' },
      { ticker: 'MS', reason: 'Morgan Stanley - wealth management competitor' },
    ],
    sectorPeers: ['BAC', 'GS', 'MS', 'WFC', 'C'],
  },
};

// Sector to related sectors mapping
const SECTOR_RIPPLE: Record<string, { sector: string; relationship: string; impact: 'positive' | 'negative' }[]> = {
  'Semiconductors': [
    { sector: 'Cloud Computing', relationship: 'Chip demand drives cloud expansion', impact: 'positive' },
    { sector: 'AI/ML', relationship: 'GPU advancement enables AI breakthroughs', impact: 'positive' },
    { sector: 'Data Storage', relationship: 'More compute = more storage demand', impact: 'positive' },
    { sector: 'Networking', relationship: 'Data center growth needs networking gear', impact: 'positive' },
    { sector: 'Server Manufacturing', relationship: 'New chips drive server refresh cycles', impact: 'positive' },
  ],
  'AI/ML': [
    { sector: 'Semiconductors', relationship: 'AI demand drives chip sales', impact: 'positive' },
    { sector: 'Cloud Computing', relationship: 'AI workloads drive cloud spending', impact: 'positive' },
    { sector: 'Enterprise Software', relationship: 'AI features increase software value', impact: 'positive' },
    { sector: 'Cybersecurity', relationship: 'AI used for advanced threat detection', impact: 'positive' },
  ],
  'Cloud Computing': [
    { sector: 'Semiconductors', relationship: 'Cloud expansion needs more chips', impact: 'positive' },
    { sector: 'Networking', relationship: 'Cloud growth drives network infrastructure', impact: 'positive' },
    { sector: 'Enterprise Software', relationship: 'SaaS migration accelerated by cloud', impact: 'positive' },
  ],
  'Electric Vehicles': [
    { sector: 'Battery Technology', relationship: 'EV sales directly drive battery demand', impact: 'positive' },
    { sector: 'Charging Infrastructure', relationship: 'More EVs = more charging stations needed', impact: 'positive' },
    { sector: 'Lithium Mining', relationship: 'Battery production needs raw materials', impact: 'positive' },
    { sector: 'Traditional Auto', relationship: 'EV growth pressures legacy automakers', impact: 'negative' },
    { sector: 'Oil & Gas', relationship: 'EV adoption reduces fossil fuel demand', impact: 'negative' },
  ],
};

export function analyzeSupplyChain(ticker: string, sentiment: 'bullish' | 'bearish', catalystDescription: string): ChainReaction[] {
  const chain = SUPPLY_CHAIN_MAP[ticker];
  if (!chain) return [];

  const reactions: ChainReaction[] = [];

  // Upstream impact
  if (chain.upstream.length > 0) {
    const impactedTickers = chain.upstream.map(u => ({
      ticker: u.ticker,
      impact: (sentiment === 'bullish' ? 'positive' : 'negative') as 'positive' | 'negative',
      reason: u.reason,
    }));

    reactions.push({
      trigger: catalystDescription,
      triggerTicker: ticker,
      impactedSectors: ['Supply Chain - Upstream'],
      impactedTickers,
      confidence: 75,
      narrative: sentiment === 'bullish'
        ? `Strong demand for ${ticker} products boosts upstream suppliers revenue outlook.`
        : `Weakness in ${ticker} may reduce orders to upstream suppliers.`,
    });
  }

  // Downstream impact
  if (chain.downstream.length > 0) {
    const impactedTickers = chain.downstream.map(d => ({
      ticker: d.ticker,
      impact: (sentiment === 'bullish' ? 'positive' : 'negative') as 'positive' | 'negative',
      reason: d.reason,
    }));

    reactions.push({
      trigger: catalystDescription,
      triggerTicker: ticker,
      impactedSectors: ['Ecosystem - Downstream'],
      impactedTickers,
      confidence: 65,
      narrative: sentiment === 'bullish'
        ? `${ticker} strength signals healthy ecosystem for downstream partners and customers.`
        : `${ticker} headwinds may create challenges for dependent downstream businesses.`,
    });
  }

  // Competitor inverse impact
  if (chain.competitors.length > 0) {
    const impactedTickers = chain.competitors.map(c => ({
      ticker: c.ticker,
      impact: (sentiment === 'bullish' ? 'negative' : 'positive') as 'positive' | 'negative',
      reason: c.reason,
    }));

    reactions.push({
      trigger: catalystDescription,
      triggerTicker: ticker,
      impactedSectors: ['Competitive Landscape'],
      impactedTickers,
      confidence: 55,
      narrative: sentiment === 'bullish'
        ? `${ticker} gaining momentum may pressure competitors' market share.`
        : `${ticker} weakness could create opportunities for competitors to gain share.`,
    });
  }

  return reactions;
}

export function getSupplyChainMap(ticker: string) {
  return SUPPLY_CHAIN_MAP[ticker] || null;
}

export function getSectorRipple(sector: string) {
  return SECTOR_RIPPLE[sector] || [];
}
