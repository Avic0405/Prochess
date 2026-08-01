'use client';

import { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useGameStore } from '@/store/gameStore';
import { useBotGame, type BotLevelInfo } from '@/hooks/useBotGame';
import { ChessBoard } from '@/components/chess/ChessBoard';
import { MoveHistory } from '@/components/chess/MoveHistory';
import { MatchResultDialog } from '@/components/chess/MatchResultDialog';
import { CapturedPieces } from '@/components/chess/CapturedPieces';
import { PlayerBar } from '@/components/chess/PlayerBar';
import { Button } from '@/components/ui/Button';
import { Flag, FlipHorizontal, List, Loader2, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BotLevelDto {
  id: string;
  level: number;
  name: string;
  elo: number;
  isUnlocked: boolean;
}

export default function BotGamePage() {
  const { level: levelParam } = useParams<{ level: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const { data: levels, isLoading } = useQuery<BotLevelDto[]>({
    queryKey: ['bot-levels'],
    queryFn: () => api.get('/bot/levels').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  const levelInfo = levels?.find((l) => l.level === Number(levelParam));

  if (!levelInfo || !levelInfo.isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <p className="text-lg font-medium">
            {levelInfo ? 'This level is locked' : 'Bot level not found'}
          </p>
          <Button onClick={() => router.push('/lobby')}>Back to Lobby</Button>
        </div>
      </div>
    );
  }

  const botLevel: BotLevelInfo = {
    id: levelInfo.id,
    level: levelInfo.level,
    name: levelInfo.name,
    elo: levelInfo.elo,
  };

  return (
    <BotGameBoard
      botLevel={botLevel}
      userId={user?.id ?? 'me'}
      username={user?.username ?? 'You'}
      userRating={user?.rating ?? 1200}
    />
  );
}

function BotGameBoard({
  botLevel,
  userId,
  username,
  userRating,
}: {
  botLevel: BotLevelInfo;
  userId: string;
  username: string;
  userRating: number;
}) {
  const router = useRouter();
  const { game, isGameOver, gameResult, gameOverReason, whiteTime, blackTime, lastMove } =
    useGameStore();
  const { makeMove, resign, newGame, botThinking, onPromotionPending } = useBotGame(
    botLevel,
    userId,
    username,
    userRating,
  );

  const [boardFlipped, setBoardFlipped] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [resultDismissed, setResultDismissed] = useState(false);

  const handleResign = useCallback(() => {
    resign();
    setShowResignConfirm(false);
  }, [resign]);

  const handleNewGame = useCallback(() => {
    setResultDismissed(false);
    setShowResignConfirm(false);
    newGame();
  }, [newGame]);

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#161512] text-white">
      <div className="max-w-[1200px] mx-auto p-3 md:p-5">
        <div className="flex flex-col lg:flex-row gap-4 items-start justify-center">
          {/* ── Board Column ─────────────────────────────── */}
          <div className="w-full lg:flex-1 max-w-[600px] mx-auto lg:mx-0">
            {/* Bot player bar */}
            <PlayerBar
              player={game.blackPlayer}
              timeLeft={blackTime}
              isActive={!isGameOver && game.currentTurn === 'b'}
              color="black"
              avatarIcon={<Bot className="w-4 h-4" />}
              statusLabel={botThinking ? 'thinking…' : undefined}
            />

            {game.fen && (
              <CapturedPieces fen={game.fen} color="black" className="px-2 py-0.5 min-h-[20px]" />
            )}

            <div className="relative my-1">
              <ChessBoard
                fen={game.fen}
                playerColor="white"
                onMove={makeMove}
                disabled={isGameOver || game.currentTurn !== 'w' || botThinking}
                lastMove={lastMove}
                boardFlipped={boardFlipped}
                onPromotionPending={onPromotionPending}
              />
            </div>

            {game.fen && (
              <CapturedPieces fen={game.fen} color="white" className="px-2 py-0.5 min-h-[20px]" />
            )}

            {/* My player bar */}
            <PlayerBar
              player={{ username, rating: userRating }}
              timeLeft={whiteTime}
              isActive={!isGameOver && game.currentTurn === 'w'}
              color="white"
              isMe
            />

            {/* Controls — Flip / Resign, always visible (no chat, no draw offers vs. a bot) */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Button
                onClick={() => setBoardFlipped((f) => !f)}
                variant="ghost"
                size="sm"
                className="gap-1.5 text-gray-400 hover:text-white h-8"
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                Flip
              </Button>

              {!isGameOver &&
                (showResignConfirm ? (
                  <div className="flex items-center gap-1.5 bg-destructive/20 rounded px-2 py-1 border border-destructive/30">
                    <span className="text-xs text-destructive font-medium">Resign?</span>
                    <Button onClick={handleResign} variant="destructive" size="sm" className="h-6 px-2 text-xs">
                      Yes
                    </Button>
                    <Button
                      onClick={() => setShowResignConfirm(false)}
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-gray-400"
                    >
                      No
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={() => setShowResignConfirm(true)}
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-gray-400 hover:text-red-400 h-8"
                  >
                    <Flag className="w-3.5 h-3.5" />
                    Resign
                  </Button>
                ))}

              <Button
                onClick={handleNewGame}
                size="sm"
                className="gap-1.5 h-8 bg-green-600 hover:bg-green-700 text-white"
              >
                New Game
              </Button>
            </div>
          </div>

          {/* ── Side Panel ──────────────────────────────── */}
          <div className="w-full lg:w-72 xl:w-80 flex flex-col gap-3 shrink-0">
            <div className="bg-[#262421] rounded-lg p-3 text-sm border border-white/5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-200 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-primary" /> Play with Bot
                </span>
                <span className="text-gray-500 text-xs">Level {botLevel.level}</span>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span>{botLevel.name}</span>
                <span>{game.moveCount ?? 0} moves</span>
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-full',
                    !isGameOver ? 'bg-green-500/15 text-green-400' : 'bg-gray-500/15 text-gray-400',
                  )}
                >
                  {!isGameOver ? '● Active' : 'Finished'}
                </span>
              </div>
            </div>

            <div className="bg-[#262421] rounded-lg overflow-hidden border border-white/5 flex-1">
              <div className="flex border-b border-white/5">
                <div className="flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 bg-white/8 text-white">
                  <List className="w-3.5 h-3.5" />
                  Moves
                </div>
              </div>
              <div className="h-64 sm:h-72 lg:h-80 overflow-y-auto p-3">
                <MoveHistory moves={game.moves ?? []} />
              </div>
            </div>

            {isGameOver && (
              <div className="bg-[#262421] rounded-lg p-3 border border-white/5">
                <Button
                  onClick={() => router.push('/lobby')}
                  variant="ghost"
                  className="w-full text-gray-400 hover:text-white"
                >
                  Back to Lobby
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <MatchResultDialog
        open={isGameOver && !!gameResult && !resultDismissed}
        onClose={() => setResultDismissed(true)}
        result={gameResult ?? ''}
        reason={gameOverReason}
        game={game}
        userId={userId}
        onRematch={handleNewGame}
      />
    </div>
  );
}
