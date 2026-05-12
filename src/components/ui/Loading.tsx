'use client';

import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

export default function LoadingSpinner({ size = 'md', message }: LoadingSpinnerProps) {
  const sizeMap = { sm: 'w-6 h-6', md: 'w-10 h-10', lg: 'w-16 h-16' };

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <div className="relative">
        {/* Outer ring */}
        <div className={cn(
          sizeMap[size],
          'rounded-full border-2 border-jarvis-gray-800 border-t-jarvis-accent animate-spin'
        )} />
        {/* Inner glow */}
        <div className={cn(
          'absolute inset-2 rounded-full bg-jarvis-accent/5'
        )} />
      </div>
      {message && (
        <div className="text-center">
          <p className="text-sm text-jarvis-gray-400 font-mono animate-pulse">{message}</p>
          <div className="flex items-center justify-center gap-1 mt-2">
            <div className="w-1 h-1 bg-jarvis-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1 h-1 bg-jarvis-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1 h-1 bg-jarvis-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      )}
    </div>
  );
}

export function FullPageLoader() {
  return (
    <div className="min-h-screen bg-jarvis-black flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full border-2 border-jarvis-gray-800 border-t-jarvis-accent animate-spin" />
          <div className="absolute inset-3 rounded-full border border-jarvis-gray-800 border-b-jarvis-green animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
          <div className="absolute inset-6 rounded-full bg-jarvis-accent/10 animate-pulse" />
        </div>
        <h2 className="text-lg font-semibold text-jarvis-white mb-2 font-mono">
          JARVIS<span className="text-jarvis-accent">.</span>Finance
        </h2>
        <p className="text-sm text-jarvis-gray-500 font-mono animate-pulse">
          Initializing market analysis...
        </p>
        <div className="mt-4 space-y-1.5 text-left max-w-xs mx-auto">
          <LoadingStep label="Scanning Reddit" delay={0} />
          <LoadingStep label="Analyzing X/Twitter" delay={300} />
          <LoadingStep label="Processing financial news" delay={600} />
          <LoadingStep label="Generating signals" delay={900} />
        </div>
      </div>
    </div>
  );
}

function LoadingStep({ label, delay }: { label: string; delay: number }) {
  return (
    <div
      className="flex items-center gap-2 animate-fade-in"
      style={{ animationDelay: `${delay}ms`, animationFillMode: 'backwards' }}
    >
      <div className="w-1 h-1 bg-jarvis-accent rounded-full animate-pulse" />
      <span className="text-sm font-mono text-jarvis-gray-500">{label}</span>
    </div>
  );
}
