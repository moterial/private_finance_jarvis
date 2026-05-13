'use client';

import { useState, useCallback } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import { Loader2, Swords, TrendingUp, TrendingDown, Scale } from 'lucide-react';

interface DebateData {
  ticker: string;
  bullCase: string;
  bearCase: string;
  verdict: string;
}

export default function DebatePanel() {
  const { locale } = useI18n();
  const [ticker, setTicker] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [data, setData] = useState<DebateData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDebate = useCallback(async () => {
    const t = inputValue.trim().toUpperCase();
    if (!t) return;
    setTicker(t);
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/debate?ticker=${t}&locale=${locale}`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || 'Failed to generate debate');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [inputValue, locale]);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && startDebate()}
            placeholder={locale === 'zh' ? '\u8F38\u5165\u80A1\u7968\u4EE3\u78BC\u958B\u59CB\u8FA6\u8AD6...' : 'Enter ticker to start debate...'}
            className="w-full bg-jarvis-gray-900/50 border border-jarvis-gray-700/50 rounded-lg px-4 py-2.5 text-sm font-mono text-jarvis-white placeholder-jarvis-gray-600 focus:outline-none focus:border-jarvis-accent/50 transition-colors"
          />
        </div>
        <button
          onClick={startDebate}
          disabled={loading || !inputValue.trim()}
          className="px-5 py-2.5 rounded-lg bg-jarvis-accent/20 text-jarvis-accent border border-jarvis-accent/30 hover:bg-jarvis-accent/30 transition-all text-sm font-mono flex items-center gap-2 disabled:opacity-40"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
          {locale === 'zh' ? '\u958B\u59CB\u8FA6\u8AD6' : 'Debate'}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-jarvis-red/10 border border-jarvis-red/20 text-jarvis-red text-sm">{error}</div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-jarvis-accent animate-spin" />
          <span className="ml-3 text-sm text-jarvis-gray-400 font-mono">
            {locale === 'zh' ? `AI \u6B63\u5728\u8FA6\u8AD6 ${ticker}...` : `AI debating ${ticker}...`}
          </span>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Title */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6 text-jarvis-green" />
              <Swords className="w-5 h-5 text-jarvis-gray-500" />
              <TrendingDown className="w-6 h-6 text-jarvis-red" />
            </div>
            <h2 className="text-lg font-bold text-jarvis-white">{data.ticker} — Bull vs Bear</h2>
          </div>

          {/* Debate Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bull Case */}
            <div className="glass-panel p-5 border-t-2 border-jarvis-green/50">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-jarvis-green" />
                <h3 className="text-sm font-bold text-jarvis-green uppercase font-mono">
                  {locale === 'zh' ? '\U0001f4c8 \u591A\u982D\u8AD6\u9EDE' : '\U0001f4c8 BULL CASE'}
                </h3>
              </div>
              <div className="prose-sm">
                {data.bullCase.split('\n').filter(Boolean).map((p, i) => (
                  <p key={i} className="text-sm text-jarvis-gray-300 leading-relaxed mb-3">{p}</p>
                ))}
              </div>
            </div>

            {/* Bear Case */}
            <div className="glass-panel p-5 border-t-2 border-jarvis-red/50">
              <div className="flex items-center gap-2 mb-4">
                <TrendingDown className="w-5 h-5 text-jarvis-red" />
                <h3 className="text-sm font-bold text-jarvis-red uppercase font-mono">
                  {locale === 'zh' ? '\U0001f4c9 \u7A7A\u982D\u8AD6\u9EDE' : '\U0001f4c9 BEAR CASE'}
                </h3>
              </div>
              <div className="prose-sm">
                {data.bearCase.split('\n').filter(Boolean).map((p, i) => (
                  <p key={i} className="text-sm text-jarvis-gray-300 leading-relaxed mb-3">{p}</p>
                ))}
              </div>
            </div>
          </div>

          {/* Verdict */}
          <div className="glass-panel p-5 border-l-4 border-jarvis-accent">
            <div className="flex items-center gap-2 mb-3">
              <Scale className="w-5 h-5 text-jarvis-accent" />
              <h3 className="text-sm font-bold text-jarvis-accent uppercase font-mono">
                {locale === 'zh' ? 'JARVIS \u88C1\u5224' : 'JARVIS VERDICT'}
              </h3>
            </div>
            {data.verdict.split('\n').filter(Boolean).map((p, i) => (
              <p key={i} className="text-sm text-jarvis-gray-300 leading-relaxed mb-2">{p}</p>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!data && !loading && !error && (
        <div className="text-center py-20">
          <Swords className="w-12 h-12 text-jarvis-gray-700 mx-auto mb-4" />
          <h3 className="text-jarvis-gray-400 font-semibold mb-2">
            {locale === 'zh' ? 'AI \u591A\u7A7A\u8FA6\u8AD6' : 'AI Bull vs Bear Debate'}
          </h3>
          <p className="text-jarvis-gray-600 text-sm">
            {locale === 'zh' ? '\u8F38\u5165\u4EFB\u4F55\u80A1\u7968\u4EE3\u78BC\uFF0CAI\u6703\u540C\u6642\u751F\u6210\u6700\u5F37\u7684\u591A\u982D\u548C\u7A7A\u982D\u8AD6\u9EDE' : 'Enter any ticker and AI will generate the strongest bull and bear arguments simultaneously'}
          </p>
        </div>
      )}
    </div>
  );
}
