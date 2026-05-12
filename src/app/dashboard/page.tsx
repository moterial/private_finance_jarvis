'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnalysisReport, MarketOverview as MarketOverviewType, RedditPost, Tweet, NewsArticle, StockSignal } from '@/lib/types';
import { AgentState, AgentFinding, ExpertSummary, ChainReaction } from '@/lib/types/extended';
import { useI18n } from '@/lib/i18n/context';
import Header from '@/components/layout/Header';
import MarketOverviewComponent from '@/components/dashboard/MarketOverview';
import StockCard from '@/components/dashboard/StockCard';
import NewsFeed from '@/components/dashboard/NewsFeed';
import TrendingTopics from '@/components/dashboard/TrendingTopics';
import AnalysisPanel from '@/components/dashboard/AnalysisPanel';
import SocialFeed from '@/components/dashboard/SocialFeed';
import SentimentChart from '@/components/dashboard/SentimentChart';
import StockDetail from '@/components/dashboard/StockDetail';
import PortfolioView from '@/components/portfolio/PortfolioView';
import AgentPanel from '@/components/agents/AgentPanel';
import { FullPageLoader } from '@/components/ui/Loading';
import { cn } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, Newspaper, Users, LayoutDashboard,
  Briefcase, Cpu,
} from 'lucide-react';

interface DashboardData {
  analysis: AnalysisReport;
  marketOverview: MarketOverviewType;
  rawData: {
    reddit: RedditPost[];
    tweets: Tweet[];
    news: NewsArticle[];
  };
  agents: {
    states: AgentState[];
    expertSummary: ExpertSummary;
    findings: AgentFinding[];
    chainReactions: ChainReaction[];
  };
}

