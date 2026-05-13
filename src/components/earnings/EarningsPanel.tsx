'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import { Loader2, Calendar, Sun, Moon, Target } from 'lucide-react';

interface EarningsEvent {
  ticker: string;
  name: string;
  date: string;
  hour: string;
  epsEstimate: number | null;
  epsActual: number | null;
  revenueEstimate: number | null;
  revenueActual: number | null;
  surprise: number | null;
  quarter: string;
}

interface EarningsData {
  earnings: EarningsEvent[];
  aiPredictions: Record<string, string> | null;
}

export default function EarningsPanel() {
  const { locale } = useI18n();
  const [data, setData] = useState<EarningsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/earnings?locale=${locale}`);
        const json = await res.json();
        if (json.success) setData(json.data);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, [locale]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-jarvis-accent animate-spin" />
        <span className="ml-3 text-sm text-jarvis-gray-400 font-mono">
          {locale === 'zh' ? '\u8F09\u5165\u8CA1\u5831\u65E5\u66C6...' : 'Loading earnings calendar...'}
        </span>
      </div>
    );
  }

  if (!data || data.earnings.length === 0) {
    return (
      <div className="text-center py-20">
        <Calendar className="w-12 h-12 text-jarvis-gray-700 mx-auto mb-4" />
        <p className="text-jarvis-gray-500 text-sm">
          {locale === 'zh' ? '\u7121\u5373\u5C07\u5230\u4F86\u7684\u8CA1\u5831' : 'No upcoming earnings found'}
        </p>
      </div>
    );
  }

  // Group by date
  const grouped = data.earnings.reduce<Record<string, EarningsEvent[]>>((acc, e) => {
    (acc[e.date] ||= []).push(e);
    return acc;
  }, {});

  const dates = Object.keys(grouped).sort();

  return (
    <div className="animate-fade-in space-y-6">
      {/* AI Predictions Summary */}
      {data.aiPredictions && Object.keys(data.aiPredictions).length > 0 && (
        <div className="glass-panel p-4 border-l-2 border-jarvis-accent">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-jarvis-accent" />
            <span className="text-xs font-mono text-jarvis-accent uppercase">
              {locale === 'zh' ? 'JARVIS \u8CA1\u5831\u9810\u6E2C' : 'JARVIS EARNINGS PREDICTIONS'}
            </span>
          </div>
          <div className="space-y-2">
            {Object.entries(data.aiPredictions).map(([ticker, prediction]) => (
              <div key={ticker} className="flex items-start gap-3">
                <span className="text-xs font-mono font-bold text-jarvis-accent shrink-0 w-14">{ticker}</span>
                <span className="text-sm text-jarvis-gray-300">{prediction}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="space-y-4">
        {dates.map(date => {
          const events = grouped[date];
          const d = new Date(date + 'T12:00:00');
          const dayName = d.toLocaleDateString(locale === 'zh' ? 'zh-TW' : 'en-US', { weekday: 'short' });
          const dateStr = d.toLocaleDateString(locale === 'zh' ? 'zh-TW' : 'en-US', { month: 'short', day: 'numeric' });
          const isToday = date === new Date().toISOString().split('T')[0];

          return (
            <div key={date}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-3.5 h-3.5 text-jarvis-gray-500" />
                <span className={cn('text-sm font-mono', isToday ? 'text-jarvis-accent font-bold' : 'text-jarvis-gray-400')}>
                  {dayName} {dateStr}
                  {isToday && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-jarvis-accent/10 text-jarvis-accent border border-jarvis-accent/20">TODAY</span>}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {events.map((event, i) => (
                  <div key={i} className="glass-panel p-3 hover:border-jarvis-gray-600/50 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-jarvis-white">{event.ticker}</span>
                        <span className="text-xs text-jarvis-gray-600 truncate max-w-[120px]">{event.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {event.hour === 'bmo' && <Sun className="w-3 h-3 text-jarvis-amber" />}
                        {event.hour === 'amc' && <Moon className="w-3 h-3 text-jarvis-blue" />}
                        <span className="text-xs text-jarvis-gray-600 font-mono">
                          {event.hour === 'bmo' ? 'Pre' : event.hour === 'amc' ? 'Post' : ''}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-jarvis-gray-600">EPS Est</span>
                        <div className="text-jarvis-white font-mono">
                          {event.epsEstimate != null ? `$${event.epsEstimate.toFixed(2)}` : '-'}
                        </div>
                      </div>
                      <div>
                        <span className="text-jarvis-gray-600">EPS Act</span>
                        <div className={cn('font-mono',
                          event.epsActual != null
                            ? (event.surprise != null && event.surprise > 0 ? 'text-jarvis-green' : 'text-jarvis-red')
                            : 'text-jarvis-gray-600'
                        )}>
                          {event.epsActual != null ? `$${event.epsActual.toFixed(2)}` : '-'}
                        </div>
                      </div>
                    </div>
                    {event.surprise != null && (
                      <div className={cn('mt-2 text-xs font-mono px-2 py-1 rounded text-center',
                        event.surprise > 0
                          ? 'bg-jarvis-green/10 text-jarvis-green border border-jarvis-green/20'
                          : 'bg-jarvis-red/10 text-jarvis-red border border-jarvis-red/20'
                      )}>
                        {event.surprise > 0 ? '\u2191' : '\u2193'} {Math.abs(event.surprise)}% {event.surprise > 0 ? 'BEAT' : 'MISS'}
                      </div>
                    )}
                    {/* AI prediction inline */}
                    {data.aiPredictions?.[event.ticker] && !event.epsActual && (
                      <div className="mt-2 text-xs text-jarvis-accent/80 italic border-t border-jarvis-gray-800/50 pt-2">
                        {data.aiPredictions[event.ticker]}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
