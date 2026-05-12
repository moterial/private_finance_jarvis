'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { Portfolio, PortfolioPosition } from '../types/extended';

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

const STORAGE_KEY = 'jarvis-portfolio';

function loadPortfolio(): Portfolio {
  if (typeof window === 'undefined') return { positions: [], watchlist: [], lastUpdated: new Date().toISOString() };
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return { positions: [], watchlist: [], lastUpdated: new Date().toISOString() };
}

function savePortfolio(portfolio: Portfolio) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolio));
  }
}

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [portfolio, setPortfolio] = useState<Portfolio>(loadPortfolio);

  useEffect(() => {
    setPortfolio(loadPortfolio());
  }, []);

  const persist = useCallback((updater: (prev: Portfolio) => Portfolio) => {
    setPortfolio(prev => {
      const next = updater(prev);
      next.lastUpdated = new Date().toISOString();
      savePortfolio(next);
      return next;
    });
  }, []);

  const addPosition = useCallback((pos: Omit<PortfolioPosition, 'addedAt'>) => {
    persist(prev => {
      if (prev.positions.some(p => p.ticker === pos.ticker)) return prev;
      return {
        ...prev,
        positions: [...prev.positions, { ...pos, addedAt: new Date().toISOString() }],
      };
    });
  }, [persist]);

  const removePosition = useCallback((ticker: string) => {
    persist(prev => ({
      ...prev,
      positions: prev.positions.filter(p => p.ticker !== ticker),
    }));
  }, [persist]);

  const updateNotes = useCallback((ticker: string, notes: string) => {
    persist(prev => ({
      ...prev,
      positions: prev.positions.map(p => p.ticker === ticker ? { ...p, notes } : p),
    }));
  }, [persist]);

  const updateShares = useCallback((ticker: string, shares: number, avgCost: number) => {
    persist(prev => ({
      ...prev,
      positions: prev.positions.map(p => p.ticker === ticker ? { ...p, shares, avgCost } : p),
    }));
  }, [persist]);

  const isInPortfolio = useCallback((ticker: string) => {
    return portfolio.positions.some(p => p.ticker === ticker);
  }, [portfolio.positions]);

  const addToWatchlist = useCallback((ticker: string) => {
    persist(prev => {
      if (prev.watchlist.includes(ticker)) return prev;
      return { ...prev, watchlist: [...prev.watchlist, ticker] };
    });
  }, [persist]);

  const removeFromWatchlist = useCallback((ticker: string) => {
    persist(prev => ({
      ...prev,
      watchlist: prev.watchlist.filter(t => t !== ticker),
    }));
  }, [persist]);

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
