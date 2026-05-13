'use client';

import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import { Loader2, BookOpen, Plus, Trash2, TrendingUp, TrendingDown, Brain, Target } from 'lucide-react';

export interface TradeEntry {
  id: string;
  ticker: string;
  action: 'buy' | 'sell' | 'short' | 'cover';
  price: number;
  shares: number;
  date: string;
  reasoning: string;
  emotion: 'confident' | 'fearful' | 'greedy' | 'neutral' | 'fomo';
  outcome?: 'win' | 'loss' | 'open';
  pnl?: number;
  lessons?: string;
}

const STORAGE_KEY = 'jarvis-journal';

function loadJournal(): TradeEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function saveJournal(entries: TradeEntry[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }
}

const EMOTIONS = [
  { value: 'confident', en: 'Confident', zh: '\u81EA\u4FE1', emoji: '\U0001f4AA' },
  { value: 'fearful', en: 'Fearful', zh: '\u6050\u61FC', emoji: '\U0001f628' },
  { value: 'greedy', en: 'Greedy', zh: '\u8CAA\u5A6A', emoji: '\U0001f911' },
  { value: 'neutral', en: 'Neutral', zh: '\u7406\u6027', emoji: '\U0001f610' },
  { value: 'fomo', en: 'FOMO', zh: 'FOMO', emoji: '\U0001f525' },
];

const ACTIONS = [
  { value: 'buy', en: 'Buy', zh: '\u8CB7\u5165' },
  { value: 'sell', en: 'Sell', zh: '\u8CE3\u51FA' },
  { value: 'short', en: 'Short', zh: '\u505A\u7A7A' },
  { value: 'cover', en: 'Cover', zh: '\u5E73\u5009' },
];

