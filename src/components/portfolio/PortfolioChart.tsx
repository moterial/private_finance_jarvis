'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface HistoryPoint {
  date: string;
  total_value: number;
  total_cost: number;
  day_pnl: number;
}

export default function PortfolioChart() {
  const { locale } = useI18n();
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      try {
        const res = await fetch(`/api/portfolio-history?days=${days}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (json.success) setHistory(json.data);
      } catch { /* silent */ }
      setLoading(false);
    }
    load();
  }, [days, supabase]);

  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-4 animate-pulse">
        <div className="h-40 bg-gray-700/50 rounded" />
      </div>
    );
  }

  if (history.length < 2) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-4 text-center text-gray-400">
        <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">
          {locale === 'zh' ? '至少需要2天數據才能繪製圖表' : 'Need at least 2 days of data to draw chart'}
        </p>
        <p className="text-xs mt-1 opacity-60">
          {locale === 'zh' ? '每日自動記錄投資組合快照' : 'Portfolio snapshots are saved daily automatically'}
        </p>
      </div>
    );
  }

  // Chart dimensions
  const W = 600, H = 160, PAD = 30;
  const values = history.map(h => h.total_value);
  const minV = Math.min(...values) * 0.995;
  const maxV = Math.max(...values) * 1.005;
  const rangeV = maxV - minV || 1;

  const points = history.map((h, i) => ({
    x: PAD + (i / (history.length - 1)) * (W - PAD * 2),
    y: PAD + (1 - (h.total_value - minV) / rangeV) * (H - PAD * 2),
    v: h.total_value,
    d: h.date,
    pnl: h.day_pnl,
  }));

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const area = `${line} L${points[points.length - 1].x},${H - PAD} L${points[0].x},${H - PAD} Z`;
  const isUp = values[values.length - 1] >= values[0];
  const color = isUp ? '#22c55e' : '#ef4444';

  const totalReturn = values[values.length - 1] - values[0];
  const totalReturnPct = values[0] > 0 ? (totalReturn / values[0]) * 100 : 0;

  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-medium text-gray-200">
            {locale === 'zh' ? '投資組合走勢' : 'Portfolio Performance'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn(
                'text-xs px-2 py-0.5 rounded',
                days === d ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              )}
            >
              {d}D
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className={cn('text-lg font-bold', isUp ? 'text-green-400' : 'text-red-400')}>
          {isUp ? '+' : ''}{totalReturn.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
        </span>
        <span className={cn('text-xs flex items-center gap-0.5', isUp ? 'text-green-400' : 'text-red-400')}>
          {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {isUp ? '+' : ''}{totalReturnPct.toFixed(2)}%
        </span>
        <span className="text-xs text-gray-500">({days}D)</span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="pfGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#pfGrad)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2" />
        {/* Value labels */}
        <text x={PAD} y={PAD - 5} fill="#9ca3af" fontSize="10">
          ${maxV.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </text>
        <text x={PAD} y={H - PAD + 12} fill="#9ca3af" fontSize="10">
          ${minV.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </text>
        {/* Date labels */}
        <text x={points[0].x} y={H - 5} fill="#6b7280" fontSize="9" textAnchor="start">
          {history[0].date.slice(5)}
        </text>
        <text x={points[points.length - 1].x} y={H - 5} fill="#6b7280" fontSize="9" textAnchor="end">
          {history[history.length - 1].date.slice(5)}
        </text>
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={color} opacity="0.7">
            <title>{p.d}: ${p.v.toLocaleString(undefined, { maximumFractionDigits: 2 })}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
