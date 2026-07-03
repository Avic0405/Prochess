'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useGameStore } from '@/store/gameStore';
import { useGame } from '@/hooks/useGame';
import { ChessBoard } from '@/components/chess/ChessBoard';
import { GameTimer } from '@/components/chess/GameTimer';
import { MoveHistory } from '@/components/chess/MoveHistory';
import { GameChat } from '@/components/chess/GameChat';
import { MatchResultDialog } from '@/components/chess/MatchResultDialog';
import { CapturedPieces } from '@/components/chess/CapturedPieces';
import { Button } from '@/components/ui/Button';
import {
  Flag,
  Handshake,
  FlipHorizontal,
  MessageSquare,
  List,
  Loader2,
  Crown,
  Eye,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const {
    game,
    playerColor,
    isGameOver,
    gameResult,
    gameOverReason,
    whiteTime,
    blackTime,
    drawOfferedBy,
    lastMove,
    resetGame,
  } = useGameStore();

  const { makeMove, resign, offerDraw, acceptDraw, sendMessage, requestRematch, acceptRematch, rematchState } = useGame(gameId);

  const [boardFlipped, setBoardFlipped] = useState(false);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<'moves' | 'chat'>('moves');
  const [resultDismissed, setResultDismissed] = useState(false);

  // Reset store on mount so stale game from previous match doesn't bleed in
  useEffect(() => {
    resetGame();
  }, [gameId]);

  // Re-show dialog each time a new game ends
  useEffect(() => {
    if (isGameOver) setResultDismissed(false);
  }, [isGameOver]);

  // HTTP fetch — populates board immediately before socket fires
  const { data: initialGame, isLoading } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => api.get(`/games/${gameId}`).then((r) => r.data),
    staleTime: 0,
    enabled: !!gameId,
  });

  useEffect(() => {
    if (!initialGame || game) return;
    useGameStore.getState().setGame(initialGame);
    if (user?.id) {
      if (initialGame.whitePlayerId === user.id) {
        useGameStore.getState().setPlayerColor('white');
      } else if (initialGame.blackPlayerId === user.id) {
        useGameStore.getState().setPlayerColor('black');
      }
    }
  }, [initialGame, user]);

  const activeGame = game ?? initialGame;
  const activePlayerColor = playerColor ?? 'white';

  const isPlayer =
    !!activeGame &&
    (activeGame.whitePlayerId === user?.id || activeGame.blackPlayerId === user?.id);

  const isMyTurn =
    !!activeGame &&
    !!playerColor &&
    ((playerColor === 'white' && activeGame.currentTurn === 'w') ||
      (playerColor === 'black' && activeGame.currentTurn === 'b'));

  const opponentPlayer =
    activePlayerColor === 'white' ? activeGame?.blackPlayer : activeGame?.whitePlayer;
  const myPlayer =
    activePlayerColor === 'white' ? activeGame?.whitePlayer : activeGame?.blackPlayer;

  const myTime = activePlayerColor === 'white' ? whiteTime : blackTime;
  const opponentTime = activePlayerColor === 'white' ? blackTime : whiteTime;
  const myTurnActive =
    activeGame?.currentTurn === (activePlayerColor === 'white' ? 'w' : 'b') &&
    activeGame?.status === 'ACTIVE';
  const opponentTurnActive =
    activeGame?.currentTurn !== (activePlayerColor === 'white' ? 'w' : 'b') &&
    activeGame?.status === 'ACTIVE';

  const handleResign = useCallback(() => {
    resign();
    setShowResignConfirm(false);
  }, [resign]);

  if (isLoading && !activeGame) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Loading game...</p>
        </div>
      </div>
    );
  }

  if (!activeGame) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <p className="text-lg font-medium">Game not found</p>
          <Button onClick={() => router.push('/lobby')}>Back to Lobby</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#161512] text-white">
      <div className="max-w-[1200px] mx-auto p-3 md:p-5">
        <div className="flex flex-col lg:flex-row gap-4 items-start justify-center">

          {/* ── Board Column ─────────────────────────────── */}
          <div className="w-full lg:flex-1 max-w-[600px] mx-auto lg:mx-0">

            {/* Opponent player bar */}
            <PlayerBar
              player={opponentPlayer}
              timeLeft={opponentTime}
              isActive={opponentTurnActive}
              color={activePlayerColor === 'white' ? 'black' : 'white'}
            />

            {/* Opponent captured pieces */}
            {activeGame.fen && (
              <CapturedPieces
                fen={activeGame.fen}
                color={activePlayerColor === 'white' ? 'black' : 'white'}
                className="px-2 py-0.5 min-h-[20px]"
              />
            )}

            {/* Board */}
            <div className="relative my-1">
              <ChessBoard
                fen={activeGame.fen}
                playerColor={activePlayerColor}
                onMove={makeMove}
                disabled={
                  !isPlayer ||
                  !isMyTurn ||
                  isGameOver ||
                  activeGame.status !== 'ACTIVE'
                }
                lastMove={lastMove}
                boardFlipped={boardFlipped}
              />
            </div>

            {/* My captured pieces */}
            {activeGame.fen && (
              <CapturedPieces
                fen={activeGame.fen}
                color={activePlayerColor}
                className="px-2 py-0.5 min-h-[20px]"
              />
            )}

            {/* My player bar */}
            <PlayerBar
              player={myPlayer}
              timeLeft={myTime}
              isActive={myTurnActive}
              color={activePlayerColor}
              isMe={isPlayer}
            />

            {/* Spectator banner */}
            {!isPlayer && (
              <div className={cn(
                'flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm mt-2',
                activeGame.status === 'ACTIVE'
                  ? 'bg-primary/10 border border-primary/20 text-primary'
                  : 'bg-muted border border-border text-muted-foreground',
              )}>
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 shrink-0" />
                  <span>
                    {activeGame.status === 'ACTIVE' ? 'Spectating live game' : 'Viewing completed game'}
                  </span>
                  {activeGame.status === 'ACTIVE' && (
                    <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  )}
                </div>
                <button
                  onClick={() => setBoardFlipped((f) => !f)}
                  className="flex items-center gap-1 text-xs opacity-70 hover:opacity-100 transition-opacity"
                  title="Flip board"
                >
                  <FlipHorizontal className="w-3.5 h-3.5" />
                  Flip
                </button>
              </div>
            )}

            {/* In-game controls */}
            {isPlayer && !isGameOver && activeGame.status === 'ACTIVE' && (
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

                {drawOfferedBy && drawOfferedBy !== user?.id ? (
                  <Button
                    onClick={acceptDraw}
                    size="sm"
                    className="gap-1.5 h-8 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Handshake className="w-3.5 h-3.5" />
                    Accept Draw
                  </Button>
                ) : (
                  <Button
                    onClick={offerDraw}
                    variant="ghost"
                    size="sm"
                    disabled={!!drawOfferedBy}
                    className="gap-1.5 text-gray-400 hover:text-white h-8"
                  >
                    <Handshake className="w-3.5 h-3.5" />
                    {drawOfferedBy === user?.id ? 'Draw sent…' : 'Draw'}
                  </Button>
                )}

                {showResignConfirm ? (
                  <div className="flex items-center gap-1.5 bg-destructive/20 rounded px-2 py-1 border border-destructive/30">
                    <span className="text-xs text-destructive font-medium">Resign?</span>
                    <Button
                      onClick={handleResign}
                      variant="destructive"
                      size="sm"
                      className="h-6 px-2 text-xs"
                    >
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
                )}
              </div>
            )}
          </div>

          {/* ── Side Panel ──────────────────────────────── */}
          <div className="w-full lg:w-72 xl:w-80 flex flex-col gap-3 shrink-0">

            {/* Game info */}
            <div className="bg-[#262421] rounded-lg p-3 text-sm border border-white/5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-200">
                  {activeGame.type === 'PAID' ? '💰 Paid Match' : '♟ Free Match'}
                </span>
                <span className="text-gray-500 text-xs">
                  {activeGame.timeMinutes}+{activeGame.increment ?? 0}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                <span>{activeGame.moveCount ?? 0} moves</span>
                {activeGame.stake && (
                  <span className="text-yellow-400 font-medium">
                    {activeGame.currency === 'INR' ? '₹' : '$'}{activeGame.stake} stake
                  </span>
                )}
                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded-full',
                    activeGame.status === 'ACTIVE'
                      ? 'bg-green-500/15 text-green-400'
                      : 'bg-gray-500/15 text-gray-400',
                  )}
                >
                  {activeGame.status === 'ACTIVE' ? '● Live' : activeGame.status}
                </span>
              </div>
            </div>

            {/* Moves / Chat tabs */}
            <div className="bg-[#262421] rounded-lg overflow-hidden border border-white/5 flex-1">
              <div className="flex border-b border-white/5">
                {(['moves', 'chat'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      'flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
                      activeTab === tab
                        ? 'bg-white/8 text-white'
                        : 'text-gray-500 hover:text-gray-300',
                    )}
                  >
                    {tab === 'moves' ? (
                      <List className="w-3.5 h-3.5" />
                    ) : (
                      <MessageSquare className="w-3.5 h-3.5" />
                    )}
                    {tab === 'moves' ? 'Moves' : 'Chat'}
                  </button>
                ))}
              </div>

              <div className="h-64 sm:h-72 lg:h-80 overflow-y-auto p-3">
                {activeTab === 'moves' ? (
                  <MoveHistory moves={activeGame?.moves ?? []} />
                ) : (
                  <GameChat
                    messages={activeGame?.chatMessages ?? []}
                    onSend={sendMessage}
                    disabled={!isPlayer}
                  />
                )}
              </div>
            </div>

            {/* Post-game action buttons */}
            {isGameOver && (
              <div className="bg-[#262421] rounded-lg p-3 space-y-2 border border-white/5">
                <Button
                  onClick={() => router.push('/lobby')}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  New Game
                </Button>
                <Button
                  onClick={() => router.push('/dashboard')}
                  variant="ghost"
                  className="w-full text-gray-400 hover:text-white"
                >
                  Dashboard
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Match Result Dialog — portal, renders outside the board ── */}
      <MatchResultDialog
        open={isGameOver && !!gameResult && !resultDismissed}
        onClose={() => setResultDismissed(true)}
        result={gameResult ?? ''}
        reason={gameOverReason}
        game={activeGame}
        userId={user?.id}
        onRematch={isPlayer ? requestRematch : undefined}
        onAcceptRematch={acceptRematch}
        rematchState={rematchState}
      />
    </div>
  );
}

/* ─── Player Bar ──────────────────────────────────────── */

function PlayerBar({
  player,
  timeLeft,
  isActive,
  color,
  isMe,
}: {
  player?: { id?: string; username: string; avatar?: string; rating: number };
  timeLeft: number;
  isActive: boolean;
  color: 'white' | 'black';
  isMe?: boolean;
}) {
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
          {player?.username?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate max-w-[140px]">
              {player?.username ?? 'Connecting...'}
            </span>
            {isMe && (
              <span className="text-[10px] text-gray-500 bg-white/5 px-1 rounded">you</span>
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
