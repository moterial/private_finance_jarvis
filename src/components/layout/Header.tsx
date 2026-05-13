'use client';

import { Activity, Bell, RefreshCw, Wifi, Globe, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  lastRefresh: string | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export default function Header({ lastRefresh, isLoading, onRefresh }: HeaderProps) {
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 bg-jarvis-black/90 backdrop-blur-xl border-b border-jarvis-gray-800/50">
      <div className="max-w-[1920px] mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo & Brand */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-jarvis-accent to-jarvis-accent-dim flex items-center justify-center">
              <Activity className="w-5 h-5 text-jarvis-black" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-jarvis-green rounded-full animate-pulse-slow" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-jarvis-white">
              {t('header.title')}
            </h1>
            <p className="text-xs uppercase tracking-[0.2em] text-jarvis-gray-500 font-mono">
              {t('header.subtitle')}
            </p>
          </div>
        </div>

        {/* Center Status */}
        <div className="hidden md:flex items-center gap-6">
          <StatusIndicator label={t('header.reddit')} active />
          <StatusIndicator label={t('header.twitter')} active />
          <StatusIndicator label={t('header.news')} active />
          <div className="h-4 w-px bg-jarvis-gray-800" />
          <div className="flex items-center gap-2 text-xs text-jarvis-gray-500 font-mono">
            <Wifi className="w-3 h-3 text-jarvis-green" />
            <span>{t('header.live')}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-sm text-jarvis-gray-500 font-mono hidden sm:block">
              {t('header.updated')}: {new Date(lastRefresh).toLocaleTimeString()}
            </span>
          )}

          {/* Language Toggle */}
          <button
            onClick={() => setLocale(locale === 'en' ? 'zh' : 'en')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-jarvis-gray-800 hover:border-jarvis-gray-700 transition-all hover:bg-jarvis-gray-900 text-jarvis-gray-400 hover:text-jarvis-white text-sm font-mono"
          >
            <Globe className="w-3.5 h-3.5" />
            {locale === 'en' ? '中文' : 'EN'}
          </button>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className={cn(
              'p-2 rounded-lg border border-jarvis-gray-800 hover:border-jarvis-gray-700 transition-all',
              'hover:bg-jarvis-gray-900 text-jarvis-gray-400 hover:text-jarvis-white',
              isLoading && 'animate-spin text-jarvis-accent'
            )}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button className="p-2 rounded-lg border border-jarvis-gray-800 hover:border-jarvis-gray-700 transition-all hover:bg-jarvis-gray-900 text-jarvis-gray-400 hover:text-jarvis-white relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-jarvis-red rounded-full" />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg border border-jarvis-gray-800 hover:border-jarvis-red/30 transition-all hover:bg-jarvis-red/10 text-jarvis-gray-400 hover:text-jarvis-red"
            title={locale === 'zh' ? '登出' : 'Sign out'}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

function StatusIndicator({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn(
        'w-1.5 h-1.5 rounded-full',
        active ? 'bg-jarvis-green animate-pulse-slow' : 'bg-jarvis-gray-600'
      )} />
      <span className="text-sm font-mono text-jarvis-gray-500">{label}</span>
    </div>
  );
}
