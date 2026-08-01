'use client';

import type { ReactNode } from 'react';
import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GameTimer } from './GameTimer';

interface PlayerBarProps {
  player?: { id?: string; username: string; avatar?: string; rating: number };
  timeLeft: number;
  isActive: boolean;
  color: 'white' | 'black';
  isMe?: boolean;
  /** Optional small pulsing label next to the name — e.g. "thinking…" for a bot opponent. */
  statusLabel?: string;
  /** Overrides the default first-letter avatar (e.g. a Bot icon for bot mode). */
  avatarIcon?: ReactNode;
}

export function PlayerBar({
  player,
  timeLeft,
  isActive,
  color,
  isMe,
  statusLabel,
  avatarIcon,
}: PlayerBarProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-2 py-1.5 rounded-md transition-colors',
        isActive ? 'bg-white/5' : '',
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 shrink-0',
            color === 'white'
              ? 'bg-gray-100 text-gray-900 border-gray-400'
              : 'bg-gray-800 text-white border-gray-600',
          )}
        >
          {avatarIcon ?? player?.username?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate max-w-[140px]">
              {player?.username ?? 'Connecting...'}
            </span>
            {isMe && (
              <span className="text-[10px] text-gray-500 bg-white/5 px-1 rounded">you</span>
            )}
            {statusLabel && (
              <span className="text-[10px] text-primary animate-pulse">{statusLabel}</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Crown className="w-3 h-3 text-yellow-500/60" />
            <span className="text-xs text-gray-500">{player?.rating ?? '—'}</span>
          </div>
        </div>
      </div>

      <GameTimer seconds={timeLeft} isActive={isActive} />
    </div>
  );
}
