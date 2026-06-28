import { create } from 'zustand';
import { Game, ChatMessage, Move } from '@/types';

interface GameState {
  game: Game | null;
  isMyTurn: boolean;
  playerColor: 'white' | 'black' | null;
  drawOfferedBy: string | null;
  isGameOver: boolean;
  gameResult: string | null;
  gameOverReason: string | null;
  whiteTime: number;
  blackTime: number;
  lastMove: { from: string; to: string } | null;

  setGame: (game: Game) => void;
  setPlayerColor: (color: 'white' | 'black') => void;
  addMove: (move: Move) => void;
  addChatMessage: (msg: ChatMessage) => void;
  updateTimes: (white: number, black: number) => void;
  setDrawOffer: (userId: string | null) => void;
  endGame: (result: string, reason?: string) => void;
  resetGame: () => void;
  decrementTimer: () => void;
  setLastMove: (move: { from: string; to: string } | null) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  game: null,
  isMyTurn: false,
  playerColor: null,
  drawOfferedBy: null,
  isGameOver: false,
  gameResult: null,
  gameOverReason: null,
  whiteTime: 0,
  blackTime: 0,
  lastMove: null,

  setGame: (game) =>
    set({
      game,
      whiteTime: game.whiteTimeLeft,
      blackTime: game.blackTimeLeft,
      isGameOver: game.status === 'COMPLETED',
      lastMove: null,
    }),

  setPlayerColor: (color) => set({ playerColor: color }),

  addMove: (move) =>
    set((state) => ({
      game: state.game
        ? { ...state.game, moves: [...state.game.moves, move], moveCount: move.moveNum }
        : null,
    })),

  addChatMessage: (msg) =>
    set((state) => ({
      game: state.game
        ? { ...state.game, chatMessages: [...state.game.chatMessages, msg] }
        : null,
    })),

  updateTimes: (white, black) => set({ whiteTime: white, blackTime: black }),

  setDrawOffer: (userId) => set({ drawOfferedBy: userId }),

  endGame: (result, reason) =>
    set({ isGameOver: true, gameResult: result, gameOverReason: reason ?? null }),

  resetGame: () =>
    set({
      game: null,
      isMyTurn: false,
      playerColor: null,
      drawOfferedBy: null,
      isGameOver: false,
      gameResult: null,
      gameOverReason: null,
      whiteTime: 0,
      blackTime: 0,
      lastMove: null,
    }),

  setLastMove: (move) => set({ lastMove: move }),

  decrementTimer: () => {
    const { game, whiteTime, blackTime, isGameOver } = get();
    if (!game || game.status !== 'ACTIVE' || isGameOver) return;
    if (game.currentTurn === 'w') {
      set({ whiteTime: Math.max(0, whiteTime - 1) });
    } else {
      set({ blackTime: Math.max(0, blackTime - 1) });
    }
  },
}));
