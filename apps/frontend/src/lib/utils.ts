import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatCurrency(amount: number | string, currency: 'USD' | 'INR'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(num);
}

export function getRatingColor(rating: number): string {
  if (rating >= 2000) return 'text-yellow-500';
  if (rating >= 1600) return 'text-purple-500';
  if (rating >= 1300) return 'text-blue-500';
  if (rating >= 1000) return 'text-green-500';
  return 'text-gray-500';
}

export function getTimeControlLabel(minutes: number, increment: number): string {
  const base = minutes < 3 ? 'Bullet' : minutes < 10 ? 'Blitz' : minutes < 30 ? 'Rapid' : 'Classical';
  return increment > 0 ? `${base} (${minutes}+${increment})` : `${base} (${minutes} min)`;
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}
