'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import { Bell, Plus, Trash2, Check, AlertTriangle, TrendingUp, TrendingDown, MessageCircle, BellRing } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export interface AlertRule {
  id: string;
  ticker: string;
  condition: 'price_above' | 'price_below' | 'change_above' | 'change_below' | 'sentiment_shift';
  value: number;
  label: string;
  enabled: boolean;
  triggered: boolean;
  triggeredAt?: string;
  createdAt: string;
}

const CONDITION_LABELS: Record<string, { en: string; zh: string; icon: typeof TrendingUp }> = {
  price_above: { en: 'Price Above', zh: '\u50F9\u683C\u9AD8\u65BC', icon: TrendingUp },
  price_below: { en: 'Price Below', zh: '\u50F9\u683C\u4F4E\u65BC', icon: TrendingDown },
  change_above: { en: 'Day Change Above %', zh: '\u65E5\u6F32\u5E45\u8D85\u904E%', icon: TrendingUp },
  change_below: { en: 'Day Change Below %', zh: '\u65E5\u8DCC\u5E45\u8D85\u904E%', icon: TrendingDown },
  sentiment_shift: { en: 'Sentiment Shift', zh: '\u60C5\u7DD2\u8B8A\u5316', icon: MessageCircle },
};

export default function AlertsPanel() {
  const { locale } = useI18n();
  const [alerts, setAlerts] = useState<AlertRule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formTicker, setFormTicker] = useState('');
  const [formCondition, setFormCondition] = useState<AlertRule['condition']>('price_above');
  const [formValue, setFormValue] = useState('');
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('alerts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (data) {
        setAlerts(data.map((r: any) => {
          const condLabel = CONDITION_LABELS[r.condition];
          return {
            id: r.id,
            ticker: r.ticker,
            condition: r.condition,
            value: Number(r.value),
            label: `${r.ticker} ${condLabel?.[locale === 'zh' ? 'zh' : 'en'] || r.condition} ${r.value}`,
            enabled: r.enabled,
            triggered: r.triggered,
            createdAt: r.created_at,
          };
        }));
      }
    }
    load();
  }, [supabase, locale]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Check alerts against real prices every 2 minutes
  const triggeredRef = useRef(new Set<string>());
  useEffect(() => {
    if (alerts.length === 0) return;
    const checkAlerts = async () => {
      const active = alerts.filter(a => a.enabled && !a.triggered);
      if (active.length === 0) return;
      const tickers = [...new Set(active.map(a => a.ticker))];
      try {
        const res = await fetch(`/api/quotes?tickers=${tickers.join(',')}`);
        const json = await res.json();
        if (!json.success) return;
        const prices: Record<string, { price: number; change: number; changePercent: number }> = json.data;

        for (const alert of active) {
          const q = prices[alert.ticker];
          if (!q || triggeredRef.current.has(alert.id)) continue;
          let triggered = false;
          if (alert.condition === 'price_above' && q.price >= alert.value) triggered = true;
          if (alert.condition === 'price_below' && q.price <= alert.value) triggered = true;
          if (alert.condition === 'change_above' && q.changePercent >= alert.value) triggered = true;
          if (alert.condition === 'change_below' && q.changePercent <= -alert.value) triggered = true;

          if (triggered) {
            triggeredRef.current.add(alert.id);
            // Update in DB
            await supabase.from('alerts').update({ triggered: true, triggered_at: new Date().toISOString() }).eq('id', alert.id);
            setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, triggered: true, triggeredAt: new Date().toISOString() } : a));

            // Browser notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`🔔 Alert: ${alert.ticker}`, {
                body: `${alert.label} — Current: $${q.price.toFixed(2)} (${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%)`,
                icon: '/icon-192.svg',
              });
            }
          }
        }
      } catch { /* silent */ }
    };
    checkAlerts();
    const interval = setInterval(checkAlerts, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [alerts, supabase]);

  const addAlert = async () => {
    if (!formTicker.trim() || !formValue.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const condLabel = CONDITION_LABELS[formCondition];
    const label = `${formTicker.toUpperCase()} ${condLabel[locale === 'zh' ? 'zh' : 'en']} ${formValue}`;

    const { data, error } = await supabase.from('alerts').insert({
      user_id: user.id,
      ticker: formTicker.toUpperCase(),
      condition: formCondition,
      value: parseFloat(formValue),
      enabled: true,
      triggered: false,
    }).select().single();

    if (!error && data) {
      setAlerts(prev => [{
        id: data.id,
        ticker: data.ticker,
        condition: data.condition,
        value: Number(data.value),
        label,
        enabled: true,
        triggered: false,
        createdAt: data.created_at,
      }, ...prev]);
    }
    setFormTicker('');
    setFormValue('');
    setShowForm(false);
  };

  const removeAlert = async (id: string) => {
    await supabase.from('alerts').delete().eq('id', id);
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const toggleAlert = async (id: string) => {
    const alert = alerts.find(a => a.id === id);
    if (!alert) return;
    await supabase.from('alerts').update({ enabled: !alert.enabled }).eq('id', id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
  };

  const activeAlerts = alerts.filter(a => a.enabled && !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered);

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-jarvis-accent" />
          <h2 className="text-lg font-semibold text-jarvis-white">
            {locale === 'zh' ? '\u667A\u80FD\u8B66\u5831' : 'Smart Alerts'}
          </h2>
          <span className="text-xs font-mono text-jarvis-gray-500">
            {activeAlerts.length} {locale === 'zh' ? '\u500B\u6D3B\u8E8D' : 'active'}
          </span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-1.5 rounded-lg bg-jarvis-accent/20 text-jarvis-accent border border-jarvis-accent/30 hover:bg-jarvis-accent/30 transition-all text-xs font-mono flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          {locale === 'zh' ? '\u65B0\u589E\u8B66\u5831' : 'New Alert'}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="glass-panel p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              value={formTicker}
              onChange={e => setFormTicker(e.target.value.toUpperCase())}
              placeholder={locale === 'zh' ? '\u80A1\u7968\u4EE3\u78BC' : 'Ticker'}
              className="bg-jarvis-gray-900/50 border border-jarvis-gray-700/50 rounded-lg px-3 py-2 text-sm font-mono text-jarvis-white placeholder-jarvis-gray-600 focus:outline-none focus:border-jarvis-accent/50"
            />
            <select
              value={formCondition}
              onChange={e => setFormCondition(e.target.value as AlertRule['condition'])}
              className="bg-jarvis-gray-900/50 border border-jarvis-gray-700/50 rounded-lg px-3 py-2 text-sm text-jarvis-white focus:outline-none focus:border-jarvis-accent/50"
            >
              {Object.entries(CONDITION_LABELS).map(([key, val]) => (
                <option key={key} value={key}>{locale === 'zh' ? val.zh : val.en}</option>
              ))}
            </select>
            <input
              type="number"
              value={formValue}
              onChange={e => setFormValue(e.target.value)}
              placeholder={locale === 'zh' ? '\u6578\u503C' : 'Value'}
              className="bg-jarvis-gray-900/50 border border-jarvis-gray-700/50 rounded-lg px-3 py-2 text-sm font-mono text-jarvis-white placeholder-jarvis-gray-600 focus:outline-none focus:border-jarvis-accent/50"
            />
            <button
              onClick={addAlert}
              disabled={!formTicker.trim() || !formValue.trim()}
              className="px-4 py-2 rounded-lg bg-jarvis-accent/20 text-jarvis-accent border border-jarvis-accent/30 hover:bg-jarvis-accent/30 transition-all text-sm font-mono disabled:opacity-40"
            >
              {locale === 'zh' ? '\u5EFA\u7ACB' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Active Alerts */}
      {alerts.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-12 h-12 text-jarvis-gray-700 mx-auto mb-4" />
          <p className="text-jarvis-gray-500 text-sm">
            {locale === 'zh' ? '\u5C1A\u672A\u8A2D\u5B9A\u4EFB\u4F55\u8B66\u5831' : 'No alerts configured yet'}
          </p>
          <p className="text-jarvis-gray-600 text-xs mt-1">
            {locale === 'zh' ? '\u8A2D\u5B9A\u50F9\u683C\u3001\u6F32\u8DCC\u5E45\u6216\u60C5\u7DD2\u8B8A\u5316\u7684\u63D0\u9192' : 'Set up price, change, or sentiment alerts'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(alert => {
            const condConfig = CONDITION_LABELS[alert.condition];
            const Icon = condConfig?.icon || Bell;
            return (
              <div
                key={alert.id}
                className={cn(
                  'glass-panel p-3 flex items-center justify-between transition-all',
                  alert.triggered && 'border-jarvis-amber/30 bg-jarvis-amber/5',
                  !alert.enabled && 'opacity-50',
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn('w-4 h-4',
                    alert.triggered ? 'text-jarvis-amber' :
                    alert.condition.includes('above') ? 'text-jarvis-green' : 'text-jarvis-red'
                  )} />
                  <div>
                    <span className="text-sm font-mono text-jarvis-white">{alert.ticker}</span>
                    <span className="text-sm text-jarvis-gray-400 ml-2">{alert.label}</span>
                  </div>
                  {alert.triggered && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-jarvis-amber/10 text-jarvis-amber border border-jarvis-amber/20 font-mono flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      {locale === 'zh' ? '\u5DF2\u89F8\u767C' : 'TRIGGERED'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAlert(alert.id)}
                    className={cn('p-1.5 rounded transition-all',
                      alert.enabled ? 'text-jarvis-green hover:bg-jarvis-green/10' : 'text-jarvis-gray-600 hover:bg-jarvis-gray-800'
                    )}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => removeAlert(alert.id)}
                    className="p-1.5 rounded text-jarvis-gray-600 hover:text-jarvis-red hover:bg-jarvis-red/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
