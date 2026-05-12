'use client';

import { useRouter } from 'next/navigation';
import { Activity, ArrowRight, BarChart3, Brain, Globe, Zap, TrendingUp, Shield, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LandingPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-jarvis-black data-grid relative overflow-hidden">
      {/* Background effects */}
      <div className="fixed inset-0 bg-glow-radial pointer-events-none" />
      <div className="fixed top-1/4 -left-32 w-64 h-64 bg-jarvis-accent/5 rounded-full blur-[100px]" />
      <div className="fixed bottom-1/4 -right-32 w-64 h-64 bg-jarvis-green/5 rounded-full blur-[100px]" />

      {/* Nav */}
      <nav className="relative z-10 max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-jarvis-accent to-jarvis-accent-dim flex items-center justify-center">
            <Activity className="w-5 h-5 text-jarvis-black" />
          </div>
          <span className="text-lg font-semibold text-jarvis-white">
            JARVIS<span className="text-jarvis-accent">.</span>Finance
          </span>
        </div>
        <button
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-jarvis-accent/10 text-jarvis-accent border border-jarvis-accent/20 hover:bg-jarvis-accent/20 transition-all text-sm font-mono"
        >
          Launch Dashboard
          <ArrowRight className="w-4 h-4" />
        </button>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-20 pb-32 text-center">
        <div className="animate-fade-in">
          {/* Status badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-jarvis-gray-800 bg-jarvis-darker/80 mb-8">
            <div className="w-1.5 h-1.5 rounded-full bg-jarvis-green animate-pulse-slow" />
            <span className="text-sm font-mono text-jarvis-gray-400 uppercase tracking-wider">
              Real-time Market Intelligence Active
            </span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-jarvis-white leading-tight mb-6">
            Your AI-Powered
            <br />
            <span className="text-gradient">Market Analyst</span>
          </h1>

          <p className="text-lg text-jarvis-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Aggregating intelligence from Reddit, X/Twitter, and financial news to deliver
            real-time sentiment analysis and actionable stock signals.
          </p>

          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="group flex items-center gap-3 px-8 py-3.5 rounded-xl bg-gradient-to-r from-jarvis-accent to-jarvis-accent-dim text-jarvis-black font-semibold text-sm transition-all hover:shadow-[0_0_30px_rgba(0,212,255,0.3)] hover:scale-105"
            >
              <Zap className="w-4 h-4" />
              Enter Dashboard
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Floating Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-20 max-w-3xl mx-auto">
          {[
            { label: 'Data Sources', value: '3+', icon: Globe },
            { label: 'Stocks Tracked', value: '50+', icon: BarChart3 },
            { label: 'Real-time Updates', value: '24/7', icon: Radio },
            { label: 'AI Analysis', value: 'Live', icon: Brain },
          ].map((stat, i) => (
            <div
              key={stat.label}
              className={cn(
                'stat-card text-center animate-slide-up',
                i === 0 && 'animation-delay-0',
                i === 1 && 'animation-delay-200',
                i === 2 && 'animation-delay-400',
                i === 3 && 'animation-delay-600',
              )}
            >
              <stat.icon className="w-5 h-5 text-jarvis-accent mx-auto mb-2" />
              <div className="text-2xl font-bold font-mono text-jarvis-white">{stat.value}</div>
              <div className="text-xs font-mono text-jarvis-gray-500 uppercase tracking-wider mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pb-32">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-jarvis-white mb-3">
            Intelligence from Every Angle
          </h2>
          <p className="text-sm text-jarvis-gray-500 max-w-lg mx-auto">
            Multi-source data aggregation with AI-powered sentiment analysis
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: Globe,
              title: 'Multi-Source Intelligence',
              description: 'Scan Reddit (r/wallstreetbets, r/stocks), X/Twitter, and major financial news outlets simultaneously.',
              color: 'text-jarvis-accent',
              borderColor: 'border-jarvis-accent/10 hover:border-jarvis-accent/30',
            },
            {
              icon: Brain,
              title: 'AI Sentiment Analysis',
              description: 'Advanced NLP processes thousands of posts and articles to detect bullish/bearish sentiment patterns.',
              color: 'text-jarvis-green',
              borderColor: 'border-jarvis-green/10 hover:border-jarvis-green/30',
            },
            {
              icon: TrendingUp,
              title: 'Actionable Signals',
              description: 'Get ranked stock signals with confidence scores, signal strength, and detailed reasoning for each pick.',
              color: 'text-jarvis-yellow',
              borderColor: 'border-jarvis-yellow/10 hover:border-jarvis-yellow/30',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className={cn(
                'glass-panel-hover p-6 transition-all duration-300',
                feature.borderColor
              )}
            >
              <feature.icon className={cn('w-8 h-8 mb-4', feature.color)} />
              <h3 className="text-base font-semibold text-jarvis-white mb-2">{feature.title}</h3>
              <p className="text-sm text-jarvis-gray-500 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-jarvis-gray-800/50 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className="w-3.5 h-3.5 text-jarvis-gray-600" />
          <span className="text-xs font-mono text-jarvis-gray-600 uppercase tracking-wider">
            For educational purposes only — Not financial advice
          </span>
        </div>
        <p className="text-xs font-mono text-jarvis-gray-700">
          JARVIS.Finance © {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