type TabId = 'overview' | 'bullish' | 'bearish' | 'news' | 'social' | 'portfolio' | 'agents';

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedStock, setSelectedStock] = useState<StockSignal | null>(null);

  const TABS: { id: TabId; labelKey: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', labelKey: 'tab.overview', icon: LayoutDashboard },
    { id: 'bullish', labelKey: 'tab.bullish', icon: TrendingUp },
    { id: 'bearish', labelKey: 'tab.bearish', icon: TrendingDown },
    { id: 'news', labelKey: 'tab.news', icon: Newspaper },
    { id: 'social', labelKey: 'tab.social', icon: Users },
    { id: 'portfolio', labelKey: 'tab.portfolio', icon: Briefcase },
    { id: 'agents', labelKey: 'tab.agents', icon: Cpu },
  ];

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/analyze?locale=${locale}`);
      const json = await response.json();
      if (json.success) {
        setData(json.data);
        setLastRefresh(new Date().toISOString());
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (isLoading && !data) return <FullPageLoader />;

  if (!data) {
    return (
      <div className="min-h-screen bg-jarvis-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-jarvis-gray-400">{t('common.loading')}</p>
          <button onClick={fetchData} className="mt-4 px-4 py-2 rounded-lg bg-jarvis-accent/10 text-jarvis-accent border border-jarvis-accent/20 hover:bg-jarvis-accent/20 transition-all font-mono text-sm">
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  const { analysis, marketOverview, rawData, agents } = data;

  return (
    <div className="min-h-screen bg-jarvis-black data-grid">
      <div className="fixed inset-0 bg-glow-radial pointer-events-none opacity-50" />

      <Header lastRefresh={lastRefresh} isLoading={isLoading} onRefresh={fetchData} />

      <main className="relative max-w-[1920px] mx-auto px-4 sm:px-6 py-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider transition-all whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-jarvis-gray-800/80 text-jarvis-white border border-jarvis-gray-700/50'
                  : 'text-jarvis-gray-500 hover:text-jarvis-gray-300 hover:bg-jarvis-gray-900/50 border border-transparent'
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {t(tab.labelKey as any)}
              {tab.id === 'bullish' && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-jarvis-green/10 text-jarvis-green border border-jarvis-green/20">
                  {analysis.topBullish.length}
                </span>
              )}
              {tab.id === 'bearish' && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-jarvis-red/10 text-jarvis-red border border-jarvis-red/20">
                  {analysis.topBearish.length}
                </span>
              )}
              {tab.id === 'agents' && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-jarvis-accent/10 text-jarvis-accent border border-jarvis-accent/20">
                  {agents.findings.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            <MarketOverviewComponent data={marketOverview} />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 space-y-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="w-4 h-4 text-jarvis-green" />
                    <h2 className="section-title text-jarvis-green">{t('signal.topBullish')}</h2>
                  </div>
                  <div className="space-y-3">
                    {analysis.topBullish.slice(0, 4).map((signal, i) => (
                      <StockCard key={signal.ticker} signal={signal} rank={i + 1} onClick={() => setSelectedStock(signal)} />
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="w-4 h-4 text-jarvis-red" />
                    <h2 className="section-title text-jarvis-red">{t('signal.topBearish')}</h2>
                  </div>
                  <div className="space-y-3">
                    {analysis.topBearish.slice(0, 3).map((signal, i) => (
                      <StockCard key={signal.ticker} signal={signal} rank={i + 1} onClick={() => setSelectedStock(signal)} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="lg:col-span-4 space-y-6">
                <NewsFeed articles={rawData.news.slice(0, 6)} />
                <TrendingTopics topics={analysis.trendingTopics} />
              </div>
              <div className="lg:col-span-3 space-y-6">
                <AnalysisPanel report={analysis} />
                <SentimentChart report={analysis} />
              </div>
            </div>
          </div>
        )}

        {/* Bullish Tab */}
        {activeTab === 'bullish' && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-jarvis-green" />
              <h2 className="text-lg font-semibold text-jarvis-white">{t('signal.topBullish')}</h2>
              <span className="text-xs font-mono text-jarvis-gray-500">{analysis.topBullish.length} {t('signal.stocksUp')}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {analysis.topBullish.map((signal, i) => (
                <StockCard key={signal.ticker} signal={signal} rank={i + 1} onClick={() => setSelectedStock(signal)} />
              ))}
            </div>
          </div>
        )}

        {/* Bearish Tab */}
        {activeTab === 'bearish' && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-5 h-5 text-jarvis-red" />
              <h2 className="text-lg font-semibold text-jarvis-white">{t('signal.topBearish')}</h2>
              <span className="text-xs font-mono text-jarvis-gray-500">{analysis.topBearish.length} {t('signal.stocksDown')}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {analysis.topBearish.map((signal, i) => (
                <StockCard key={signal.ticker} signal={signal} rank={i + 1} onClick={() => setSelectedStock(signal)} />
              ))}
            </div>
          </div>
        )}

        {/* News Tab */}
        {activeTab === 'news' && (
          <div className="animate-fade-in max-w-4xl">
            <NewsFeed articles={rawData.news} />
          </div>
        )}

        {/* Social Tab */}
        {activeTab === 'social' && (
          <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SocialFeed redditPosts={rawData.reddit} tweets={rawData.tweets} />
            <div className="space-y-6">
              <TrendingTopics topics={analysis.trendingTopics} />
              <SentimentChart report={analysis} />
            </div>
          </div>
        )}

        {/* Portfolio Tab */}
        {activeTab === 'portfolio' && <PortfolioView />}

        {/* Agents Tab */}
        {activeTab === 'agents' && (
          <AgentPanel
            agentStates={agents.states}
            expertSummary={agents.expertSummary}
            findings={agents.findings}
            chainReactions={agents.chainReactions}
          />
        )}
      </main>

      {/* Stock Detail Modal */}
      {selectedStock && (
        <StockDetail signal={selectedStock} onClose={() => setSelectedStock(null)} />
      )}
    </div>
  );
}
