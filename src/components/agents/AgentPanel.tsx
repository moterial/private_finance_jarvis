'use client';

import { AgentState, AgentFinding, ExpertSummary, ChainReaction } from '@/lib/types/extended';
import { useI18n } from '@/lib/i18n/context';
import { cn, timeAgo, getSentimentColor } from '@/lib/utils';
import {
  Brain, Newspaper, Users, BarChart2, Link2, Zap, Shield,
  AlertTriangle, TrendingUp, TrendingDown, Target, ChevronDown, ChevronUp,
  ArrowRight, Cpu, Eye,
} from 'lucide-react';
import { useState } from 'react';

interface AgentPanelProps {
  agentStates: AgentState[];
  expertSummary: ExpertSummary;
  findings: AgentFinding[];
  chainReactions: ChainReaction[];
}

const AGENT_ICONS: Record<string, typeof Brain> = {
  news: Newspaper,
  social: Users,
  technical: BarChart2,
  supplyChain: Link2,
  expert: Brain,
};

const AGENT_COLORS: Record<string, string> = {
  news: 'text-jarvis-accent',
  social: 'text-orange-400',
  technical: 'text-jarvis-yellow',
  supplyChain: 'text-purple-400',
  expert: 'text-jarvis-green',
};

export default function AgentPanel({ agentStates, expertSummary, findings, chainReactions }: AgentPanelProps) {
  const { t } = useI18n();
  const [expandedAgent, setExpandedAgent] = useState<string | null>('expert');
  const [showAllFindings, setShowAllFindings] = useState(false);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Agent Status Grid */}
      <div>
        <h2 className="section-title mb-3">{t('agents.orchestrator')}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {agentStates.map(agent => {
            const Icon = AGENT_ICONS[agent.id] || Cpu;
            const color = AGENT_COLORS[agent.id] || 'text-jarvis-gray-400';
            return (
              <button
                key={agent.id}
                onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                className={cn(
                  'stat-card text-left transition-all',
                  expandedAgent === agent.id && 'ring-1 ring-jarvis-accent/30'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon className={cn('w-4 h-4', color)} />
                  <div className="flex items-center gap-1">
                    <div className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      agent.status === 'active' ? 'bg-jarvis-green animate-pulse-slow' :
                      agent.status === 'processing' ? 'bg-jarvis-yellow animate-pulse' :
                      agent.status === 'error' ? 'bg-jarvis-red' : 'bg-jarvis-gray-600'
                    )} />
                    <span className="text-[8px] font-mono text-jarvis-gray-500 uppercase">
                      {agent.status === 'active' ? t('agents.status.active') :
                       agent.status === 'processing' ? t('agents.status.processing') :
                       t('agents.status.idle')}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-jarvis-gray-300 block">{agent.name}</span>
                <span className="text-xs font-mono text-jarvis-gray-600">
                  {agent.findings.length} findings
                  {agent.processingTime ? ` · ${agent.processingTime}ms` : ''}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Expanded Agent Findings */}
      {expandedAgent && (
        <div className="glass-panel p-4 animate-slide-up">
          <h3 className="section-title mb-3">
            {agentStates.find(a => a.id === expandedAgent)?.name} — Findings
          </h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {findings.filter(f => f.agentId === expandedAgent).map(finding => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
            {findings.filter(f => f.agentId === expandedAgent).length === 0 && (
              <p className="text-xs text-jarvis-gray-600 text-center py-4">No findings from this agent</p>
            )}
          </div>
        </div>
      )}

      {/* Expert Summary */}
      <div className="glass-panel p-6">
        <div className="flex items-center gap-3 mb-5 pb-4 border-b border-jarvis-gray-800/50">
          <div className="p-2 rounded-lg bg-jarvis-green/10 border border-jarvis-green/20">
            <Brain className="w-5 h-5 text-jarvis-green" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-jarvis-white">{t('agents.expertSummary')}</h2>
            <span className="text-xs font-mono text-jarvis-gray-500">{expertSummary.generatedAt ? new Date(expertSummary.generatedAt).toLocaleString() : ''}</span>
          </div>
          <span className={cn(
            'text-xs font-mono uppercase px-3 py-1 rounded-full border ml-auto',
            expertSummary.overallOutlook === 'bullish' ? 'bg-jarvis-green/10 text-jarvis-green border-jarvis-green/20' :
            expertSummary.overallOutlook === 'bearish' ? 'bg-jarvis-red/10 text-jarvis-red border-jarvis-red/20' :
            expertSummary.overallOutlook === 'cautious' ? 'bg-jarvis-yellow/10 text-jarvis-yellow border-jarvis-yellow/20' :
            'bg-jarvis-gray-800 text-jarvis-gray-400 border-jarvis-gray-700'
          )}>
            {expertSummary.overallOutlook} {"\u2022"} {expertSummary.marketPhase}
          </span>
        </div>

        {/* Narrative */}
        <div className="mb-5 p-4 rounded-lg bg-jarvis-darker/40 border border-jarvis-gray-800/30">
          <div className="text-sm text-jarvis-gray-200 leading-[1.8] space-y-3">
            {expertSummary.narrative.split(/\n+/).filter(p => p.trim()).map((para, i) => (
              <p key={i} className="first:mt-0">{para}</p>
            ))}
          </div>
        </div>

        {/* Top Picks */}
        {expertSummary.topPicks.length > 0 && (
          <div className="mb-5">
            <h4 className="text-xs uppercase tracking-wider text-jarvis-gray-500 mb-3 flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-jarvis-green" /> Top Picks
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {expertSummary.topPicks.slice(0, 6).map(pick => (
                <div key={pick.ticker} className={cn(
                  'p-3.5 rounded-lg border transition-all hover:scale-[1.01]',
                  pick.action.includes('buy') ? 'bg-jarvis-green/5 border-jarvis-green/15' :
                  pick.action.includes('sell') ? 'bg-jarvis-red/5 border-jarvis-red/15' :
                  'bg-jarvis-gray-800/30 border-jarvis-gray-700/30'
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-bold text-jarvis-white text-sm">{pick.ticker}</span>
                    <span className={cn(
                      'text-xs font-mono uppercase px-2 py-0.5 rounded',
                      pick.action.includes('buy') ? 'text-jarvis-green bg-jarvis-green/10' :
                      pick.action.includes('sell') ? 'text-jarvis-red bg-jarvis-red/10' : 'text-jarvis-yellow bg-jarvis-yellow/10'
                    )}>
                      {pick.action}
                    </span>
                  </div>
                  <p className="text-xs text-jarvis-gray-400 line-clamp-2 mb-2 leading-relaxed">{pick.reasoning}</p>
                  <div className="flex items-center gap-2 text-xs font-mono pt-2 border-t border-jarvis-gray-800/30">
                    <span className="text-jarvis-gray-500">Entry: ${pick.entryZone.low.toFixed(0)}-${pick.entryZone.high.toFixed(0)}</span>
                    <span className="text-jarvis-red">SL: ${pick.stopLoss.toFixed(0)}</span>
                    <span className="text-jarvis-green">T: ${pick.targets[0]?.toFixed(0)}</span>
                  </div>
                  <div className="mt-2">
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-1 bg-jarvis-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-jarvis-accent/60 rounded-full" style={{ width: `${pick.confidence}%` }} />
                      </div>
                      <span className="text-[10px] text-jarvis-gray-500 font-mono">{pick.confidence}%</span>
                    </div>
                    <span className="text-[10px] text-jarvis-gray-600 font-mono">{pick.timeframe}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Avoid list */}
        {expertSummary.avoidList.length > 0 && (
          <div className="mb-5">
            <h4 className="text-xs uppercase tracking-wider text-jarvis-gray-500 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-jarvis-red" /> Avoid / Caution
            </h4>
            <div className="flex flex-wrap gap-2">
              {expertSummary.avoidList.map(ticker => (
                <span key={ticker} className="text-xs font-mono px-3 py-1.5 rounded-lg bg-jarvis-red/10 text-jarvis-red border border-jarvis-red/20">
                  {ticker}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Sector Rotation */}
        <div className="mb-5">
          <h4 className="text-xs uppercase tracking-wider text-jarvis-gray-500 mb-3 flex items-center gap-2">
            <BarChart2 className="w-3.5 h-3.5 text-jarvis-accent" /> Sector Flow
          </h4>
          <div className="space-y-2.5 p-3 rounded-lg bg-jarvis-darker/30 border border-jarvis-gray-800/20">
            {expertSummary.sectorRotation.map(sr => (
              <div key={sr.sector} className="flex items-center gap-3">
                <span className="text-xs text-jarvis-gray-300 w-28 truncate font-medium">{sr.sector}</span>
                <div className="flex-1 h-2 bg-jarvis-gray-800 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      sr.direction === 'inflow' ? 'bg-gradient-to-r from-jarvis-green/40 to-jarvis-green/70' :
                      sr.direction === 'outflow' ? 'bg-gradient-to-r from-jarvis-red/40 to-jarvis-red/70' : 'bg-jarvis-gray-600'
                    )}
                    style={{ width: `${sr.strength}%` }}
                  />
                </div>
                <span className={cn(
                  'text-xs font-mono w-16 text-right',
                  sr.direction === 'inflow' ? 'text-jarvis-green' :
                  sr.direction === 'outflow' ? 'text-jarvis-red' : 'text-jarvis-gray-500'
                )}>
                  {sr.direction === 'inflow' ? '\u2191' : sr.direction === 'outflow' ? '\u2193' : '\u2022'} {sr.strength}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Chain Reactions */}
        {chainReactions.length > 0 && (
          <div className="mb-5">
            <h4 className="text-xs uppercase tracking-wider text-jarvis-gray-500 mb-3 flex items-center gap-2">
              <Link2 className="w-3.5 h-3.5 text-purple-400" /> {t('agents.chainAnalysis')}
            </h4>
            <div className="space-y-2.5">
              {chainReactions.slice(0, 4).map((cr, i) => (
                <div key={i} className="p-3 rounded-lg bg-jarvis-darker/30 border border-jarvis-gray-800/20">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono text-jarvis-accent font-bold px-2 py-0.5 rounded bg-jarvis-accent/10">{cr.triggerTicker}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-jarvis-gray-600" />
                    <div className="flex gap-1.5 flex-wrap">
                      {cr.impactedTickers.slice(0, 4).map(imp => (
                        <span key={imp.ticker} className={cn(
                          'text-xs font-mono px-1.5 py-0.5 rounded',
                          imp.impact === 'positive' ? 'text-jarvis-green bg-jarvis-green/10' : 'text-jarvis-red bg-jarvis-red/10'
                        )}>
                          {imp.impact === 'positive' ? '\u2191' : '\u2193'}{imp.ticker}
                        </span>
                      ))}
                    </div>
                    <span className="text-[10px] font-mono text-jarvis-gray-600 ml-auto px-1.5 py-0.5 rounded bg-jarvis-gray-800/50">{cr.confidence}%</span>
                  </div>
                  <p className="text-xs text-jarvis-gray-400 leading-relaxed">{cr.narrative}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Risks */}
        {expertSummary.keyRisks.length > 0 && (
          <div className="p-4 rounded-lg bg-jarvis-red/5 border border-jarvis-red/10">
            <h4 className="text-xs uppercase tracking-wider text-jarvis-red/70 mb-3 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" /> Key Risks
            </h4>
            <div className="space-y-2">
              {expertSummary.keyRisks.map((risk, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-jarvis-red/50 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-jarvis-gray-300 leading-relaxed">{risk}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* All Findings */}
      <div className="glass-panel p-4">
        <button
          onClick={() => setShowAllFindings(!showAllFindings)}
          className="flex items-center justify-between w-full"
        >
          <h3 className="section-title">All Agent Findings ({findings.length})</h3>
          {showAllFindings ? <ChevronUp className="w-4 h-4 text-jarvis-gray-500" /> : <ChevronDown className="w-4 h-4 text-jarvis-gray-500" />}
        </button>

        {showAllFindings && (
          <div className="space-y-2 mt-3 max-h-[400px] overflow-y-auto pr-1">
            {findings.sort((a, b) => {
              const severityOrder = { high: 0, medium: 1, low: 2 };
              return severityOrder[a.severity] - severityOrder[b.severity];
            }).map(finding => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FindingCard({ finding }: { finding: AgentFinding }) {
  const Icon = AGENT_ICONS[finding.agentId] || Cpu;
  const color = AGENT_COLORS[finding.agentId] || 'text-jarvis-gray-400';

  return (
    <div className={cn(
      'p-2.5 rounded-lg border bg-jarvis-darker/30',
      finding.severity === 'high' ? 'border-jarvis-accent/15' :
      finding.severity === 'medium' ? 'border-jarvis-gray-800/30' :
      'border-jarvis-gray-800/10'
    )}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('w-3 h-3', color)} />
        <span className={cn(
          'text-[8px] font-mono uppercase px-1 py-0.5 rounded',
          finding.severity === 'high' ? 'bg-jarvis-red/10 text-jarvis-red' :
          finding.severity === 'medium' ? 'bg-jarvis-yellow/10 text-jarvis-yellow' :
          'bg-jarvis-gray-800 text-jarvis-gray-500'
        )}>
          {finding.severity}
        </span>
        <span className="text-xs text-jarvis-gray-500 font-mono ml-auto">
          {finding.confidence}% · {finding.agentId}
        </span>
      </div>
      <h4 className="text-sm font-semibold text-jarvis-gray-300">{finding.title}</h4>
      <p className="text-xs text-jarvis-gray-500 line-clamp-2 mt-0.5">{finding.description}</p>
      {finding.tickers.length > 0 && (
        <div className="flex gap-1 mt-1.5">
          {finding.tickers.slice(0, 4).map(t => (
            <span key={t} className="text-[8px] font-mono px-1 py-0.5 rounded bg-jarvis-gray-800/50 text-jarvis-accent">${t}</span>
          ))}
        </div>
      )}
    </div>
  );
}
