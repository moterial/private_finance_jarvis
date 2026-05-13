'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import StrategyPanel from '@/components/strategy/StrategyPanel';
import OptionsPanel from '@/components/options/OptionsPanel';
import EarningsPanel from '@/components/earnings/EarningsPanel';
import AnomalyPanel from '@/components/anomaly/AnomalyPanel';
import DebatePanel from '@/components/debate/DebatePanel';
import AlertsPanel from '@/components/alerts/AlertsPanel';
import BacktestPanel from '@/components/backtest/BacktestPanel';
import MultiAssetPanel from '@/components/multi-asset/MultiAssetPanel';
import SentimentHeatmap from '@/components/heatmap/SentimentHeatmap';
import JournalPanel from '@/components/journal/JournalPanel';
import { FullPageLoader } from '@/components/ui/Loading';
import { cn } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, Newspaper, Users, LayoutDashboard,
  Briefcase, Cpu, Crosshair, BarChart3, Calendar, AlertTriangle, Swords,
  Bell, History, Globe, Flame, BookOpen, ChevronLeft, ChevronRight,
  Search, X, Sparkles,
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
  strategy: any | null;
  anomalies: any[];
}

type TabId = 'overview' | 'bullish' | 'bearish' | 'news' | 'social' | 'portfolio' | 'options' | 'earnings' | 'anomalies' | 'debate' | 'alerts' | 'backtest' | 'multi-asset' | 'heatmap' | 'journal' | 'strategy' | 'agents';

interface NavGroup {
  label: string;
  labelZh: string;
  items: { id: TabId; labelKey: string; icon: typeof LayoutDashboard; badge?: () => string | number }[];
}

