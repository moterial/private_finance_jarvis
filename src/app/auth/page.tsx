'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Loader2, Eye, EyeOff, Cpu, ArrowRight } from 'lucide-react';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push('/dashboard');
        router.refresh();
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });
        if (error) throw error;
        setMessage('註冊成功！請查看電子郵件確認帳號。\nRegistration successful! Please check your email to confirm.');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-jarvis-black flex items-center justify-center px-4">
      {/* Background grid effect */}
      <div className="fixed inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-jarvis-accent/20 flex items-center justify-center border border-jarvis-accent/30">
              <Cpu className="w-6 h-6 text-jarvis-accent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-jarvis-white tracking-tight">
                JARVIS<span className="text-jarvis-accent">.Finance</span>
              </h1>
            </div>
          </div>
          <p className="text-jarvis-gray-500 text-sm">
            AI-Powered Market Intelligence Platform
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-jarvis-gray-900/60 backdrop-blur-sm border border-jarvis-gray-700/50 rounded-2xl p-8">
          {/* Mode Toggle */}
          <div className="flex bg-jarvis-gray-800/50 rounded-lg p-1 mb-6">
            <button
              onClick={() => { setMode('login'); setError(null); setMessage(null); }}
              className={cn(
                'flex-1 py-2 rounded-md text-sm font-medium transition-all',
                mode === 'login'
                  ? 'bg-jarvis-accent/20 text-jarvis-accent border border-jarvis-accent/30'
                  : 'text-jarvis-gray-500 hover:text-jarvis-gray-300'
              )}
            >
              登入 Login
            </button>
            <button
              onClick={() => { setMode('register'); setError(null); setMessage(null); }}
              className={cn(
                'flex-1 py-2 rounded-md text-sm font-medium transition-all',
                mode === 'register'
                  ? 'bg-jarvis-accent/20 text-jarvis-accent border border-jarvis-accent/30'
                  : 'text-jarvis-gray-500 hover:text-jarvis-gray-300'
              )}
            >
              註冊 Register
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-jarvis-gray-500 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="your@email.com"
                className="w-full bg-jarvis-gray-800/50 border border-jarvis-gray-700/50 rounded-lg px-4 py-3 text-sm text-jarvis-white placeholder-jarvis-gray-600 focus:outline-none focus:border-jarvis-accent/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-jarvis-gray-500 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder={mode === 'register' ? '至少 6 個字元' : '••••••••'}
                  className="w-full bg-jarvis-gray-800/50 border border-jarvis-gray-700/50 rounded-lg px-4 py-3 pr-10 text-sm text-jarvis-white placeholder-jarvis-gray-600 focus:outline-none focus:border-jarvis-accent/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-jarvis-gray-500 hover:text-jarvis-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-jarvis-red/10 border border-jarvis-red/20 rounded-lg p-3 text-jarvis-red text-sm">
                {error}
              </div>
            )}

            {message && (
              <div className="bg-jarvis-green/10 border border-jarvis-green/20 rounded-lg p-3 text-jarvis-green text-sm whitespace-pre-line">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-jarvis-accent text-jarvis-black font-semibold text-sm hover:bg-jarvis-accent/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? '登入 Sign In' : '建立帳號 Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-jarvis-gray-600 text-xs mt-6">
          Powered by DeepSeek R1 &middot; Real-time Market Data
        </p>
      </div>
    </div>
  );
}
