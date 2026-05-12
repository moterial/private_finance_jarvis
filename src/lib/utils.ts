import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatNumber(num: number): string {
  if (Math.abs(num) >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}

export function formatPercent(num: number): string {
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

export function formatPrice(num: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
}

export function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function getSentimentColor(sentiment: string): string {
  switch (sentiment) {
    case 'bullish': return 'text-jarvis-green';
    case 'bearish': return 'text-jarvis-red';
    default: return 'text-jarvis-gray-400';
  }
}

export function getSentimentBg(sentiment: string): string {
  switch (sentiment) {
    case 'bullish': return 'bg-jarvis-green/10 border-jarvis-green/20';
    case 'bearish': return 'bg-jarvis-red/10 border-jarvis-red/20';
    default: return 'bg-jarvis-gray-700/30 border-jarvis-gray-600/20';
  }
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return 'text-jarvis-green';
  if (confidence >= 60) return 'text-jarvis-accent';
  if (confidence >= 40) return 'text-jarvis-yellow';
  return 'text-jarvis-red';
}

export function getSignalStrengthLabel(strength: string): string {
  switch (strength) {
    case 'strong': return '███████████';
    case 'moderate': return '███████░░░░';
    case 'weak': return '████░░░░░░░';
    default: return '░░░░░░░░░░░';
  }
}
