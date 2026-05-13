'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Portfolio, PortfolioPosition } from '../types/extended';
import { createClient } from '../supabase/client';

interface PortfolioContextType {
  portfolio: Portfolio;
  addPosition: (position: Omit<PortfolioPosition, 'addedAt'>) => void;
  removePosition: (ticker: string) => void;
  updateNotes: (ticker: string, notes: string) => void;
  updateShares: (ticker: string, shares: number, avgCost: number) => void;
  isInPortfolio: (ticker: string) => boolean;
  addToWatchlist: (ticker: string) => void;
  removeFromWatchlist: (ticker: string) => void;
}

const PortfolioContext = createContext<PortfolioContextType | null>(null);

const EMPTY: Portfolio = { positions: [], watchlist: [], lastUpdated: new Date().toISOString() };

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [portfolio, setPortfolio] = useState<Portfolio>(EMPTY);
  const supabase = createClient();

  // Load portfolio from Supabase on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;

      const [posRes, wlRes] = await Promise.all([
        supabase.from('portfolios').select('*').eq('user_id', user.id).order('added_at', { ascending: true }),
        supabase.from('watchlist').select('ticker').eq('user_id', user.id),
      ]);

      if (cancelled) return;

      const positions: PortfolioPosition[] = (posRes.data || []).map(r => ({
        ticker: r.ticker,
        name: r.ticker, // name is resolved client-side
        shares: Number(r.shares),
        avgCost: Number(r.avg_cost),
        addedAt: r.added_at,
        notes: r.notes || '',
        sector: '',
      }));

      const watchlist = (wlRes.data || []).map(r => r.ticker);

      setPortfolio({ positions, watchlist, lastUpdated: new Date().toISOString() });
    }
    load();
    return () => { cancelled = true; };
  }, [supabase]);

  const addPosition = useCallback(async (pos: Omit<PortfolioPosition, 'addedAt'>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('portfolios').upsert({
      user_id: user.id,
      ticker: pos.ticker,
      shares: pos.shares,
      avg_cost: pos.avgCost,
      notes: pos.notes || '',
    }, { onConflict: 'user_id,ticker' });

    if (!error) {
      setPortfolio(prev => {
        if (prev.positions.some(p => p.ticker === pos.ticker)) return prev;
        return {
          ...prev,
          positions: [...prev.positions, { ...pos, addedAt: new Date().toISOString() }],
          lastUpdated: new Date().toISOString(),
        };
      });
    }
  }, [supabase]);

  const removePosition = useCallback(async (ticker: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('portfolios').delete().eq('user_id', user.id).eq('ticker', ticker);
    setPortfolio(prev => ({
      ...prev,
      positions: prev.positions.filter(p => p.ticker !== ticker),
      lastUpdated: new Date().toISOString(),
    }));
  }, [supabase]);

  const updateNotes = useCallback(async (ticker: string, notes: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('portfolios').update({ notes, updated_at: new Date().toISOString() }).eq('user_id', user.id).eq('ticker', ticker);
    setPortfolio(prev => ({
      ...prev,
      positions: prev.positions.map(p => p.ticker === ticker ? { ...p, notes } : p),
      lastUpdated: new Date().toISOString(),
    }));
  }, [supabase]);

  const updateShares = useCallback(async (ticker: string, shares: number, avgCost: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('portfolios').update({ shares, avg_cost: avgCost, updated_at: new Date().toISOString() }).eq('user_id', user.id).eq('ticker', ticker);
    setPortfolio(prev => ({
      ...prev,
      positions: prev.positions.map(p => p.ticker === ticker ? { ...p, shares, avgCost } : p),
      lastUpdated: new Date().toISOString(),
    }));
  }, [supabase]);

  const isInPortfolio = useCallback((ticker: string) => {
    return portfolio.positions.some(p => p.ticker === ticker);
  }, [portfolio.positions]);

  const addToWatchlist = useCallback(async (ticker: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('watchlist').upsert({ user_id: user.id, ticker }, { onConflict: 'user_id,ticker' });
    setPortfolio(prev => {
      if (prev.watchlist.includes(ticker)) return prev;
      return { ...prev, watchlist: [...prev.watchlist, ticker], lastUpdated: new Date().toISOString() };
    });
  }, [supabase]);

  const removeFromWatchlist = useCallback(async (ticker: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('watchlist').delete().eq('user_id', user.id).eq('ticker', ticker);
    setPortfolio(prev => ({
      ...prev,
      watchlist: prev.watchlist.filter(t => t !== ticker),
      lastUpdated: new Date().toISOString(),
    }));
  }, [supabase]);

  return (
    <PortfolioContext.Provider value={{
      portfolio, addPosition, removePosition, updateNotes, updateShares,
      isInPortfolio, addToWatchlist, removeFromWatchlist,
    }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio must be used within PortfolioProvider');
  return ctx;
}
