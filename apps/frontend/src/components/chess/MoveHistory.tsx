'use client';

import { useEffect, useRef } from 'react';
import { Move } from '@/types';
import { cn } from '@/lib/utils';

interface MoveHistoryProps {
  moves: Move[];
  currentMoveIndex?: number;
  onMoveClick?: (index: number) => void;
}

export function MoveHistory({ moves, currentMoveIndex, onMoveClick }: MoveHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastMoveRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    lastMoveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [currentMoveIndex]);

  if (moves.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground text-sm">Game moves will appear here</p>
      </div>
    );
  }

  const pairs: Array<{ num: number; white?: Move; black?: Move }> = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({ num: Math.ceil((i + 1) / 2), white: moves[i], black: moves[i + 1] });
  }

  const lastIdx = moves.length - 1;

  return (
    <div ref={scrollRef} className="space-y-0.5 font-mono text-sm">
      {pairs.map(({ num, white, black }) => {
        const whiteIdx = (num - 1) * 2;
        const blackIdx = whiteIdx + 1;
        const isWhiteActive = currentMoveIndex !== undefined
          ? currentMoveIndex === whiteIdx
          : whiteIdx === lastIdx;
        const isBlackActive = currentMoveIndex !== undefined
          ? currentMoveIndex === blackIdx
          : blackIdx === lastIdx;

        return (
          <div key={num} className="flex items-center gap-1 rounded">
            <span className="w-7 text-right text-muted-foreground/60 text-xs shrink-0 select-none">
              {num}.
            </span>
            <span
              ref={isWhiteActive ? lastMoveRef : undefined}
              onClick={() => onMoveClick?.(whiteIdx)}
              className={cn(
                'flex-1 px-2 py-0.5 rounded transition-colors',
                onMoveClick ? 'cursor-pointer hover:bg-muted/80' : '',
                isWhiteActive && 'bg-primary/20 text-primary font-semibold',
              )}
            >
              {white?.san ?? ''}
            </span>
            <span
              ref={isBlackActive ? lastMoveRef : undefined}
              onClick={() => black && onMoveClick?.(blackIdx)}
              className={cn(
                'flex-1 px-2 py-0.5 rounded transition-colors',
                onMoveClick && black ? 'cursor-pointer hover:bg-muted/80' : '',
                isBlackActive && 'bg-primary/20 text-primary font-semibold',
                !black && 'invisible',
              )}
            >
              {black?.san ?? ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}