export default function DashboardPage() {
  const { t, locale } = useI18n();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedStock, setSelectedStock] = useState<StockSignal | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandSearch, setCommandSearch] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Navigation groups
  const NAV_GROUPS: NavGroup[] = [
    {
      label: 'Market',
      labelZh: '市場',
      items: [
        { id: 'overview', labelKey: 'tab.overview', icon: LayoutDashboard },
        { id: 'bullish', labelKey: 'tab.bullish', icon: TrendingUp, badge: () => data?.analysis.topBullish.length || 0 },
        { id: 'bearish', labelKey: 'tab.bearish', icon: TrendingDown, badge: () => data?.analysis.topBearish.length || 0 },
        { id: 'news', labelKey: 'tab.news', icon: Newspaper },
        { id: 'social', labelKey: 'tab.social', icon: Users },
      ],
    },
    {
      label: 'Trading',
      labelZh: '交易',
      items: [
        { id: 'portfolio', labelKey: 'tab.portfolio', icon: Briefcase },
        { id: 'options', labelKey: 'tab.options', icon: BarChart3 },
        { id: 'backtest', labelKey: 'tab.backtest', icon: History },
        { id: 'journal', labelKey: 'tab.journal', icon: BookOpen },
      ],
    },
    {
      label: 'Intelligence',
      labelZh: '智能分析',
      items: [
        { id: 'debate', labelKey: 'tab.debate', icon: Swords },
        { id: 'anomalies', labelKey: 'tab.anomalies', icon: AlertTriangle },
        { id: 'heatmap', labelKey: 'tab.heatmap', icon: Flame },
        { id: 'earnings', labelKey: 'tab.earnings', icon: Calendar },
      ],
    },
    {
      label: 'Tools',
      labelZh: '工具',
      items: [
        { id: 'alerts', labelKey: 'tab.alerts', icon: Bell },
        { id: 'multi-asset', labelKey: 'tab.multiAsset', icon: Globe },
        { id: 'strategy', labelKey: 'tab.strategy', icon: Crosshair },
        { id: 'agents', labelKey: 'tab.agents', icon: Cpu, badge: () => data?.agents?.findings?.length || 0 },
      ],
    },
  ];

  const allTabs = NAV_GROUPS.flatMap(g => g.items);

  // Tab navigation with animation
  const navigateTo = useCallback((tab: TabId) => {
    if (tab === activeTab) return;
    setTransitioning(true);
    setTimeout(() => {
      setActiveTab(tab);
      setTransitioning(false);
      setMobileNavOpen(false);
      setCommandOpen(false);
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }, 150);
  }, [activeTab]);

  // Command palette keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandOpen(prev => !prev);
        setCommandSearch('');
      }
      if (e.key === 'Escape') {
        setCommandOpen(false);
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Data fetching
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const fastRes = await fetch(`/api/analyze?locale=${locale}&phase=fast`);
      const fastJson = await fastRes.json();
      if (fastJson.success) {
        setData(fastJson.data);
        setLastRefresh(new Date().toISOString());
        setIsLoading(false);

        setAiLoading(true);
        try {
          const aiRes = await fetch(`/api/analyze?locale=${locale}&phase=ai`);
          const aiJson = await aiRes.json();
          if (aiJson.success) {
            setData(aiJson.data);
            setLastRefresh(new Date().toISOString());
          }
        } catch (e) {
          console.error('AI enrichment failed:', e);
        } finally {
          setAiLoading(false);
        }
        return;
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Responsive: auto-collapse sidebar on smaller screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1280) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isLoading && !data) return <FullPageLoader />;

  if (!data) {
    return (
      <div className="min-h-screen bg-jarvis-black flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-jarvis-accent/10 border border-jarvis-accent/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Sparkles className="w-8 h-8 text-jarvis-accent" />
          </div>
          <p className="text-jarvis-gray-400 mb-4">{t('common.loading')}</p>
          <button onClick={fetchData} className="px-4 py-2 rounded-lg bg-jarvis-accent/10 text-jarvis-accent border border-jarvis-accent/20 hover:bg-jarvis-accent/20 transition-all duration-200 font-mono text-sm hover:scale-105 active:scale-95">
            {t('common.retry')}
          </button>
        </div>
      </div>
    );
  }

  const { analysis, marketOverview, rawData, agents } = data;

  // Command palette filtered items
  const filteredCommands = commandSearch
    ? allTabs.filter(tab => {
        const label = t(tab.labelKey as any).toLowerCase();
        return label.includes(commandSearch.toLowerCase()) || tab.id.includes(commandSearch.toLowerCase());
      })
    : allTabs;

  return (
    <div className="h-screen bg-jarvis-black flex flex-col overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 bg-glow-radial pointer-events-none opacity-30" />
      <div className="fixed inset-0 data-grid pointer-events-none opacity-30" />

      <Header lastRefresh={lastRefresh} isLoading={isLoading || aiLoading} onRefresh={fetchData} />

      {/* AI Loading Banner */}
      {aiLoading && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
          <div className="bg-jarvis-gray-900/95 border border-jarvis-accent/30 rounded-full px-4 py-2 flex items-center gap-2 backdrop-blur-xl shadow-lg shadow-jarvis-accent/5">
            <div className="w-2 h-2 rounded-full bg-jarvis-accent animate-pulse" />
            <span className="text-xs font-mono text-jarvis-accent">
              {locale === 'zh' ? 'AI 分析中...' : 'AI ENRICHING...'}
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* ===== SIDEBAR NAVIGATION ===== */}
        <aside className={cn(
          'hidden lg:flex flex-col border-r border-jarvis-gray-800/50 bg-jarvis-black/80 backdrop-blur-xl transition-all duration-300 ease-out z-40 shrink-0',
          sidebarCollapsed ? 'w-[60px]' : 'w-56',
        )}>
          {/* Collapse toggle */}
          <div className={cn('p-2 flex', sidebarCollapsed ? 'justify-center' : 'justify-end')}>
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 rounded-lg text-jarvis-gray-500 hover:text-jarvis-white hover:bg-jarvis-gray-800/50 transition-all duration-200"
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Command palette trigger */}
          {!sidebarCollapsed && (
            <div className="px-3 mb-3">
              <button
                onClick={() => { setCommandOpen(true); setCommandSearch(''); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-jarvis-gray-900/50 border border-jarvis-gray-800/50 text-jarvis-gray-500 hover:text-jarvis-gray-300 hover:border-jarvis-gray-700/50 transition-all duration-200 text-xs"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="flex-1 text-left">{locale === 'zh' ? '搜尋...' : 'Search...'}</span>
                <kbd className="px-1.5 py-0.5 rounded bg-jarvis-gray-800 text-[10px] font-mono">⌘K</kbd>
              </button>
            </div>
          )}

          {/* Nav groups */}
          <nav className="flex-1 overflow-y-auto px-2 space-y-4 pb-4">
            {NAV_GROUPS.map(group => (
              <div key={group.label}>
                {!sidebarCollapsed && (
                  <h3 className="px-3 mb-1.5 text-[10px] uppercase tracking-[0.15em] text-jarvis-gray-600 font-semibold">
                    {locale === 'zh' ? group.labelZh : group.label}
                  </h3>
                )}
                {sidebarCollapsed && (
                  <div className="h-px bg-jarvis-gray-800/50 mx-2 my-2" />
                )}
                <div className="space-y-0.5">
                  {group.items.map(item => {
                    const isActive = activeTab === item.id;
                    const badge = item.badge?.();
                    return (
                      <button
                        key={item.id}
                        onClick={() => navigateTo(item.id)}
                        title={sidebarCollapsed ? t(item.labelKey as any) : undefined}
                        className={cn(
                          'w-full flex items-center gap-3 rounded-lg transition-all duration-200 group relative',
                          sidebarCollapsed ? 'px-0 py-2.5 justify-center' : 'px-3 py-2',
                          isActive
                            ? 'bg-jarvis-accent/10 text-jarvis-accent'
                            : 'text-jarvis-gray-400 hover:text-jarvis-white hover:bg-jarvis-gray-800/40'
                        )}
                      >
                        {/* Active indicator bar */}
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-jarvis-accent rounded-r-full transition-all duration-300" />
                        )}
                        <item.icon className={cn(
                          'w-4 h-4 shrink-0 transition-all duration-200',
                          isActive && 'scale-110',
                          !isActive && 'group-hover:scale-105'
                        )} />
                        {!sidebarCollapsed && (
                          <>
                            <span className="text-xs font-medium truncate">{t(item.labelKey as any)}</span>
                            {badge != null && Number(badge) > 0 && (
                              <span className={cn(
                                'ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded-full transition-all duration-200',
                                isActive ? 'bg-jarvis-accent/20 text-jarvis-accent' : 'bg-jarvis-gray-800 text-jarvis-gray-500'
                              )}>
                                {badge}
                              </span>
                            )}
                          </>
                        )}
                        {/* Tooltip for collapsed */}
                        {sidebarCollapsed && (
                          <div className="absolute left-full ml-2 px-2.5 py-1.5 rounded-lg bg-jarvis-gray-800 border border-jarvis-gray-700/50 text-jarvis-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 shadow-xl">
                            {t(item.labelKey as any)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* ===== MOBILE BOTTOM NAV ===== */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-jarvis-black/95 backdrop-blur-xl border-t border-jarvis-gray-800/50">
          <div className="flex items-center justify-around px-2 py-2">
            {[
              { id: 'overview' as TabId, icon: LayoutDashboard, label: locale === 'zh' ? '總覽' : 'Home' },
              { id: 'portfolio' as TabId, icon: Briefcase, label: locale === 'zh' ? '投資組合' : 'Portfolio' },
              { id: 'debate' as TabId, icon: Swords, label: locale === 'zh' ? '辯論' : 'Debate' },
              { id: 'journal' as TabId, icon: BookOpen, label: locale === 'zh' ? '日誌' : 'Journal' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => navigateTo(item.id)}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200 min-w-[60px]',
                  activeTab === item.id
                    ? 'text-jarvis-accent bg-jarvis-accent/5'
                    : 'text-jarvis-gray-500 active:text-jarvis-white active:scale-95'
                )}
              >
                <item.icon className={cn('w-5 h-5 transition-all duration-200', activeTab === item.id && 'scale-110')} />
                <span className="text-[9px] font-medium">{item.label}</span>
                {activeTab === item.id && (
                  <div className="w-1 h-1 rounded-full bg-jarvis-accent mt-0.5" />
                )}
              </button>
            ))}
            <button
              onClick={() => setMobileNavOpen(true)}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-jarvis-gray-500 active:text-jarvis-white active:scale-95 transition-all duration-200 min-w-[60px]"
            >
              <Search className="w-5 h-5" />
              <span className="text-[9px] font-medium">{locale === 'zh' ? '更多' : 'More'}</span>
            </button>
          </div>
        </div>

        {/* ===== MOBILE NAV DRAWER ===== */}
        {mobileNavOpen && (
          <div className="lg:hidden fixed inset-0 z-[60]">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setMobileNavOpen(false)} />
            <div className="absolute bottom-0 left-0 right-0 bg-jarvis-dark rounded-t-2xl border-t border-jarvis-gray-800/50 animate-slide-up max-h-[75vh] overflow-y-auto">
              <div className="sticky top-0 bg-jarvis-dark/95 backdrop-blur-xl p-4 border-b border-jarvis-gray-800/30 z-10">
                <div className="w-10 h-1 rounded-full bg-jarvis-gray-700 mx-auto mb-3" />
                <input
                  type="text"
                  placeholder={locale === 'zh' ? '搜尋功能...' : 'Search features...'}
                  className="w-full bg-jarvis-gray-900/50 border border-jarvis-gray-800/50 rounded-xl px-4 py-3 text-sm text-jarvis-white placeholder-jarvis-gray-600 focus:outline-none focus:border-jarvis-accent/50 transition-colors duration-200"
                  value={commandSearch}
                  onChange={e => setCommandSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="p-4 space-y-5 pb-8">
                {NAV_GROUPS.map(group => {
                  const items = commandSearch
                    ? group.items.filter(i => t(i.labelKey as any).toLowerCase().includes(commandSearch.toLowerCase()))
                    : group.items;
                  if (items.length === 0) return null;
                  return (
                    <div key={group.label}>
                      <h3 className="px-1 mb-2.5 text-[11px] uppercase tracking-[0.12em] text-jarvis-gray-500 font-semibold">
                        {locale === 'zh' ? group.labelZh : group.label}
                      </h3>
                      <div className="grid grid-cols-2 gap-2">
                        {items.map((item, i) => (
                          <button
                            key={item.id}
                            onClick={() => navigateTo(item.id)}
                            className={cn(
                              'flex items-center gap-2.5 px-3.5 py-3.5 rounded-xl transition-all duration-200 active:scale-95',
                              activeTab === item.id
                                ? 'bg-jarvis-accent/10 text-jarvis-accent border border-jarvis-accent/20'
                                : 'bg-jarvis-gray-900/50 text-jarvis-gray-300 border border-jarvis-gray-800/30 active:bg-jarvis-gray-800/50'
                            )}
                            style={{ animationDelay: `${i * 30}ms` }}
                          >
                            <item.icon className="w-4 h-4 shrink-0" />
                            <span className="text-xs font-medium">{t(item.labelKey as any)}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ===== COMMAND PALETTE (Desktop) ===== */}
        {commandOpen && (
          <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[18vh]">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setCommandOpen(false)} />
            <div className="relative w-full max-w-lg mx-4 bg-jarvis-dark border border-jarvis-gray-700/80 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden animate-scale-in">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-jarvis-gray-800/50">
                <Search className="w-4 h-4 text-jarvis-gray-500 shrink-0" />
                <input
                  type="text"
                  placeholder={locale === 'zh' ? '搜尋功能或頁面...' : 'Search features...'}
                  className="flex-1 bg-transparent text-sm text-jarvis-white placeholder-jarvis-gray-500 focus:outline-none"
                  value={commandSearch}
                  onChange={e => setCommandSearch(e.target.value)}
                  autoFocus
                />
                <button onClick={() => setCommandOpen(false)} className="p-1 rounded text-jarvis-gray-500 hover:text-jarvis-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Results */}
              <div className="max-h-[320px] overflow-y-auto p-2">
                {filteredCommands.map((item, i) => (
                  <button
                    key={item.id}
                    onClick={() => navigateTo(item.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-150',
                      activeTab === item.id
                        ? 'bg-jarvis-accent/10 text-jarvis-accent'
                        : 'text-jarvis-gray-300 hover:bg-jarvis-gray-800/50 hover:text-jarvis-white'
                    )}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="text-sm">{t(item.labelKey as any)}</span>
                    {activeTab === item.id && (
                      <span className="ml-auto text-[10px] font-mono text-jarvis-accent/60 bg-jarvis-accent/10 px-1.5 py-0.5 rounded">ACTIVE</span>
                    )}
                  </button>
                ))}
                {filteredCommands.length === 0 && (
                  <p className="text-center text-sm text-jarvis-gray-500 py-8">
                    {locale === 'zh' ? '找不到結果' : 'No results found'}
                  </p>
                )}
              </div>
              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-jarvis-gray-800/50 flex items-center gap-4 text-[10px] font-mono text-jarvis-gray-600">
                <span>↵ {locale === 'zh' ? '選擇' : 'Select'}</span>
                <span>ESC {locale === 'zh' ? '關閉' : 'Close'}</span>
              </div>
            </div>
          </div>
        )}

        {/* ===== MAIN CONTENT ===== */}
        <main
          ref={contentRef}
          className={cn(
            'flex-1 overflow-y-auto pb-20 lg:pb-6 relative',
            transitioning ? 'opacity-0 scale-[0.99]' : 'opacity-100 scale-100',
            'transition-all duration-200 ease-out'
          )}
        >
          <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5">
            {/* Page header */}
            <div className="flex items-center gap-3 mb-5">
              {(() => {
                const tab = allTabs.find(t => t.id === activeTab);
                if (!tab) return null;
                return (
                  <div className="flex items-center gap-3 animate-fade-in">
                    <div className="w-9 h-9 rounded-xl bg-jarvis-accent/10 border border-jarvis-accent/20 flex items-center justify-center">
                      <tab.icon className="w-[18px] h-[18px] text-jarvis-accent" />
                    </div>
                    <h1 className="text-lg font-semibold text-jarvis-white tracking-tight">{t(tab.labelKey as any)}</h1>
                  </div>
                );
              })()}
            </div>

            {/* ===== TAB CONTENT ===== */}
            <div className={cn(transitioning ? '' : 'animate-content-in')}>
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
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
                            <div key={signal.ticker} className="animate-slide-up" style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}>
                              <StockCard signal={signal} rank={i + 1} onClick={() => setSelectedStock(signal)} />
                            </div>
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
                            <div key={signal.ticker} className="animate-slide-up" style={{ animationDelay: `${(i + 4) * 80}ms`, animationFillMode: 'both' }}>
                              <StockCard signal={signal} rank={i + 1} onClick={() => setSelectedStock(signal)} />
                            </div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {analysis.topBullish.map((signal, i) => (
                    <div key={signal.ticker} className="animate-slide-up" style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}>
                      <StockCard signal={signal} rank={i + 1} onClick={() => setSelectedStock(signal)} />
                    </div>
                  ))}
                </div>
              )}

              {/* Bearish Tab */}
              {activeTab === 'bearish' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {analysis.topBearish.map((signal, i) => (
                    <div key={signal.ticker} className="animate-slide-up" style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}>
                      <StockCard signal={signal} rank={i + 1} onClick={() => setSelectedStock(signal)} />
                    </div>
                  ))}
                </div>
              )}

              {/* News Tab */}
              {activeTab === 'news' && (
                <div className="max-w-4xl">
                  <NewsFeed articles={rawData.news} />
                </div>
              )}

              {/* Social Tab */}
              {activeTab === 'social' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <SocialFeed redditPosts={rawData.reddit} tweets={rawData.tweets} />
                  <div className="space-y-6">
                    <TrendingTopics topics={analysis.trendingTopics} />
                    <SentimentChart report={analysis} />
                  </div>
                </div>
              )}

              {activeTab === 'portfolio' && <PortfolioView />}
              {activeTab === 'options' && <OptionsPanel />}
              {activeTab === 'earnings' && <EarningsPanel />}
              {activeTab === 'anomalies' && <AnomalyPanel anomalies={data.anomalies || []} />}
              {activeTab === 'debate' && <DebatePanel />}
              {activeTab === 'alerts' && <AlertsPanel />}
              {activeTab === 'backtest' && <BacktestPanel />}
              {activeTab === 'multi-asset' && <MultiAssetPanel />}
              {activeTab === 'heatmap' && (
                <SentimentHeatmap
                  redditPosts={data.rawData?.reddit || []}
                  tweets={data.rawData?.tweets || []}
                  news={data.rawData?.news || []}
                />
              )}
              {activeTab === 'journal' && <JournalPanel />}
              {activeTab === 'strategy' && <StrategyPanel strategy={data.strategy} />}
              {activeTab === 'agents' && (
                <AgentPanel
                  agentStates={agents.states}
                  expertSummary={agents.expertSummary}
                  findings={agents.findings}
                  chainReactions={agents.chainReactions}
                />
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Stock Detail Modal */}
      {selectedStock && (
        <div className="animate-fade-in">
          <StockDetail signal={selectedStock} onClose={() => setSelectedStock(null)} />
        </div>
      )}
    </div>
  );
}
