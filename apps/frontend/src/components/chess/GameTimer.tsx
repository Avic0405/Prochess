'use client';

import { cn } from '@/lib/utils';

interface GameTimerProps {
  seconds: number;
  isActive: boolean;
  className?: string;
}

function pad(n: number) {
  return String(Math.floor(n)).padStart(2, '0');
}

function formatTime(totalSeconds: number): { display: string; showDecimal: boolean } {
  if (totalSeconds < 0) totalSeconds = 0;
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (totalSeconds < 10) {
    const whole = Math.floor(totalSeconds);
    const tenth = Math.floor((totalSeconds - whole) * 10);
    return { display: `0:${pad(whole)}.${tenth}`, showDecimal: true };
  }
  return { display: `${pad(mins)}:${pad(secs)}`, showDecimal: false };
}

export function GameTimer({ seconds, isActive, className }: GameTimerProps) {
  const isCritical = seconds <= 10 && isActive;
  const isLow = seconds <= 30 && isActive;
  const { display } = formatTime(seconds);

  return (
    <div
      className={cn(
        'font-mono font-bold tabular-nums px-3 py-1.5 rounded-md border-2 min-w-[80px] text-center transition-all duration-200',
        isActive
          ? 'text-foreground'
          : 'text-muted-foreground border-transparent bg-muted/50',
        isActive && !isLow && 'border-primary/40 bg-primary/5',
        isLow && !isCritical && 'border-yellow-500/60 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
        isCritical && 'border-destructive/80 bg-destructive/15 text-destructive animate-pulse',
        className,
      )}
      style={{ fontSize: seconds < 60 ? '1.1rem' : '1rem' }}
    >
      {display}
    </div>
  );
}
