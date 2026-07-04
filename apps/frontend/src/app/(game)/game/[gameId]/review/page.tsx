'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api, { API_BASE } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { ChessBoard } from '@/components/chess/ChessBoard';
import { MoveHistory } from '@/components/chess/MoveHistory';
import { Button } from '@/components/ui/Button';
import { getRatingColor } from '@/lib/utils';
import {
  ArrowLeft, ArrowRight, ChevronsLeft, ChevronsRight,
  FlipHorizontal, Trophy, Minus, Crown, Download,
} from 'lucide-react';

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function parseLastMove(uci?: string) {
  if (!uci || uci.length < 4) return null;
  return { from: uci.slice(0, 2), to: uci.slice(2, 4) };
}

function PlayerBar({
  username, avatar, rating, result, side, isBottom,
}: {
  username: string;
  avatar?: string | null;
  rating: number;
  result: string | null;
  side: 'white' | 'black';
  isBottom?: boolean;
}) {
  const won = (side === 'white' && result === 'WHITE_WINS') || (side === 'black' && result === 'BLACK_WINS');
  const drew = result === 'DRAW';
  const avatarUrl = avatar ? (avatar.startsWith('http') ? avatar : `${API_BASE}${avatar}`) : null;

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-xl bg-card border ${isBottom ? 'mt-1' : 'mb-1'}`}>
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={username} className="w-8 h-8 rounded-full object-cover" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
          {username[0].toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{username}</p>
        <p className={`text-xs ${getRatingColor(rating)}`}>{rating} ELO</p>
      </div>
      <div className="shrink-0">
        {won ? (
          <div className="flex items-center gap-1 text-yellow-500 text-xs font-bold">
            <Trophy className="w-3.5 h-3.5" /> Won
          </div>
        ) : drew ? (
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <Minus className="w-3.5 h-3.5" /> Draw
          </div>
        ) : (
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <span className="w-2 h-2 rounded-full bg-muted-foreground inline-block" />
          </div>
        )}
      </div>
      <div className={`w-4 h-4 rounded border-2 ${side === 'white' ? 'bg-white border-gray-300' : 'bg-gray-900 border-gray-600'}`} />
    </div>
  );
}

export default function ReviewPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const [moveIndex, setMoveIndex] = useState(-1); // -1 = starting position
  const [flipped, setFlipped] = useState(false);

  const { data: game, isLoading } = useQuery({
    queryKey: ['game-review', gameId],
    queryFn: () => api.get(`/games/${gameId}`).then((r) => r.data),
    staleTime: Infinity,
  });

  // Auto-flip board if user played black
  useEffect(() => {
    if (!game || !user) return;
    if (game.blackPlayerId === user.id) setFlipped(true);
    // Start at last move
    if (game.moves?.length > 0) setMoveIndex(game.moves.length - 1);
  }, [game, user]);

  const moves = game?.moves ?? [];
  const totalMoves = moves.length;

  const currentFen = moveIndex < 0 ? STARTING_FEN : (moves[moveIndex]?.fen ?? STARTING_FEN);
  const currentUci = moveIndex < 0 ? undefined : moves[moveIndex]?.uci;
  const lastMove = parseLastMove(currentUci);

  const goFirst = useCallback(() => setMoveIndex(-1), []);
  const goPrev  = useCallback(() => setMoveIndex((i) => Math.max(-1, i - 1)), []);
  const goNext  = useCallback(() => setMoveIndex((i) => Math.min(totalMoves - 1, i + 1)), [totalMoves]);
  const goLast  = useCallback(() => setMoveIndex(totalMoves - 1), [totalMoves]);

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft')  { e.preventDefault(); goPrev(); }
      if (e.key === 'ArrowRight') { e.preventDefault(); goNext(); }
      if (e.key === 'Home')       { e.preventDefault(); goFirst(); }
      if (e.key === 'End')        { e.preventDefault(); goLast(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goFirst, goPrev, goNext, goLast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!game) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Game not found</div>;
  }

  const white = game.whitePlayer;
  const black = game.blackPlayer;
  const topPlayer  = flipped ? white : black;
  const topSide    = flipped ? 'white' : 'black';
  const botPlayer  = flipped ? black : white;
  const botSide    = flipped ? 'black' : 'white';

  const moveLabel = moveIndex < 0
    ? 'Start'
    : `Move ${Math.ceil((moveIndex + 1) / 2)}${moveIndex % 2 === 0 ? ' (White)' : ' (Black)'}`;

  const downloadPgn = () => {
    const pgnResult =
      game.result === 'WHITE_WINS' ? '1-0' :
      game.result === 'BLACK_WINS' ? '0-1' :
      game.result === 'DRAW'       ? '1/2-1/2' : '*';

    const d = new Date(game.createdAt);
    const pgnDate = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;

    const headers = [
      `[Event "ProChess.live Game"]`,
      `[Site "ProChess.live"]`,
      `[Date "${pgnDate}"]`,
      `[White "${white?.username ?? 'Unknown'}"]`,
      `[Black "${black?.username ?? 'Unknown'}"]`,
      `[Result "${pgnResult}"]`,
      `[TimeControl "${game.timeMinutes * 60}+${game.increment ?? 0}"]`,
      `[WhiteElo "${white?.rating ?? '?'}"]`,
      `[BlackElo "${black?.rating ?? '?'}"]`,
    ].join('\n');

    // Build move text with soft line wrapping at 80 chars
    const tokens: string[] = [];
    moves.forEach((m: any, i: number) => {
      if (i % 2 === 0) tokens.push(`${Math.floor(i / 2) + 1}.`);
      tokens.push(m.san);
    });
    tokens.push(pgnResult);

    let line = '';
    const lines: string[] = [];
    for (const token of tokens) {
      if (line && line.length + 1 + token.length > 80) {
        lines.push(line);
        line = token;
      } else {
        line = line ? `${line} ${token}` : token;
      }
    }
    if (line) lines.push(line);

    const pgn = `${headers}\n\n${lines.join('\n')}\n`;
    const filename = `${white?.username ?? 'white'}_vs_${black?.username ?? 'black'}_${pgnDate}.pgn`;

    const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resultLabel =
    game.result === 'WHITE_WINS' ? `${white?.username} won` :
    game.result === 'BLACK_WINS' ? `${black?.username} won` :
    game.result === 'DRAW' ? 'Draw' : 'In progress';

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-sm truncate">
            {white?.username} vs {black?.username}
          </h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Crown className="w-3 h-3" /> {resultLabel}
            <span className="mx-1">·</span>
            {totalMoves} moves
            <span className="mx-1">·</span>
            {new Date(game.createdAt).toLocaleDateString()}
          </p>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
          {game.timeMinutes}+{game.increment}
        </span>
        <button
          onClick={downloadPgn}
          title="Download PGN"
          className="p-1.5 rounded-lg hover:bg-muted transition-colors flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Download className="w-4 h-4" />
          <span className="hidden sm:inline">PGN</span>
        </button>
      </div>

      {/* Main layout */}
      <div className="max-w-5xl mx-auto p-4 flex flex-col lg:flex-row gap-4">

        {/* Board column */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <PlayerBar
            username={topPlayer?.username ?? '?'}
            avatar={topPlayer?.avatar}
            rating={topPlayer?.rating ?? 0}
            result={game.result}
            side={topSide}
          />

          <div className="relative rounded-xl overflow-hidden shadow-2xl">
            <ChessBoard
              fen={currentFen}
              playerColor={flipped ? 'black' : 'white'}
              disabled
              silent
              lastMove={lastMove}
              boardFlipped={flipped}
            />
          </div>

          <PlayerBar
            username={botPlayer?.username ?? '?'}
            avatar={botPlayer?.avatar}
            rating={botPlayer?.rating ?? 0}
            result={game.result}
            side={botSide}
            isBottom
          />

          {/* Navigation controls */}
          <div className="bg-card border rounded-xl px-4 py-3 flex items-center gap-2">
            <button onClick={goFirst}  disabled={moveIndex < 0}  className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors" aria-label="First move"><ChevronsLeft  className="w-4 h-4" /></button>
            <button onClick={goPrev}   disabled={moveIndex < 0}  className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors" aria-label="Previous move"><ArrowLeft      className="w-4 h-4" /></button>
            <span className="flex-1 text-center text-sm font-medium tabular-nums">{moveLabel}</span>
            <button onClick={goNext}   disabled={moveIndex >= totalMoves - 1} className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors" aria-label="Next move"><ArrowRight     className="w-4 h-4" /></button>
            <button onClick={goLast}   disabled={moveIndex >= totalMoves - 1} className="p-2 rounded-lg hover:bg-muted disabled:opacity-30 transition-colors" aria-label="Last move"><ChevronsRight  className="w-4 h-4" /></button>
            <div className="w-px h-5 bg-border mx-1" />
            <button onClick={() => setFlipped((f) => !f)} className="p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Flip board"><FlipHorizontal className="w-4 h-4" /></button>
          </div>

          <p className="text-center text-xs text-muted-foreground hidden sm:block">
            Use ← → arrow keys to navigate · Click any move in the list
          </p>
          <p className="text-center text-xs text-muted-foreground sm:hidden">
            Tap any move in the list to jump to it
          </p>
        </div>

        {/* Move list column */}
        <div className="w-full lg:w-64 flex flex-col gap-3">
          <div className="bg-card border rounded-xl flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="font-semibold text-sm">Move List</h2>
              <span className="text-xs text-muted-foreground">{totalMoves} half-moves</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 max-h-[60vh] lg:max-h-none">
              {totalMoves === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-4">No moves recorded</p>
              ) : (
                <MoveHistory
                  moves={moves}
                  currentMoveIndex={moveIndex >= 0 ? moveIndex : undefined}
                  onMoveClick={(i) => setMoveIndex(i)}
                />
              )}
            </div>
          </div>

          {/* Back to game buttons */}
          <div className="flex gap-2">
            <Button asChild variant="outline" className="flex-1 text-sm">
              <a href={`/game/${gameId}`}>Back to Game</a>
            </Button>
            <Button asChild variant="ghost" className="flex-1 text-sm">
              <a href="/dashboard">Dashboard</a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
