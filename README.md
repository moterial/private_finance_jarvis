<div align="center">

# 🤖 JARVIS Finance

**AI-Powered Market Intelligence Platform**

A real-time financial dashboard that aggregates data from Reddit, Twitter/X, news feeds, and market APIs — then uses AI to generate actionable trading insights, anomaly detection, and portfolio analysis.

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![DeepSeek](https://img.shields.io/badge/AI-DeepSeek_R1-purple)](https://deepseek.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](#license)

[Live Demo](https://finance-jarvis.onrender.com) · [Features](#features) · [Getting Started](#getting-started) · [Architecture](#architecture)

</div>

---

## ✨ Features

### 📊 Market Intelligence
- **Real-time Market Overview** — S&P 500, NASDAQ, DOW, VIX with animated counters and Fear & Greed gauge
- **Bullish/Bearish Signal Detection** — AI-ranked stock signals with confidence scores, sparkline charts, and source breakdown
- **Social Sentiment Heatmap** — Treemap visualization of ticker mentions across Reddit, Twitter, and news with sentiment coloring
- **Anomaly Detection** — Automatically flags social surges, sentiment divergences, volume spikes, price gaps, and unusual activity

### 🧠 AI-Powered Analysis
- **AI Bull vs Bear Debate** — Enter any ticker and AI generates the strongest arguments for both sides, then delivers a JARVIS verdict
- **AI Expert Narrative** — Hedge-fund-CIO-style market analysis that finds hidden signals and contrarian edges
- **AI Earnings Predictions** — Beat/miss predictions with confidence percentages for upcoming earnings
- **AI Portfolio Coaching** — Personalized advice based on your portfolio composition and risk exposure

### 💼 Trading Tools
- **Portfolio Manager** — Track positions with real-time P&L, sector allocation, and AI-generated rebalancing suggestions
- **Options Strategy Engine** — Options chain analysis with 6 built-in strategies (Covered Call, Iron Condor, Bull Call Spread, etc.), Greeks, and AI recommendations
- **Backtesting Engine** — Test 5 strategies (Momentum, Mean Reversion, Breakout, Dip Buying, Trend Following) against historical data with trade logs and metrics
- **Portfolio Stress Testing** — AI simulates 5 extreme scenarios (rate shock, recession, geopolitical, sector crash, liquidity crisis) on your actual positions

### 🔧 Utilities
- **Smart Alerts** — Set price, change, and sentiment-based alerts with localStorage persistence
- **Multi-Asset Dashboard** — Crypto (CoinGecko), Forex & Commodities (Yahoo Finance) in one view
- **Trading Journal + AI Coach** — Log trades with emotions, track win rate and P&L, get AI behavioral pattern analysis
- **AI Strategy Generator** — Personalized market strategy with sector rotation analysis and portfolio allocation

### 🎨 UI/UX
- **Collapsible Sidebar Navigation** — Categorized into Market, Trading, Intelligence, Tools
- **Command Palette** — `Ctrl+K` / `⌘K` quick navigation with keyboard arrow support
- **Responsive Design** — Desktop sidebar, mobile bottom nav with full-screen drawer
- **Smooth Animations** — Staggered card entrance, animated confidence bars, sparkline SVG draw-in, number count-up
- **Skeleton Loaders** — Shimmer placeholders while lazy-loaded panels download
- **Dark Mode** — Custom JARVIS theme with glassmorphism panels and neon accents
- **Bilingual** — Full English/繁體中文 support with AI responses in the selected language

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────┐
│                    Frontend                      │
│  Next.js 14 (App Router) + Tailwind + TypeScript │
│  Dynamic imports · Skeleton loaders · Animations │
└──────────────────────┬──────────────────────────┘
                       │
          ┌────────────┴────────────┐
          │     9 API Routes        │
          │  /api/analyze (2-phase) │
          │  /api/debate            │
          │  /api/options           │
          │  /api/earnings          │
          │  /api/backtest          │
          │  /api/stress-test       │
          │  /api/multi-asset       │
          │  /api/journal-coach     │
          │  /api/stock             │
          └────┬───────────┬───────┘
               │           │
     ┌─────────┴──┐   ┌────┴────────┐
     │  Data APIs  │   │  AI Engine   │
     │ (all free)  │   │ DeepSeek R1  │
     ├─────────────┤   │ (OpenAI SDK) │
     │ Reddit JSON │   └─────────────┘
     │ Yahoo Fin.  │
     │ RSS Feeds   │
     │ StockTwits  │
     │ CoinGecko   │
     │ Finnhub     │
     └─────────────┘
```

### Progressive Loading
The dashboard uses a **two-phase loading strategy**:
1. **Phase 1 (Fast)** — Fetches market data, news, social feeds → renders dashboard instantly
2. **Phase 2 (AI)** — AI enrichment runs in background → updates with insights, narratives, strategy

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- An OpenAI-compatible API key (DeepSeek, OpenAI, etc.)

### Installation

```bash
# Clone the repo
git clone https://github.com/moterial/private_finance_jarvis.git
cd private_finance_jarvis

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
```

### Environment Variables

Create a `.env.local` file:

```env
# Required — AI Model (any OpenAI-compatible endpoint)
LLM_API_KEY=your-api-key-here
LLM_BASE_URL=https://api.openai.com/v1     # or any compatible endpoint
LLM_MODEL_NAME=gpt-4o-mini                  # or deepseek-r1-0528, etc.

# Optional — Finnhub (extra market data)
FINNHUB_API_KEY=your-finnhub-key
```

> **Note:** All other data sources (Reddit, Yahoo Finance, RSS, StockTwits, CoinGecko) are free and require no API keys.

### Run Locally

```bash
npm run dev
# Open http://localhost:3000
```

### Build for Production

```bash
npm run build
npm start
```

---

## ☁️ Deploy

### Render.com (included config)

The repo includes a `render.yaml` for one-click deployment:

1. Connect your GitHub repo to [Render](https://render.com)
2. Set environment variables in the Render dashboard
3. Deploy — it auto-builds on every push

### Vercel

```bash
npm i -g vercel
vercel --prod
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5.4 |
| Styling | Tailwind CSS 3.4, custom JARVIS theme |
| AI | OpenAI SDK → DeepSeek R1 / GPT-4o / any compatible |
| Charts | Recharts, custom SVG sparklines |
| Icons | Lucide React |
| Data | Yahoo Finance, Reddit, RSS, StockTwits, CoinGecko, Finnhub |
| Deployment | Render.com / Vercel |

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/                    # 9 API routes
│   │   ├── analyze/            # Main analysis (2-phase progressive)
│   │   ├── debate/             # AI bull vs bear debate
│   │   ├── options/            # Options chain + strategies
│   │   ├── earnings/           # Earnings calendar + AI predictions
│   │   ├── backtest/           # Strategy backtesting
│   │   ├── stress-test/        # Portfolio stress scenarios
│   │   ├── multi-asset/        # Crypto, forex, commodities
│   │   ├── journal-coach/      # AI trading coach
│   │   └── stock/              # Individual stock data
│   ├── dashboard/              # Main dashboard page
│   └── globals.css             # Custom animations & theme
├── components/
│   ├── dashboard/              # MarketOverview, StockCard, NewsFeed, etc.
│   ├── portfolio/              # PortfolioView, StressTestPanel
│   ├── options/                # OptionsPanel (chain, strategies, Greeks)
│   ├── debate/                 # AI Bull vs Bear debate UI
│   ├── earnings/               # Earnings calendar
│   ├── anomaly/                # Anomaly detection cards
│   ├── backtest/               # Strategy backtester
│   ├── alerts/                 # Smart alerts manager
│   ├── multi-asset/            # Multi-asset dashboard
│   ├── heatmap/                # Social sentiment heatmap
│   ├── journal/                # Trading journal + AI coach
│   ├── strategy/               # AI strategy panel
│   ├── agents/                 # Multi-agent analysis
│   ├── layout/                 # Header
│   └── ui/                     # Loading, Skeleton components
└── lib/
    ├── services/               # AI, options, earnings, anomaly services
    ├── i18n/                   # Bilingual translations (EN/ZH)
    ├── types/                  # TypeScript interfaces
    └── utils.ts                # Utility functions
```

---

## 📸 Screenshots

> Add screenshots by placing images in your repo or linking to hosted images:
> 
> ```markdown
> ![Dashboard Overview](./screenshots/overview.png)
> ![AI Debate](./screenshots/debate.png)
> ![Options Strategy](./screenshots/options.png)
> ```

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with ☕ and AI**

*JARVIS doesn't sleep. Neither should your portfolio analysis.*

</div>