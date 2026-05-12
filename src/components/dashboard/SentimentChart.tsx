'use client';

import { AnalysisReport } from '@/lib/types';
import { cn, getSentimentColor, formatPercent, formatPrice } from '@/lib/utils';
import { BarChart2, PieChart } from 'lucide-react';

interface SentimentChartProps {
  report: AnalysisReport;
}

export default function SentimentChart({ report }: SentimentChartProps) {
  const allStocks = [...report.topBullish, ...report.topBearish];
  const bullishCount = report.topBullish.length;
  const bearishCount = report.topBearish.length;
  const total = allStocks.length || 1;

  return (
    <div className="glass-panel p-4">
      <div className="flex items-center gap-2 mb-4">
        <PieChart className="w-4 h-4 text-jarvis-accent" />
        <h3 className="section-title">Sentiment Distribution</h3>
      </div>

      {/* Visual sentiment bar */}
      <div className="mb-4">
        <div className="h-3 rounded-full overflow-hidden flex bg-jarvis-gray-800">
          <div
            className="bg-gradient-to-r from-jarvis-green to-jarvis-green-dim transition-all duration-1000"
            style={{ width: `${(bullishCount / total) * 100}%` }}
          />
          <div
            className="bg-gradient-to-r from-jarvis-red-dim to-jarvis-red transition-all duration-1000"
            style={{ width: `${(bearishCount / total) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-jarvis-green" />
            <span className="text-xs font-mono text-jarvis-gray-400">
              Bullish {bullishCount} ({((bullishCount / total) * 100).toFixed(0)}%)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-jarvis-red" />
            <span className="text-xs font-mono text-jarvis-gray-400">
              Bearish {bearishCount} ({((bearishCount / total) * 100).toFixed(0)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Mini signal bars */}
      <div className="space-y-1.5">
        {allStocks
          .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
          .slice(0, 8)
          .map(stock => {
            const isUp = stock.direction === 'up';
            const barWidth = Math.min(Math.abs(stock.priceChangePercent) * 12, 100);

            return (
              <div key={stock.ticker} className="flex items-center gap-2">
                <span className="text-xs font-mono text-jarvis-gray-400 w-10 text-right">
                  {stock.ticker}
                </span>
                <div className="flex-1 h-1.5 bg-jarvis-gray-800/50 rounded-full overflow-hidden">
                  {isUp ? (
                    <div
                      className="h-full bg-jarvis-green/70 rounded-full transition-all duration-1000"
                      style={{ width: `${barWidth}%` }}
                    />
                  ) : (
                    <div className="h-full flex justify-end">
                      <div
                        className="h-full bg-jarvis-red/70 rounded-full transition-all duration-1000"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  )}
                </div>
                <span className={cn(
                  'text-xs font-mono w-14 text-right',
                  isUp ? 'text-jarvis-green' : 'text-jarvis-red'
                )}>
                  {formatPercent(stock.priceChangePercent)}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}
