'use client';

import Link from 'next/link';
import { Game } from '@/types';
import { Button } from '@/components/ui/Button';
import { Trophy, Minus, X, RotateCcw, Home, Loader2, Swords, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RematchState } from '@/hooks/useGame';

interface GameOverProps {
  result: string;
  reason?: string | null;
  game: Game | null;
  userId?: string;
  onRematch?: () => void;
  onAcceptRematch?: () => void;
  rematchState?: RematchState;
  mode?: 'overlay' | 'page';
}

const REASON_LABELS: Record<string, string> = {
  checkmate: 'by Checkmate',
  resignation: 'by Resignation',
  timeout: 'on Time',
  disconnect: 'by Disconnection',
  draw_accepted: '— Draw Agreed',
  stalemate: '— Stalemate',
  insufficient_material: '— Insufficient Material',
  threefold_repetition: '— Threefold Repetition',
  fifty_move_rule: '— 50-Move Rule',
};

export function GameOver({ result, reason, game, userId, onRematch, onAcceptRematch, rematchState = 'idle', mode = 'page' }: GameOverProps) {
  const isWhite = game?.whitePlayerId === userId;
  const won = (isWhite && result === 'WHITE_WINS') || (!isWhite && result === 'BLACK_WINS');
  const drew = result === 'DRAW';

  const title = drew ? "Draw" : won ? 'You Won!' : 'You Lost';
  const reasonLabel = reason ? (REASON_LABELS[reason] ?? reason.replace(/_/g, ' ')) : '';

  const content = (
    <div className={cn(
      'bg-[#1a1a1a] border border-white/10 rounded-2xl p-8 w-full max-w-sm shadow-2xl',
      mode === 'overlay' && 'mx-4',
    )}>
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          {drew ? (
            <div className="w-16 h-16 rounded-full bg-gray-500/20 flex items-center justify-center">
              <Minus className="w-8 h-8 text-gray-400" />
            </div>
          ) : won ? (
            <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
              <Trophy className="w-8 h-8 text-yellow-500" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
              <X className="w-8 h-8 text-red-500" />
            </div>
          )}
        </div>

        <div>
          <h2 className={cn(
            'text-3xl font-bold',
            won && 'text-yellow-500',
            drew && 'text-gray-300',
            !won && !drew && 'text-red-500',
          )}>
            {title}
          </h2>
          {reasonLabel && (
            <p className="text-muted-foreground text-sm mt-1">{reasonLabel}</p>
          )}
        </div>

        {game && (
          <div className="bg-white/5 rounded-xl p-4 text-sm space-y-2">
            <div className="flex justify-between text-muted-foreground">
              <span>⬜ {game.whitePlayer?.username}</span>
              <span>⬛ {game.blackPlayer?.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Moves</span>
              <span className="font-medium">{game.moveCount}</span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-2">
          {/* Rematch — state-aware */}
          {onRematch && rematchState === 'idle' && (
            <Button onClick={onRematch} className="w-full gap-2">
              <RotateCcw className="w-4 h-4" /> Rematch
            </Button>
          )}
          {rematchState === 'pending' && (
            <Button disabled className="w-full gap-2 opacity-70">
              <Loader2 className="w-4 h-4 animate-spin" /> Waiting for opponent…
            </Button>
          )}
          {rematchState === 'incoming' && onAcceptRematch && (
            <Button onClick={onAcceptRematch} className="w-full gap-2 bg-green-600 hover:bg-green-500">
              <Swords className="w-4 h-4" /> Accept Rematch
            </Button>
          )}

          {game?.id && (
            <Button asChild variant="outline" className="w-full">
              <Link href={`/game/${game.id}/review`} className="gap-2 flex items-center justify-center">
                <BookOpen className="w-4 h-4" /> Review Game
              </Link>
            </Button>
          )}
          <Button asChild variant={onRematch ? 'outline' : 'default'} className="w-full">
            <Link href="/lobby" className="gap-2 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" /> New Game
            </Link>
          </Button>
          <Button asChild variant="ghost" className="w-full">
            <Link href="/dashboard" className="gap-2 flex items-center justify-center">
              <Home className="w-4 h-4" /> Dashboard
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );

  if (mode === 'overlay') {
    return (
      <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-40 rounded-lg">
        {content}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      {content}
    </div>
  );
}
