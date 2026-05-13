'use client';

import { useI18n } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import { AlertTriangle, TrendingUp, TrendingDown, Volume2, MessageCircle, Zap, Activity } from 'lucide-react';

interface Anomaly {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  ticker: string;
  title: string;
  description: string;
  detectedAt: string;
  metrics: Record<string, number | string>;
  actionable: boolean;
}

const SEVERITY_CONFIG = {
  critical: { label: 'CRITICAL', bg: 'bg-jarvis-red/20', border: 'border-jarvis-red/40', text: 'text-jarvis-red', glow: 'shadow-jarvis-red/20' },
  high: { label: 'HIGH', bg: 'bg-jarvis-amber/15', border: 'border-jarvis-amber/30', text: 'text-jarvis-amber', glow: '' },
  medium: { label: 'MED', bg: 'bg-jarvis-blue/10', border: 'border-jarvis-blue/20', text: 'text-jarvis-blue', glow: '' },
  low: { label: 'LOW', bg: 'bg-jarvis-gray-800/50', border: 'border-jarvis-gray-700/30', text: 'text-jarvis-gray-500', glow: '' },
};

const TYPE_ICONS: Record<string, typeof AlertTriangle> = {
  volume_spike: Volume2,
  sentiment_divergence: Activity,
  social_surge: MessageCircle,
  price_gap: Zap,
  unusual_activity: AlertTriangle,
  put_call_skew: TrendingDown,
};

export default function AnomalyPanel({ anomalies }: { anomalies: Anomaly[] }) {
  const { locale } = useI18n();

  if (!anomalies || anomalies.length === 0) {
    return (
      <div className="text-center py-20">
        <AlertTriangle className="w-12 h-12 text-jarvis-gray-700 mx-auto mb-4" />
        <p className="text-jarvis-gray-500 text-sm">
          {locale === 'zh' ? '\u7576\u524D\u672A\u5075\u6E2C\u5230\u7570\u5E38' : 'No anomalies detected'}
        </p>
        <p className="text-jarvis-gray-600 text-xs mt-1">
          {locale === 'zh' ? '\u7CFB\u7D71\u6301\u7E8C\u76E3\u63A7\u4E2D...' : 'System is actively monitoring...'}
        </p>
      </div>
    );
  }

  const criticalCount = anomalies.filter(a => a.severity === 'critical').length;
  const highCount = anomalies.filter(a => a.severity === 'high').length;

  return (
    <div className="animate-fade-in space-y-4">
      {/* Summary Bar */}
      <div className="flex items-center gap-4 glass-panel p-3">
        <AlertTriangle className={cn('w-5 h-5', criticalCount > 0 ? 'text-jarvis-red animate-pulse' : 'text-jarvis-amber')} />
        <span className="text-sm font-mono text-jarvis-white">
          {anomalies.length} {locale === 'zh' ? '\u500B\u7570\u5E38\u5075\u6E2C\u5230' : 'anomalies detected'}
        </span>
        {criticalCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-jarvis-red/20 text-jarvis-red border border-jarvis-red/30 font-mono">
            {criticalCount} CRITICAL
          </span>
        )}
        {highCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded bg-jarvis-amber/15 text-jarvis-amber border border-jarvis-amber/25 font-mono">
            {highCount} HIGH
          </span>
        )}
      </div>

      {/* Anomaly Cards */}
      <div className="space-y-3">
        {anomalies.map(anomaly => {
          const severity = SEVERITY_CONFIG[anomaly.severity];
          const Icon = TYPE_ICONS[anomaly.type] || AlertTriangle;

          return (
            <div
              key={anomaly.id}
              className={cn(
                'glass-panel p-4 border-l-2 transition-all hover:border-l-4',
                severity.border,
                anomaly.severity === 'critical' && 'shadow-lg shadow-jarvis-red/5',
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className={cn('w-4 h-4', severity.text)} />
                  <span className="text-sm font-semibold text-jarvis-white">{anomaly.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs px-1.5 py-0.5 rounded font-mono', severity.bg, severity.text)}>
                    {severity.label}
                  </span>
                  {anomaly.actionable && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-jarvis-accent/10 text-jarvis-accent border border-jarvis-accent/20 font-mono">
                      {locale === 'zh' ? '\u53EF\u64CD\u4F5C' : 'ACTIONABLE'}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-jarvis-gray-400 mb-3">{anomaly.description}</p>
              <div className="flex items-center gap-4 text-xs font-mono text-jarvis-gray-600">
                {Object.entries(anomaly.metrics).slice(0, 4).map(([key, value]) => (
                  <span key={key}>
                    <span className="text-jarvis-gray-600">{key}: </span>
                    <span className="text-jarvis-gray-400">{typeof value === 'number' ? value.toLocaleString() : value}</span>
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
