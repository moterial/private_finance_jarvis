'use client';

import { useState, useCallback } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { usePortfolio } from '@/lib/portfolio/store';
import { cn } from '@/lib/utils';
import { Loader2, Shield, AlertTriangle, Zap } from 'lucide-react';

interface StressScenario {
  name: string;
  description: string;
  impact: string;
  portfolioChange: number;
  affectedPositions: { ticker: string; estimatedChange: number; reasoning: string }[];
  hedgeSuggestion: string;
}

const IMPACT_CONFIG = {
  severe: { color: 'text-jarvis-red', bg: 'bg-jarvis-red/10', border: 'border-jarvis-red/30' },
  moderate: { color: 'text-jarvis-amber', bg: 'bg-jarvis-amber/10', border: 'border-jarvis-amber/30' },
  mild: { color: 'text-jarvis-green', bg: 'bg-jarvis-green/10', border: 'border-jarvis-green/30' },
};

export default function StressTestPanel() {
  const { locale } = useI18n();
  const { portfolio } = usePortfolio();
  const [scenarios, setScenarios] = useState<StressScenario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runStressTest = useCallback(async () => {
    if (portfolio.positions.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/stress-test?locale=${locale}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positions: portfolio.positions }),
      });
      const json = await res.json();
      if (json.success) {
        setScenarios(json.data.scenarios);
      } else {
        setError(json.error || 'Failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, [portfolio.positions, locale]);

  if (portfolio.positions.length === 0) {
    return (
      <div className="text-center py-10">
        <Shield className="w-10 h-10 text-jarvis-gray-700 mx-auto mb-3" />
        <p className="text-jarvis-gray-500 text-sm">
          {locale === 'zh' ? '\u8ACB\u5148\u65B0\u589E\u6301\u5009\u518D\u57F7\u884C\u58D3\u529B\u6E2C\u8A66' : 'Add portfolio positions first to run stress test'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-jarvis-accent" />
          <span className="text-sm font-mono text-jarvis-accent uppercase">
            {locale === 'zh' ? '\u58D3\u529B\u6E2C\u8A66' : 'Stress Test'}
          </span>
        </div>
        <button
          onClick={runStressTest}
          disabled={loading}
          className="px-4 py-1.5 rounded-lg bg-jarvis-accent/20 text-jarvis-accent border border-jarvis-accent/30 hover:bg-jarvis-accent/30 transition-all text-xs font-mono flex items-center gap-2 disabled:opacity-40"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
          {loading
            ? (locale === 'zh' ? '\u5206\u6790\u4E2D...' : 'Analyzing...')
            : (locale === 'zh' ? '\u57F7\u884C\u58D3\u529B\u6E2C\u8A66' : 'Run Stress Test')}
        </button>
      </div>

      {error && (
        <div className="p-2 rounded bg-jarvis-red/10 border border-jarvis-red/20 text-jarvis-red text-xs">{error}</div>
      )}

      {scenarios.length > 0 && (
        <div className="space-y-3">
          {scenarios.map((scenario, i) => {
            const config = IMPACT_CONFIG[scenario.impact as keyof typeof IMPACT_CONFIG] || IMPACT_CONFIG.moderate;
            return (
              <div key={i} className={cn('glass-panel p-4 border-l-2', config.border)}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-jarvis-white">{scenario.name}</h4>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs px-1.5 py-0.5 rounded font-mono', config.bg, config.color)}>
                      {scenario.impact.toUpperCase()}
                    </span>
                    <span className={cn('text-sm font-mono font-bold', scenario.portfolioChange < 0 ? 'text-jarvis-red' : 'text-jarvis-green')}>
                      {scenario.portfolioChange > 0 ? '+' : ''}{scenario.portfolioChange}%
                    </span>
                  </div>
                </div>
                <p className="text-xs text-jarvis-gray-400 mb-3">{scenario.description}</p>

                {/* Affected positions */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {scenario.affectedPositions?.slice(0, 5).map((pos, pi) => (
                    <div key={pi} className="flex items-center gap-1 text-xs font-mono bg-jarvis-gray-900/50 px-2 py-1 rounded">
                      <span className="text-jarvis-white">{pos.ticker}</span>
                      <span className={pos.estimatedChange < 0 ? 'text-jarvis-red' : 'text-jarvis-green'}>
                        {pos.estimatedChange > 0 ? '+' : ''}{pos.estimatedChange}%
                      </span>
                    </div>
                  ))}
                </div>

                {/* Hedge suggestion */}
                <div className="flex items-start gap-2 bg-jarvis-accent/5 rounded p-2">
                  <Shield className="w-3 h-3 text-jarvis-accent mt-0.5 shrink-0" />
                  <span className="text-xs text-jarvis-gray-400">{scenario.hedgeSuggestion}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
