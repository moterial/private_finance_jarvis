'use client';

import { AnalysisReport } from '@/lib/types';
import { cn, getSentimentColor } from '@/lib/utils';
import { Brain, AlertTriangle, Lightbulb, Shield, Zap } from 'lucide-react';

interface AnalysisPanelProps {
  report: AnalysisReport;
}

export default function AnalysisPanel({ report }: AnalysisPanelProps) {
  const riskColors: Record<string, string> = {
    low: 'text-jarvis-green',
    medium: 'text-jarvis-yellow',
    high: 'text-jarvis-red',
    extreme: 'text-jarvis-red neon-text-red',
  };

  const riskBg: Record<string, string> = {
    low: 'bg-jarvis-green/10 border-jarvis-green/20',
    medium: 'bg-jarvis-yellow/10 border-jarvis-yellow/20',
    high: 'bg-jarvis-red/10 border-jarvis-red/20',
    extreme: 'bg-jarvis-red/20 border-jarvis-red/30',
  };

  return (
    <div className="glass-panel p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-jarvis-accent" />
          <h3 className="section-title">AI Analysis</h3>
        </div>
        <span className="text-xs font-mono text-jarvis-gray-600">
          {new Date(report.generatedAt).toLocaleTimeString()}
        </span>
      </div>

      {/* Market Sentiment Gauge */}
      <div className="p-3 rounded-lg bg-jarvis-darker/80 border border-jarvis-gray-800/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-jarvis-gray-400">Market Sentiment</span>
          <span className={cn(
            'text-sm font-bold font-mono uppercase',
            getSentimentColor(report.marketSentiment)
          )}>
            {report.marketSentiment}
          </span>
        </div>
        <div className="h-2 bg-jarvis-gray-800 rounded-full overflow-hidden relative">
          <div className="absolute inset-0 flex">
            <div className="flex-1 bg-gradient-to-r from-jarvis-red to-jarvis-red/50" />
            <div className="flex-1 bg-gradient-to-r from-jarvis-yellow/50 to-jarvis-yellow/50" />
            <div className="flex-1 bg-gradient-to-r from-jarvis-green/50 to-jarvis-green" />
          </div>
          <div
            className="absolute top-0 w-1 h-full bg-jarvis-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all duration-1000"
            style={{ left: `${((report.marketSentimentScore + 1) / 2) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[8px] font-mono text-jarvis-gray-600">BEARISH</span>
          <span className="text-[8px] font-mono text-jarvis-gray-600">NEUTRAL</span>
          <span className="text-[8px] font-mono text-jarvis-gray-600">BULLISH</span>
        </div>
      </div>

      {/* Risk Level */}
      <div className={cn('p-3 rounded-lg border', riskBg[report.riskLevel])}>
        <div className="flex items-center gap-2">
          <Shield className={cn('w-4 h-4', riskColors[report.riskLevel])} />
          <span className="text-xs text-jarvis-gray-300">Risk Level</span>
          <span className={cn('font-mono text-sm font-bold uppercase ml-auto', riskColors[report.riskLevel])}>
            {report.riskLevel}
          </span>
        </div>
      </div>

      {/* Key Insights */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Lightbulb className="w-3.5 h-3.5 text-jarvis-yellow" />
          <span className="text-xs font-semibold text-jarvis-gray-300 uppercase tracking-wider">Key Insights</span>
        </div>
        <div className="space-y-2">
          {report.keyInsights.map((insight, i) => (
            <div
              key={i}
              className="flex items-start gap-2 text-xs text-jarvis-gray-400 leading-relaxed animate-fade-in"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <Zap className="w-3 h-3 text-jarvis-accent mt-0.5 flex-shrink-0" />
              <span>{insight}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Data Source Status */}
      <div className="p-3 rounded-lg bg-jarvis-darker/50 border border-jarvis-gray-800/30">
        <span className="text-xs uppercase tracking-wider text-jarvis-gray-500 block mb-2">Data Sources</span>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(report.dataSourceStatus).map(([source, active]) => (
            <div key={source} className="flex items-center gap-1.5">
              <div className={cn(
                'w-1.5 h-1.5 rounded-full',
                active ? 'bg-jarvis-green animate-pulse-slow' : 'bg-jarvis-gray-600'
              )} />
              <span className="text-xs font-mono text-jarvis-gray-400 capitalize">{source}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-2 rounded bg-jarvis-gray-900/50 border border-jarvis-gray-800/20">
        <AlertTriangle className="w-3 h-3 text-jarvis-yellow/60 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-jarvis-gray-600 leading-relaxed">
          Analysis based on social media sentiment and news. Not financial advice. Always do your own research before making investment decisions.
        </p>
      </div>
    </div>
  );
}
