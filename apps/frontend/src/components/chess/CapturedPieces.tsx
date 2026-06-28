import { useMemo } from 'react';
import { Chess } from 'chess.js';
import { cn } from '@/lib/utils';

const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

const PIECE_SYMBOLS: Record<string, string> = {
  p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚',
};

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

interface CapturedPiecesProps {
  fen?: string | null;
  color: 'white' | 'black';
  className?: string;
}

export function CapturedPieces({ fen, color, className }: CapturedPiecesProps) {
  const { pieces, advantage } = useMemo(() => {
    const safeFen = (fen && fen.trim()) ? fen : STARTING_FEN;
    let chess: Chess;
    try {
      chess = new Chess(safeFen);
    } catch {
      chess = new Chess();
    }

    const initial: Record<string, number> = { p: 8, n: 2, b: 2, r: 2, q: 1 };
    const counts: Record<string, Record<string, number>> = { w: {}, b: {} };

    for (const row of chess.board()) {
      for (const sq of row) {
        if (!sq) continue;
        counts[sq.color][sq.type] = (counts[sq.color][sq.type] ?? 0) + 1;
      }
    }

    // "color" player captured opponent's pieces
    const opponentColor = color === 'white' ? 'b' : 'w';
    const captured: string[] = [];
    let advantage = 0;

    for (const [type, initCount] of Object.entries(initial)) {
      const remaining = counts[opponentColor][type] ?? 0;
      const capturedCount = initCount - remaining;
      for (let i = 0; i < capturedCount; i++) {
        captured.push(type);
        advantage += PIECE_VALUES[type] ?? 0;
      }
    }

    // Subtract opponent's advantage
    const myColor = color === 'white' ? 'w' : 'b';
    for (const [type, initCount] of Object.entries(initial)) {
      const remaining = counts[myColor][type] ?? 0;
      const capturedByOpp = initCount - remaining;
      advantage -= capturedByOpp * (PIECE_VALUES[type] ?? 0);
    }

    // Sort by value descending
    captured.sort((a, b) => (PIECE_VALUES[b] ?? 0) - (PIECE_VALUES[a] ?? 0));

    return { pieces: captured, advantage };
  }, [fen, color]);

  if (pieces.length === 0 && advantage <= 0) return null;

  return (
    <div className={cn('flex items-center gap-1 min-h-[20px]', className)}>
      <div className="flex flex-wrap gap-0">
        {pieces.map((type, i) => (
          <span
            key={i}
            className={cn(
              'text-sm leading-none',
              color === 'white' ? 'text-gray-800 dark:text-gray-200' : 'text-gray-600 dark:text-gray-400',
            )}
            style={{ fontSize: '14px', lineHeight: 1 }}
          >
            {PIECE_SYMBOLS[type]}
          </span>
        ))}
      </div>
      {advantage > 0 && (
        <span className="text-xs text-muted-foreground font-medium ml-1">+{advantage}</span>
      )}
    </div>
  );
}
