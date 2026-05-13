'use client';

import { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import { Calendar, AlertTriangle } from 'lucide-react';

interface EconEvent {
  date: string;
  event: string;
  importance: 'high' | 'medium' | 'low';
  actual?: string;
  forecast?: string;
  previous?: string;
}

export default function EconomicCalendar() {
  const { locale } = useI18n();
  const [events, setEvents] = useState<EconEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/economic-calendar')
      .then(r => r.json())
      .then(json => { if (json.success) setEvents(json.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (d: string) => {
    const date = new Date(d + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = Math.floor((date.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return locale === 'zh' ? '今天' : 'Today';
    if (diff === 1) return locale === 'zh' ? '明天' : 'Tomorrow';
    return date.toLocaleDateString(locale === 'zh' ? 'zh-TW' : 'en-US', { month: 'short', day: 'numeric', weekday: 'short' });
  };

  if (loading) {
    return (
      <div className="bg-gray-800/50 rounded-lg p-4 animate-pulse">
        <div className="h-32 bg-gray-700/50 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="w-4 h-4 text-yellow-400" />
        <h3 className="text-sm font-medium text-gray-200">
          {locale === 'zh' ? '經濟日曆' : 'Economic Calendar'}
        </h3>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-gray-500">{locale === 'zh' ? '暫無即將到來的事件' : 'No upcoming events'}</p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {events.slice(0, 12).map((e, i) => (
            <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-gray-700/50 last:border-0">
              <span className={cn(
                'w-1.5 h-1.5 rounded-full shrink-0',
                e.importance === 'high' ? 'bg-red-500' : e.importance === 'medium' ? 'bg-yellow-500' : 'bg-gray-500'
              )} />
              <span className="text-gray-400 w-20 shrink-0">{formatDate(e.date)}</span>
              <span className="text-gray-200 truncate flex-1">{e.event}</span>
              {e.importance === 'high' && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
