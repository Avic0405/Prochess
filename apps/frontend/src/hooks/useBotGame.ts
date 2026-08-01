'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Chess } from 'chess.js';
import { useGameStore } from '@/store/gameStore';
import { StockfishEngine, movetimeForLevel } from '@/lib/stockfish';
import api from '@/lib/api';
import { Game, Move, PublicUser } from '@/types';
import { trackGameStarted, trackGameFinished } from '@/lib/analytics/events';

export interface BotLevelInfo {
  id: string;
  level: number;
  name: string;
  elo: number;
}

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function buildSyntheticGame(
  botLevel: BotLevelInfo,
  userId: string,
  username: string,
  userRating: number,
): Game {
  const me: PublicUser = { id: userId, username, rating: userRating };
  const bot: PublicUser = {
    id: `stockfish-${botLevel.level}`,
    username: `${botLevel.name} Bot`,
    rating: botLevel.elo,
  };
  return {
    id: `bot-${botLevel.level}-${Date.now()}`,
    whitePlayerId: userId,
    blackPlayerId: bot.id,
    whitePlayer: me,
    blackPlayer: bot,
    status: 'ACTIVE',
    type: 'FREE',
    timeControlType: 'RAPID',
    timeMinutes: 10,
    increment: 0,
    fen: STARTING_FEN,
    whiteTimeLeft: 600,
    blackTimeLeft: 600,
    currentTurn: 'w',
    moveCount: 0,
    moves: [],
    chatMessages: [],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Parallel to useGame.ts, but the "opponent" is a local Stockfish Web Worker
 * instead of Socket.IO — bot games never touch the backend for move
 * calculation, Redis, or matchmaking. Feeds the same useGameStore that the
 * online game page uses (via a synthetic Game object) so MatchResultDialog,
 * MoveHistory, GameTimer, CapturedPieces, and ChessBoard all work unmodified.
 */
export function useBotGame(botLevel: BotLevelInfo, userId: string, username: string, userRating: number) {
  const chessRef = useRef(new Chess());
  const engineRef = useRef<StockfishEngine | null>(null);
  const startedTrackedRef = useRef(false);
  const finishedTrackedRef = useRef(false);
  const [botThinking, setBotThinking] = useState(false);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { game, isGameOver, setGame, setPlayerColor, addMove, endGame, setLastMove, resetGame, decrementTimer } =
    useGameStore();

  const startNewGame = useCallback(() => {
    resetGame();
    chessRef.current = new Chess();
    finishedTrackedRef.current = false;

    engineRef.current?.destroy();
    const engine = new StockfishEngine();
    engineRef.current = engine;
    engine.setElo(botLevel.elo);
    engine.newGame();

    const synthetic = buildSyntheticGame(botLevel, userId, username, userRating);
    setGame(synthetic);
    setPlayerColor('white');

    if (!startedTrackedRef.current) {
      startedTrackedRef.current = true;
      trackGameStarted({
        gameId: synthetic.id,
        gameType: 'FREE',
        timeMinutes: synthetic.timeMinutes,
        mode: 'bot',
      });
    }
  }, [botLevel, userId, username, userRating, setGame, setPlayerColor, resetGame]);

  useEffect(() => {
    startNewGame();
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botLevel.id]);

  const recordMove = useCallback(
    (move: { from: string; to: string; san: string; promotion?: string }, fen: string) => {
      const { game } = useGameStore.getState();
      if (!game) return;
      const moveNum = game.moveCount + 1;
      const moveEntry: Move = {
        id: `${game.id}-${moveNum}`,
        moveNum,
        san: move.san,
        uci: `${move.from}${move.to}${move.promotion ?? ''}`,
        fen,
        timeTaken: 0,
        createdAt: new Date().toISOString(),
      };
      useGameStore.getState().setGame({
        ...game,
        fen,
        currentTurn: (fen.split(' ')[1] as 'w' | 'b') ?? 'w',
        moveCount: moveNum,
      });
      addMove(moveEntry);
      setLastMove({ from: move.from, to: move.to });
    },
    [addMove, setLastMove],
  );

  const finishGame = useCallback(
    async (result: 'WIN' | 'LOSS' | 'DRAW' | 'ABANDONED', reason: string) => {
      if (finishedTrackedRef.current) return;
      finishedTrackedRef.current = true;

      // The human always plays White in v1.
      const storeResult = result === 'WIN' ? 'WHITE_WINS' : result === 'LOSS' ? 'BLACK_WINS' : 'DRAW';
      endGame(storeResult, reason);

      const { game } = useGameStore.getState();
      trackGameFinished({
        gameId: game?.id ?? '',
        result: storeResult,
        reason,
        won: result === 'WIN' ? true : result === 'LOSS' ? false : null,
        mode: 'bot',
      });

      try {
        await api.post('/bot/end', {
          levelId: botLevel.id,
          result,
          pgn: chessRef.current.pgn(),
          fen: chessRef.current.fen(),
          moveCount: game?.moveCount ?? 0,
        });
      } catch {
        // Best-effort — a failed history write shouldn't block the result UI.
      }
    },
    [botLevel.id, endGame],
  );

  // Client-side timer — same pattern as useGame.ts, plus timeout enforcement
  // (which useGame.ts leaves to the server; there's no server here).
  useEffect(() => {
    if (!game || game.status !== 'ACTIVE' || isGameOver) return;

    timerRef.current = setInterval(() => {
      decrementTimer();
      const { whiteTime, blackTime, game: currentGame } = useGameStore.getState();
      if (!currentGame) return;
      if (currentGame.currentTurn === 'w' && whiteTime <= 0) {
        void finishGame('LOSS', 'timeout');
      } else if (currentGame.currentTurn === 'b' && blackTime <= 0) {
        void finishGame('WIN', 'timeout');
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [game?.status, isGameOver, decrementTimer, finishGame]);

  const checkGameOver = useCallback((): boolean => {
    const chess = chessRef.current;
    if (!chess.isGameOver()) return false;
    if (chess.isCheckmate()) {
      // Side to move is the one in checkmate — if it's Black's turn, White (human) delivered mate.
      const humanWon = chess.turn() === 'b';
      void finishGame(humanWon ? 'WIN' : 'LOSS', 'checkmate');
    } else {
      void finishGame('DRAW', chess.isStalemate() ? 'stalemate' : 'draw');
    }
    return true;
  }, [finishGame]);

  const requestBotMove = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine) return;
    setBotThinking(true);
    try {
      const uciMove = await engine.getBestMove(chessRef.current.fen(), movetimeForLevel(botLevel.level));
      if (!uciMove || uciMove === '(none)') return;
      const from = uciMove.slice(0, 2);
      const to = uciMove.slice(2, 4);
      const promotion = uciMove.length > 4 ? uciMove.slice(4) : undefined;
      let move;
      try {
        move = chessRef.current.move({ from, to, promotion });
      } catch {
        return;
      }
      if (!move) return;
      recordMove(move, chessRef.current.fen());
      checkGameOver();
    } finally {
      setBotThinking(false);
    }
  }, [botLevel.level, recordMove, checkGameOver]);

  const makeMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      const { isGameOver } = useGameStore.getState();
      if (isGameOver || botThinking) return;
      if (chessRef.current.turn() !== 'w') return; // not the human's turn

      let move;
      try {
        move = chessRef.current.move({ from, to, promotion });
      } catch {
        return; // illegal move
      }
      if (!move) return;

      recordMove(move, chessRef.current.fen());
      if (checkGameOver()) return;
      void requestBotMove();
    },
    [botThinking, recordMove, checkGameOver, requestBotMove],
  );

  const resign = useCallback(() => {
    void finishGame('LOSS', 'resignation');
  }, [finishGame]);

  return { makeMove, resign, newGame: startNewGame, botThinking };
}
