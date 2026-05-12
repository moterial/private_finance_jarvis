'use client';

import { CandleData, TechnicalReport } from '@/lib/types/extended';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { useMemo } from 'react';

interface CandlestickChartProps {
  candles: CandleData[];
  report?: TechnicalReport;
  height?: number;
}

export default function CandlestickChart({ candles, report, height = 280 }: CandlestickChartProps) {
  const { t } = useI18n();

  const chartData = useMemo(() => {
    if (candles.length === 0) return null;

    const displayCandles = candles.slice(-40);
    const allHighs = displayCandles.map(c => c.high);
    const allLows = displayCandles.map(c => c.low);
    const maxPrice = Math.max(...allHighs);
    const minPrice = Math.min(...allLows);
    const priceRange = maxPrice - minPrice || 1;
    const padding = priceRange * 0.05;
    const chartMax = maxPrice + padding;
    const chartMin = minPrice - padding;
    const chartRange = chartMax - chartMin;

    const candleWidth = Math.max(4, Math.floor((100 / displayCandles.length) * 0.6));
    const gap = Math.max(1, Math.floor((100 / displayCandles.length) * 0.4));

    return { displayCandles, chartMax, chartMin, chartRange, candleWidth, gap };
  }, [candles]);

  if (!chartData) return <div className="text-xs text-jarvis-gray-600 text-center py-8">No data</div>;

  const { displayCandles, chartMax, chartMin, chartRange, candleWidth, gap } = chartData;
  const svgWidth = 600;
  const svgHeight = height;
  const chartPadLeft = 60;
  const chartPadRight = 10;
  const chartPadTop = 10;
  const chartPadBottom = 25;
  const plotWidth = svgWidth - chartPadLeft - chartPadRight;
  const plotHeight = svgHeight - chartPadTop - chartPadBottom;

  const priceToY = (price: number) => chartPadTop + plotHeight * (1 - (price - chartMin) / chartRange);
  const indexToX = (i: number) => chartPadLeft + (i / displayCandles.length) * plotWidth + plotWidth / displayCandles.length / 2;
  const barW = Math.max(2, plotWidth / displayCandles.length * 0.6);

  // Price gridlines
  const gridLines = 5;
  const gridPrices = Array.from({ length: gridLines }, (_, i) => chartMin + (chartRange * i) / (gridLines - 1));

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full"
        style={{ height: `${height}px` }}
      >
        {/* Grid lines */}
        {gridPrices.map((price, i) => (
          <g key={i}>
            <line
              x1={chartPadLeft} y1={priceToY(price)}
              x2={svgWidth - chartPadRight} y2={priceToY(price)}
              stroke="rgba(255,255,255,0.04)" strokeWidth={1}
            />
            <text
              x={chartPadLeft - 5} y={priceToY(price) + 3}
              textAnchor="end" fill="#4a4a4a" fontSize={9} fontFamily="monospace"
            >
              ${price.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Support levels */}
        {report?.supportLevels.slice(0, 2).map((level, i) => {
          if (level < chartMin || level > chartMax) return null;
          return (
            <g key={`sup-${i}`}>
              <line
                x1={chartPadLeft} y1={priceToY(level)}
                x2={svgWidth - chartPadRight} y2={priceToY(level)}
                stroke="rgba(0,255,136,0.3)" strokeWidth={1} strokeDasharray="4,3"
              />
              <text
                x={svgWidth - chartPadRight + 2} y={priceToY(level) + 3}
                fill="#00ff88" fontSize={7} fontFamily="monospace" opacity={0.7}
              >
                S
              </text>
            </g>
          );
        })}

        {/* Resistance levels */}
        {report?.resistanceLevels.slice(0, 2).map((level, i) => {
          if (level < chartMin || level > chartMax) return null;
          return (
            <g key={`res-${i}`}>
              <line
                x1={chartPadLeft} y1={priceToY(level)}
                x2={svgWidth - chartPadRight} y2={priceToY(level)}
                stroke="rgba(255,51,102,0.3)" strokeWidth={1} strokeDasharray="4,3"
              />
              <text
                x={svgWidth - chartPadRight + 2} y={priceToY(level) + 3}
                fill="#ff3366" fontSize={7} fontFamily="monospace" opacity={0.7}
              >
                R
              </text>
            </g>
          );
        })}

        {/* Entry zone */}
        {report?.entryZone && (
          <rect
            x={chartPadLeft}
            y={priceToY(report.entryZone.high)}
            width={plotWidth}
            height={priceToY(report.entryZone.low) - priceToY(report.entryZone.high)}
            fill={report.recommendation === 'buy' ? 'rgba(0,255,136,0.06)' : 'rgba(255,51,102,0.06)'}
          />
        )}

        {/* Candlesticks */}
        {displayCandles.map((candle, i) => {
          const isGreen = candle.close >= candle.open;
          const x = indexToX(i);
          const bodyTop = priceToY(Math.max(candle.open, candle.close));
          const bodyBottom = priceToY(Math.min(candle.open, candle.close));
          const bodyHeight = Math.max(1, bodyBottom - bodyTop);

          return (
            <g key={i}>
              {/* Wick */}
              <line
                x1={x} y1={priceToY(candle.high)}
                x2={x} y2={priceToY(candle.low)}
                stroke={isGreen ? '#00ff88' : '#ff3366'}
                strokeWidth={1}
                opacity={0.6}
              />
              {/* Body */}
              <rect
                x={x - barW / 2}
                y={bodyTop}
                width={barW}
                height={bodyHeight}
                fill={isGreen ? '#00ff88' : '#ff3366'}
                opacity={isGreen ? 0.8 : 0.8}
                rx={0.5}
              />
            </g>
          );
        })}

        {/* Volume bars at bottom */}
        {displayCandles.map((candle, i) => {
          const x = indexToX(i);
          const maxVol = Math.max(...displayCandles.map(c => c.volume));
          const volHeight = (candle.volume / maxVol) * 20;
          const isGreen = candle.close >= candle.open;

          return (
            <rect
              key={`vol-${i}`}
              x={x - barW / 2}
              y={svgHeight - chartPadBottom - volHeight}
              width={barW}
              height={volHeight}
              fill={isGreen ? 'rgba(0,255,136,0.15)' : 'rgba(255,51,102,0.15)'}
              rx={0.5}
            />
          );
        })}

        {/* Date labels */}
        {displayCandles.filter((_, i) => i % Math.ceil(displayCandles.length / 5) === 0).map((candle, i) => {
          const idx = displayCandles.indexOf(candle);
          return (
            <text
              key={`date-${i}`}
              x={indexToX(idx)}
              y={svgHeight - 5}
              textAnchor="middle" fill="#3a3a3a" fontSize={8} fontFamily="monospace"
            >
              {candle.date.slice(5)}
            </text>
          );
        })}
      </svg>

      {/* Signal badges */}
      {report && report.priceActionSignals.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {report.priceActionSignals.slice(0, 3).map((sig, i) => (
            <span
              key={i}
              className={cn(
                'text-xs font-mono px-1.5 py-0.5 rounded border',
                sig.direction === 'bullish'
                  ? 'bg-jarvis-green/10 text-jarvis-green border-jarvis-green/20'
                  : 'bg-jarvis-red/10 text-jarvis-red border-jarvis-red/20'
              )}
            >
              {sig.pattern}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
