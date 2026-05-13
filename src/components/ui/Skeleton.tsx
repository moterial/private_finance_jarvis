'use client';

import { cn } from '@/lib/utils';

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn('animate-shimmer rounded-lg bg-jarvis-gray-800/50', className)} />
  );
}

export function PanelSkeleton() {
  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Shimmer className="w-9 h-9 rounded-xl" />
        <Shimmer className="h-5 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="glass-panel p-4 space-y-3" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="flex items-center justify-between">
              <Shimmer className="h-4 w-20" />
              <Shimmer className="h-4 w-12" />
            </div>
            <Shimmer className="h-6 w-28" />
            <Shimmer className="h-3 w-full" />
            <Shimmer className="h-3 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="glass-panel p-4 space-y-3 animate-fade-in">
      <div className="flex items-center gap-3">
        <Shimmer className="w-8 h-8 rounded-lg" />
        <div className="space-y-1.5 flex-1">
          <Shimmer className="h-4 w-16" />
          <Shimmer className="h-3 w-24" />
        </div>
        <div className="space-y-1.5 text-right">
          <Shimmer className="h-4 w-14 ml-auto" />
          <Shimmer className="h-3 w-10 ml-auto" />
        </div>
      </div>
      <Shimmer className="h-1 w-full rounded-full" />
      <div className="flex gap-3">
        <Shimmer className="h-3 w-8" />
        <Shimmer className="h-3 w-8" />
        <Shimmer className="h-3 w-8" />
      </div>
    </div>
  );
}