export default function JournalPanel() {
  const { locale } = useI18n();
  const [entries, setEntries] = useState<TradeEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [aiCoaching, setAiCoaching] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Form state
  const [fTicker, setFTicker] = useState('');
  const [fAction, setFAction] = useState<TradeEntry['action']>('buy');
  const [fPrice, setFPrice] = useState('');
  const [fShares, setFShares] = useState('');
  const [fReasoning, setFReasoning] = useState('');
  const [fEmotion, setFEmotion] = useState<TradeEntry['emotion']>('neutral');
  const [fOutcome, setFOutcome] = useState<'win' | 'loss' | 'open'>('open');
  const [fPnl, setFPnl] = useState('');

  useEffect(() => {
    setEntries(loadJournal());
  }, []);

  const persist = useCallback((updater: (prev: TradeEntry[]) => TradeEntry[]) => {
    setEntries(prev => {
      const next = updater(prev);
      saveJournal(next);
      return next;
    });
  }, []);

  const addEntry = () => {
    if (!fTicker.trim() || !fPrice.trim()) return;
    const entry: TradeEntry = {
      id: Date.now().toString(),
      ticker: fTicker.toUpperCase(),
      action: fAction,
      price: parseFloat(fPrice),
      shares: parseInt(fShares) || 0,
      date: new Date().toISOString().split('T')[0],
      reasoning: fReasoning,
      emotion: fEmotion,
      outcome: fOutcome,
      pnl: fPnl ? parseFloat(fPnl) : undefined,
    };
    persist(prev => [entry, ...prev]);
    setFTicker(''); setFPrice(''); setFShares(''); setFReasoning(''); setFPnl('');
    setShowForm(false);
  };

  const removeEntry = (id: string) => {
    persist(prev => prev.filter(e => e.id !== id));
  };

  const getAICoaching = async () => {
    if (entries.length < 3) return;
    setAiLoading(true);
    try {
      const res = await fetch(`/api/journal-coach?locale=${locale}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries: entries.slice(0, 20) }),
      });
      const json = await res.json();
      if (json.success) {
        setAiCoaching(json.data.coaching);
      }
    } catch { /* ignore */ }
    finally { setAiLoading(false); }
  };

  // Stats
  const wins = entries.filter(e => e.outcome === 'win').length;
  const losses = entries.filter(e => e.outcome === 'loss').length;
  const winRate = (wins + losses) > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : '0';
  const emotionCounts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.emotion] = (acc[e.emotion] || 0) + 1;
    return acc;
  }, {});
  const topEmotion = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-jarvis-accent" />
          <h2 className="text-lg font-semibold text-jarvis-white">
            {locale === 'zh' ? '\u4EA4\u6613\u65E5\u8A8C' : 'Trading Journal'}
          </h2>
          <span className="text-xs font-mono text-jarvis-gray-500">{entries.length} {locale === 'zh' ? '\u7B46' : 'trades'}</span>
        </div>
        <div className="flex items-center gap-2">
          {entries.length >= 3 && (
            <button
              onClick={getAICoaching}
              disabled={aiLoading}
              className="px-3 py-1.5 rounded-lg bg-jarvis-accent/10 text-jarvis-accent border border-jarvis-accent/20 hover:bg-jarvis-accent/20 transition-all text-xs font-mono flex items-center gap-1 disabled:opacity-40"
            >
              {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Brain className="w-3 h-3" />}
              {locale === 'zh' ? 'AI\u6559\u7DF4' : 'AI Coach'}
            </button>
          )}
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 rounded-lg bg-jarvis-accent/20 text-jarvis-accent border border-jarvis-accent/30 hover:bg-jarvis-accent/30 transition-all text-xs font-mono flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            {locale === 'zh' ? '\u65B0\u589E\u4EA4\u6613' : 'New Trade'}
          </button>
        </div>
      </div>

      {/* Stats */}
      {entries.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="glass-panel p-3 text-center">
            <div className="text-xs text-jarvis-gray-500 mb-1">{locale === 'zh' ? '\u52DD\u7387' : 'Win Rate'}</div>
            <div className={cn('text-lg font-bold font-mono', parseFloat(winRate) >= 50 ? 'text-jarvis-green' : 'text-jarvis-red')}>{winRate}%</div>
          </div>
          <div className="glass-panel p-3 text-center">
            <div className="text-xs text-jarvis-gray-500 mb-1">{locale === 'zh' ? '\u7E3D\u7372\u5229/\u8667' : 'Total P&L'}</div>
            <div className={cn('text-lg font-bold font-mono',
              entries.reduce((s, e) => s + (e.pnl || 0), 0) >= 0 ? 'text-jarvis-green' : 'text-jarvis-red'
            )}>
              ${entries.reduce((s, e) => s + (e.pnl || 0), 0).toFixed(0)}
            </div>
          </div>
          <div className="glass-panel p-3 text-center">
            <div className="text-xs text-jarvis-gray-500 mb-1">{locale === 'zh' ? '\u52DD/\u8F38' : 'W/L'}</div>
            <div className="text-lg font-mono">
              <span className="text-jarvis-green">{wins}</span>
              <span className="text-jarvis-gray-600">/</span>
              <span className="text-jarvis-red">{losses}</span>
            </div>
          </div>
          <div className="glass-panel p-3 text-center">
            <div className="text-xs text-jarvis-gray-500 mb-1">{locale === 'zh' ? '\u4E3B\u8981\u60C5\u7DD2' : 'Top Emotion'}</div>
            <div className="text-lg">
              {topEmotion ? `${EMOTIONS.find(e => e.value === topEmotion[0])?.emoji || ''} ${topEmotion[1]}x` : '-'}
            </div>
          </div>
        </div>
      )}

      {/* AI Coaching */}
      {aiCoaching && (
        <div className="glass-panel p-4 border-l-2 border-jarvis-accent">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-jarvis-accent" />
            <span className="text-xs font-mono text-jarvis-accent uppercase">
              {locale === 'zh' ? 'JARVIS \u4EA4\u6613\u6559\u7DF4' : 'JARVIS TRADING COACH'}
            </span>
          </div>
          {aiCoaching.split('\n').filter(Boolean).map((p, i) => (
            <p key={i} className="text-sm text-jarvis-gray-300 leading-relaxed mb-2">{p}</p>
          ))}
        </div>
      )}

      {/* Add Form */}
      {showForm && (
        <div className="glass-panel p-4 space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input type="text" value={fTicker} onChange={e => setFTicker(e.target.value.toUpperCase())} placeholder="Ticker"
              className="bg-jarvis-gray-900/50 border border-jarvis-gray-700/50 rounded-lg px-3 py-2 text-sm font-mono text-jarvis-white placeholder-jarvis-gray-600 focus:outline-none focus:border-jarvis-accent/50" />
            <select value={fAction} onChange={e => setFAction(e.target.value as any)}
              className="bg-jarvis-gray-900/50 border border-jarvis-gray-700/50 rounded-lg px-3 py-2 text-sm text-jarvis-white focus:outline-none focus:border-jarvis-accent/50">
              {ACTIONS.map(a => <option key={a.value} value={a.value}>{locale === 'zh' ? a.zh : a.en}</option>)}
            </select>
            <input type="number" value={fPrice} onChange={e => setFPrice(e.target.value)} placeholder={locale === 'zh' ? '\u50F9\u683C' : 'Price'}
              className="bg-jarvis-gray-900/50 border border-jarvis-gray-700/50 rounded-lg px-3 py-2 text-sm font-mono text-jarvis-white placeholder-jarvis-gray-600 focus:outline-none focus:border-jarvis-accent/50" />
            <input type="number" value={fShares} onChange={e => setFShares(e.target.value)} placeholder={locale === 'zh' ? '\u6578\u91CF' : 'Shares'}
              className="bg-jarvis-gray-900/50 border border-jarvis-gray-700/50 rounded-lg px-3 py-2 text-sm font-mono text-jarvis-white placeholder-jarvis-gray-600 focus:outline-none focus:border-jarvis-accent/50" />
          </div>
          <textarea value={fReasoning} onChange={e => setFReasoning(e.target.value)}
            placeholder={locale === 'zh' ? '\u4EA4\u6613\u7406\u7531...' : 'Why did you make this trade?'}
            className="w-full bg-jarvis-gray-900/50 border border-jarvis-gray-700/50 rounded-lg px-3 py-2 text-sm text-jarvis-white placeholder-jarvis-gray-600 focus:outline-none focus:border-jarvis-accent/50 h-16 resize-none" />
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {EMOTIONS.map(em => (
                <button key={em.value} onClick={() => setFEmotion(em.value as any)}
                  className={cn('px-2 py-1 rounded text-xs transition-all', fEmotion === em.value ? 'bg-jarvis-accent/20 border border-jarvis-accent/30' : 'border border-jarvis-gray-800 hover:border-jarvis-gray-700')}>
                  {em.emoji}
                </button>
              ))}
            </div>
            <select value={fOutcome} onChange={e => setFOutcome(e.target.value as any)}
              className="bg-jarvis-gray-900/50 border border-jarvis-gray-700/50 rounded px-2 py-1 text-xs text-jarvis-white focus:outline-none">
              <option value="open">{locale === 'zh' ? '\u672A\u5E73' : 'Open'}</option>
              <option value="win">{locale === 'zh' ? '\u7372\u5229' : 'Win'}</option>
              <option value="loss">{locale === 'zh' ? '\u8667\u640D' : 'Loss'}</option>
            </select>
            <input type="number" value={fPnl} onChange={e => setFPnl(e.target.value)} placeholder="P&L ($)"
              className="w-24 bg-jarvis-gray-900/50 border border-jarvis-gray-700/50 rounded px-2 py-1 text-xs font-mono text-jarvis-white placeholder-jarvis-gray-600 focus:outline-none" />
            <button onClick={addEntry} disabled={!fTicker.trim() || !fPrice.trim()}
              className="px-4 py-1.5 rounded bg-jarvis-accent/20 text-jarvis-accent text-xs font-mono disabled:opacity-40 hover:bg-jarvis-accent/30 transition-all">
              {locale === 'zh' ? '\u5132\u5B58' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-12 h-12 text-jarvis-gray-700 mx-auto mb-4" />
          <p className="text-jarvis-gray-500 text-sm">
            {locale === 'zh' ? '\u958B\u59CB\u8A18\u9304\u4F60\u7684\u4EA4\u6613\uFF0CAI\u6703\u5206\u6790\u4F60\u7684\u6A21\u5F0F' : 'Start logging trades and AI will analyze your patterns'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => {
            const emotionInfo = EMOTIONS.find(e => e.value === entry.emotion);
            return (
              <div key={entry.id} className="glass-panel p-3 flex items-center gap-3">
                <span className="text-lg">{emotionInfo?.emoji || ''}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs px-1.5 py-0.5 rounded font-mono',
                      entry.action === 'buy' || entry.action === 'cover' ? 'bg-jarvis-green/10 text-jarvis-green' : 'bg-jarvis-red/10 text-jarvis-red'
                    )}>
                      {entry.action.toUpperCase()}
                    </span>
                    <span className="text-sm font-bold text-jarvis-white">{entry.ticker}</span>
                    <span className="text-xs font-mono text-jarvis-gray-500">${entry.price} x{entry.shares}</span>
                    <span className="text-xs text-jarvis-gray-600">{entry.date}</span>
                    {entry.outcome === 'win' && <TrendingUp className="w-3 h-3 text-jarvis-green" />}
                    {entry.outcome === 'loss' && <TrendingDown className="w-3 h-3 text-jarvis-red" />}
                    {entry.pnl != null && (
                      <span className={cn('text-xs font-mono', entry.pnl >= 0 ? 'text-jarvis-green' : 'text-jarvis-red')}>
                        {entry.pnl >= 0 ? '+' : ''}${entry.pnl}
                      </span>
                    )}
                  </div>
                  {entry.reasoning && (
                    <p className="text-xs text-jarvis-gray-500 truncate mt-0.5">{entry.reasoning}</p>
                  )}
                </div>
                <button onClick={() => removeEntry(entry.id)}
                  className="p-1.5 rounded text-jarvis-gray-600 hover:text-jarvis-red hover:bg-jarvis-red/10 transition-all shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
