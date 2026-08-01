'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { Chessboard } from 'react-chessboard';
import { Chess, Square } from 'chess.js';
import { cn } from '@/lib/utils';
import { playChessSound, countFenPieces } from '@/lib/chessSounds';

const BOARD_COLORS = {
  light: '#F0D9B5',
  dark: '#B58863',
};

const PROMO_PIECES = [
  { piece: 'q' as const, label: '♛', name: 'Queen' },
  { piece: 'r' as const, label: '♜', name: 'Rook' },
  { piece: 'b' as const, label: '♝', name: 'Bishop' },
  { piece: 'n' as const, label: '♞', name: 'Knight' },
];

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

interface ChessBoardProps {
  fen?: string | null;
  playerColor?: 'white' | 'black';
  onMove?: (from: string, to: string, promotion?: string) => void;
  disabled?: boolean;
  lastMove?: { from: string; to: string } | null;
  boardFlipped?: boolean;
  silent?: boolean;
  /** Fires whenever the promotion-piece picker opens/closes — lets a caller
   * (e.g. bot mode's clock) pause while the player is mid-decision. Optional
   * and unused by the online game page, so this has no effect there. */
  onPromotionPending?: (pending: boolean) => void;
}

export function ChessBoard({
  fen,
  playerColor = 'white',
  onMove,
  disabled = false,
  lastMove,
  boardFlipped = false,
  silent = false,
  onPromotionPending,
}: ChessBoardProps) {
  // react-chessboard crashes if position is null/undefined — always use valid FEN
  const safeFen = (fen && fen.trim()) ? fen : STARTING_FEN;

  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalSquares, setLegalSquares] = useState<Record<string, React.CSSProperties>>({});
  const [pendingPromotion, setPendingPromotion] = useState<{ from: Square; to: Square } | null>(null);

  useEffect(() => {
    onPromotionPending?.(!!pendingPromotion);
  }, [pendingPromotion, onPromotionPending]);

  const chess = useMemo(() => {
    try {
      return new Chess(safeFen);
    } catch {
      return new Chess();
    }
  }, [safeFen]);

  const orientation = boardFlipped
    ? playerColor === 'white' ? 'black' : 'white'
    : playerColor;

  const checkSquare = useMemo(() => {
    if (!chess.inCheck()) return null;
    const turn = chess.turn();
    for (const row of chess.board()) {
      for (const sq of row) {
        if (sq?.type === 'k' && sq.color === turn) return sq.square as string;
      }
    }
    return null;
  }, [safeFen]);

  const computeLegalSquares = useCallback(
    (square: Square): Record<string, React.CSSProperties> => {
      const moves = chess.moves({ square, verbose: true });
      const result: Record<string, React.CSSProperties> = {};
      moves.forEach((m) => {
        const isCapture = !!chess.get(m.to as Square);
        result[m.to] = isCapture
          ? {
              background:
                'radial-gradient(circle, transparent 56%, rgba(20,85,30,0.25) 56%)',
              borderRadius: '50%',
            }
          : {
              background: 'radial-gradient(circle, rgba(20,85,30,0.35) 25%, transparent 25%)',
              borderRadius: '50%',
            };
      });
      return result;
    },
    [safeFen],
  );

  const customSquareStyles = useMemo((): Record<string, React.CSSProperties> => {
    const styles: Record<string, React.CSSProperties> = {};

    if (lastMove?.from)
      styles[lastMove.from] = { background: 'rgba(155,199,0,0.41)' };
    if (lastMove?.to)
      styles[lastMove.to] = { background: 'rgba(155,199,0,0.41)' };

    if (checkSquare)
      styles[checkSquare] = {
        background:
          'radial-gradient(circle, rgba(255,0,0,0.85) 0%, rgba(255,0,0,0.4) 40%, transparent 70%)',
      };

    if (selectedSquare)
      styles[selectedSquare] = { background: 'rgba(20,85,30,0.5)' };

    Object.assign(styles, legalSquares);
    return styles;
  }, [lastMove, checkSquare, selectedSquare, legalSquares]);

  const onSquareClick = useCallback(
    (square: Square) => {
      if (disabled || !onMove) return;

      const myColor = playerColor === 'white' ? 'w' : 'b';

      if (selectedSquare === square) {
        setSelectedSquare(null);
        setLegalSquares({});
        return;
      }

      if (selectedSquare) {
        const piece = chess.get(selectedSquare);
        const legalMove = chess
          .moves({ square: selectedSquare, verbose: true })
          .find((m) => m.to === square);

        if (legalMove) {
          const isPromotion =
            piece?.type === 'p' &&
            ((piece.color === 'w' && square[1] === '8') ||
              (piece.color === 'b' && square[1] === '1'));

          if (isPromotion) {
            setPendingPromotion({ from: selectedSquare, to: square });
            setSelectedSquare(null);
            setLegalSquares({});
            return;
          }

          onMove(selectedSquare, square);
          setSelectedSquare(null);
          setLegalSquares({});
          return;
        }
      }

      const piece = chess.get(square);
      if (piece && piece.color === myColor && chess.turn() === myColor) {
        setSelectedSquare(square);
        setLegalSquares(computeLegalSquares(square));
      } else {
        setSelectedSquare(null);
        setLegalSquares({});
      }
    },
    [selectedSquare, disabled, playerColor, safeFen, onMove, computeLegalSquares, chess],
  );

  const onPieceDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square, piece: string): boolean => {
      if (disabled || !onMove) return false;

      const isPromotion =
        (piece === 'wP' && targetSquare[1] === '8') ||
        (piece === 'bP' && targetSquare[1] === '1');

      const legalMove = chess
        .moves({ square: sourceSquare, verbose: true })
        .find((m) => m.to === targetSquare);

      if (!legalMove) return false;

      if (isPromotion) {
        setPendingPromotion({ from: sourceSquare, to: targetSquare });
        setSelectedSquare(null);
        setLegalSquares({});
        return false;
      }

      onMove(sourceSquare, targetSquare);
      setSelectedSquare(null);
      setLegalSquares({});
      return true;
    },
    [disabled, safeFen, onMove, chess],
  );

  const handlePromotion = (piece: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion || !onMove) return;
    onMove(pendingPromotion.from, pendingPromotion.to, piece);
    setPendingPromotion(null);
  };

  // ── Sound effects ──────────────────────────────────────
  const prevFenRef = useRef<string | null>(null);
  const gameEndPlayedRef = useRef(false);

  useEffect(() => {
    // Skip the initial mount — only react to actual FEN transitions
    if (prevFenRef.current === null) {
      prevFenRef.current = safeFen;
      return;
    }
    if (prevFenRef.current === safeFen) return;

    const prev = prevFenRef.current;
    prevFenRef.current = safeFen;

    if (silent) return;

    if (chess.isGameOver()) {
      if (!gameEndPlayedRef.current) {
        gameEndPlayedRef.current = true;
        playChessSound('game_end');
      }
    } else if (chess.inCheck()) {
      playChessSound('check');
    } else if (countFenPieces(safeFen) < countFenPieces(prev)) {
      playChessSound('capture');
    } else {
      playChessSound('move');
    }
  }, [safeFen, silent]);

  // Reset game-end guard when a fresh game loads (piece count jumps back to 32)
  useEffect(() => {
    if (countFenPieces(safeFen) === 32) {
      gameEndPlayedRef.current = false;
    }
  }, [safeFen]);

  return (
    <div className="relative w-full select-none">
      <Chessboard
        position={safeFen}
        onSquareClick={onSquareClick}
        onPieceDrop={onPieceDrop}
        boardOrientation={orientation}
        arePiecesDraggable={!disabled}
        customSquareStyles={customSquareStyles}
        customBoardStyle={{
          borderRadius: '4px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
        customDarkSquareStyle={{ backgroundColor: BOARD_COLORS.dark }}
        customLightSquareStyle={{ backgroundColor: BOARD_COLORS.light }}
        animationDuration={120}
        showBoardNotation
        areArrowsAllowed
      />

      {pendingPromotion && (
        <div className="absolute inset-0 bg-black/75 flex items-center justify-center rounded z-50">
          <div className="bg-[#2b2b2b] border border-white/20 rounded-xl p-5 space-y-3 shadow-2xl">
            <p className="text-white text-sm font-semibold text-center tracking-wide">
              Promote Pawn
            </p>
            <div className="flex gap-3">
              {PROMO_PIECES.map(({ piece, label, name }) => (
                <button
                  key={piece}
                  onClick={() => handlePromotion(piece)}
                  title={name}
                  className="w-14 h-14 bg-[#F0D9B5] hover:bg-[#B58863] rounded-lg text-3xl flex items-center justify-center transition-all hover:scale-110 active:scale-95 shadow-lg"
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPendingPromotion(null)}
              className="w-full text-xs text-white/50 hover:text-white/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
