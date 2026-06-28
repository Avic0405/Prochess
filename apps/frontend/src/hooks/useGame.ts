'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import { useGameStore } from '@/store/gameStore';
import { getGameSocket } from '@/lib/socket';
import Cookies from 'js-cookie';

export type RematchState = 'idle' | 'pending' | 'incoming';

export function useGame(gameId: string) {
  const socketRef = useRef<Socket | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [rematchState, setRematchState] = useState<RematchState>('idle');
  const [rematchRequesterId, setRematchRequesterId] = useState<string | null>(null);
  const {
    game, playerColor, isGameOver, whiteTime, blackTime,
    setGame, addMove, addChatMessage, updateTimes,
    setDrawOffer, endGame, decrementTimer,
  } = useGameStore();

  useEffect(() => {
    const token = Cookies.get('accessToken');
    if (!token || !gameId) return;

    const socket = getGameSocket(token);
    socketRef.current = socket;

    socket.emit('join_game', { gameId });

    socket.on('game_joined', (payload: any) => {
      // NestJS WsResponse sends data directly (not wrapped in { data: ... })
      const gameData = payload?.game ?? payload?.data?.game;
      const colorData = payload?.playerColor ?? payload?.data?.playerColor;
      if (gameData) {
        useGameStore.getState().setGame(gameData);
      }
      if (colorData) {
        useGameStore.getState().setPlayerColor(colorData as 'white' | 'black');
      }
    });

    socket.on('move_made', (data: any) => {
      const { game: currentGame } = useGameStore.getState();
      if (!currentGame) return;

      const newStatus = data.status ?? currentGame.status;
      const newMoveCount = data.move?.moveNum ?? currentGame.moveCount;

      useGameStore.getState().setGame({
        ...currentGame,
        fen: data.fen,
        currentTurn: data.fen?.split(' ')?.[1] ?? 'w',
        status: newStatus,
        moveCount: newMoveCount,
      });

      if (data.move) {
        useGameStore.getState().addMove(data.move);
        if (data.move.from && data.move.to) {
          useGameStore.getState().setLastMove({ from: data.move.from, to: data.move.to });
        }
      }
      if (typeof data.whiteTime === 'number' && typeof data.blackTime === 'number') {
        useGameStore.getState().updateTimes(data.whiteTime, data.blackTime);
      }

      // If move resulted in game completion, trigger game over immediately
      if (newStatus === 'COMPLETED' && data.result) {
        useGameStore.getState().endGame(data.result, data.reason ?? 'normal');
        if (timerRef.current) clearInterval(timerRef.current);
      }
    });

    socket.on('chat_message', (msg: any) => {
      useGameStore.getState().addChatMessage(msg);
    });

    socket.on('draw_offered', ({ offeredBy }: { offeredBy: string }) => {
      useGameStore.getState().setDrawOffer(offeredBy);
    });

    socket.on('game_over', (data: { result: string; reason?: string }) => {
      useGameStore.getState().endGame(data.result, data.reason);
      if (timerRef.current) clearInterval(timerRef.current);
    });

    socket.on('player_disconnected', () => {});
    socket.on('player_reconnected', () => {});

    socket.on('rematch_requested', (data: { gameId: string; requesterId: string }) => {
      setRematchRequesterId(data.requesterId);
      setRematchState('incoming');
    });

    socket.on('rematch_started', (data: { gameId: string }) => {
      // Navigate to new game — use window.location for hard redirect to reset all game state
      window.location.href = `/game/${data.gameId}`;
    });

    return () => {
      socket.off('game_joined');
      socket.off('move_made');
      socket.off('chat_message');
      socket.off('draw_offered');
      socket.off('game_over');
      socket.off('player_disconnected');
      socket.off('player_reconnected');
      socket.off('rematch_requested');
      socket.off('rematch_started');
    };
  }, [gameId]);

  // Client-side timer
  useEffect(() => {
    if (!game || game.status !== 'ACTIVE' || isGameOver) return;

    timerRef.current = setInterval(decrementTimer, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [game?.status, isGameOver]);

  const makeMove = useCallback(
    (from: string, to: string, promotion?: string) => {
      const socket = socketRef.current;
      if (!socket) return;
      const { game, whiteTime, blackTime } = useGameStore.getState();
      if (!game) return;
      const timeLeft = game.currentTurn === 'w' ? whiteTime : blackTime;
      socket.emit('make_move', { gameId, from, to, promotion, timeLeft });
    },
    [gameId],
  );

  const resign = useCallback(() => {
    socketRef.current?.emit('resign', { gameId });
  }, [gameId]);

  const offerDraw = useCallback(() => {
    socketRef.current?.emit('offer_draw', { gameId });
  }, [gameId]);

  const acceptDraw = useCallback(() => {
    socketRef.current?.emit('accept_draw', { gameId });
  }, [gameId]);

  const sendMessage = useCallback(
    (message: string) => {
      socketRef.current?.emit('send_message', { gameId, message });
    },
    [gameId],
  );

  const requestRematch = useCallback(() => {
    socketRef.current?.emit('request_rematch', { gameId });
    setRematchState('pending');
  }, [gameId]);

  const acceptRematch = useCallback(() => {
    if (!rematchRequesterId) return;
    socketRef.current?.emit('accept_rematch', { gameId, requesterId: rematchRequesterId });
  }, [gameId, rematchRequesterId]);

  return { makeMove, resign, offerDraw, acceptDraw, sendMessage, requestRematch, acceptRematch, rematchState };
}
