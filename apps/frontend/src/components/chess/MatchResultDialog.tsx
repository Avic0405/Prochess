'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { cn, formatCurrency } from '@/lib/utils';
import { Game } from '@/types';
import type { RematchState } from '@/hooks/useGame';
import {
  Trophy, Minus, X, RotateCcw, Home, Loader2, Swords,
  BookOpen, Share2, Wallet, Clock, Hash, Calendar, DollarSign,
} from 'lucide-react';
import { toast } from '@/hooks/useToast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatchResultDialogProps {
  open: boolean;
  onClose: () => void;
  result: string;
  reason?: string | null;
  game: Game | null;
  userId?: string;
  onRematch?: () => void;
  onAcceptRematch?: () => void;
  rematchState?: RematchState;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REASON_LABELS: Record<string, string> = {
  checkmate:             'Checkmate',
  resignation:           'Resignation',
  timeout:               'Timeout',
  disconnect:            'Opponent Disconnected',
  draw_accepted:         'Draw Agreed',
  stalemate:             'Stalemate',
  insufficient_material: 'Insufficient Material',
  threefold_repetition:  'Threefold Repetition',
  fifty_move_rule:       '50-Move Rule',
  abandoned:             'Game Abandoned',
  cancelled:             'Cancelled',
};

const CUR_SYM: Record<string, string> = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

const CONFETTI_COLORS = [
  '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1',
  '#96CEB4', '#FFEAA7', '#DDA0DD', '#98FB98',
  '#F0E68C', '#87CEEB',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(start?: string | null, end?: string | null): string {
  if (!start) return '—';
  const ms  = (end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime();
  const m   = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatGameDate(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

function Confetti() {
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl"
      aria-hidden="true"
    >
      {Array.from({ length: 44 }, (_, i) => {
        const left   = `${(i * 7 + 5) % 100}%`;
        const delay  = `${(i * 0.135) % 2.3}s`;
        const dur    = `${2.7 + (i * 0.11) % 1.5}s`;
        const color  = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
        const size   = `${6 + (i * 2) % 7}px`;
        const rotate = `${(i * 41) % 360}deg`;
        const radius = i % 3 === 0 ? '50%' : i % 3 === 1 ? '2px' : '0';
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              left,
              width: size,
              height: size,
              backgroundColor: color,
              borderRadius: radius,
              transform: `rotate(${rotate})`,
              animation: `confettiFall ${dur} ${delay} ease-in forwards`,
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Coin Burst (Paid Win) ────────────────────────────────────────────────────

function CoinBurst() {
  const xOffsets = [-72, -46, -22, 4, 28, 54, -58, 16];
  return (
    <div
      className="absolute pointer-events-none"
      style={{ bottom: '40%', left: '50%', transform: 'translateX(-50%)' }}
      aria-hidden="true"
    >
      {xOffsets.map((x, i) => (
        <div
          key={i}
          className="absolute w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold select-none"
          style={{
            marginLeft: `${x}px`,
            background: 'radial-gradient(circle at 35% 30%, #FFE066, #F59E0B)',
            boxShadow: '0 2px 8px rgba(245,158,11,0.55)',
            color: '#78350F',
            opacity: 0,
            animation: `coinFloatUp ${1.25 + i * 0.06}s ${i * 0.09}s ease-out forwards`,
          }}
        >
          ¢
        </div>
      ))}
    </div>
  );
}

// ─── Player Avatar ────────────────────────────────────────────────────────────

function PlayerAvatar({
  username,
  color,
  isWinner,
}: {
  username?: string;
  color: 'white' | 'black';
  isWinner?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          'w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold border-2 transition-all duration-300',
          color === 'white'
            ? 'bg-gray-100 text-gray-900 border-gray-300'
            : 'bg-gray-800 text-white border-gray-600',
          isWinner && 'ring-4 ring-yellow-500/55 scale-110',
        )}
        aria-label={`${username ?? 'Player'} — ${color} pieces`}
      >
        {username?.[0]?.toUpperCase() ?? '?'}
      </div>
      <span className="text-xs text-gray-300 truncate max-w-[72px] text-center leading-tight">
        {username ?? '—'}
      </span>
      {isWinner && (
        <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-wider">
          Winner
        </span>
      )}
    </div>
  );
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────

function StatTile({
  icon,
  label,
  value,
  gold = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  gold?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-xl px-3 py-2.5',
        gold ? 'bg-yellow-500/10' : 'bg-white/[0.05]',
      )}
    >
      <span className={cn('shrink-0', gold ? 'text-yellow-500' : 'text-gray-500')}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 leading-tight">
          {label}
        </p>
        <p
          className={cn(
            'text-sm font-semibold truncate leading-tight mt-0.5',
            gold ? 'text-yellow-400' : 'text-white',
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MatchResultDialog({
  open,
  onClose,
  result,
  reason,
  game,
  userId,
  onRematch,
  onAcceptRematch,
  rematchState = 'idle',
}: MatchResultDialogProps) {
  const [copied, setCopied] = useState(false);

  const isWhite = game?.whitePlayerId === userId;
  const won     = (isWhite && result === 'WHITE_WINS') || (!isWhite && result === 'BLACK_WINS');
  const drew    = result === 'DRAW' || result === 'ABANDONED';
  const lost    = !won && !drew;

  const isPaid   = game?.type === 'PAID';
  const currency = game?.currency ?? 'USD';
  const stake    = game?.stake != null ? Number(game.stake) : null;
  const prize    = stake != null ? stake * 2 * 0.9 : null; // 90% of 2× pot

  // Fetch wallet after game ends (for paid match balance display)
  const { data: wallets, isLoading: walletsLoading } = useQuery<any[]>({
    queryKey: ['wallets'],
    queryFn: () => api.get('/wallet').then((r) => r.data),
    enabled: open && isPaid,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
  const walletBalance: number | null = (() => {
    if (!wallets) return null;
    const w = wallets.find((w: any) => w.currency === currency) ?? wallets[0];
    const n = Number(w?.balance);
    return Number.isFinite(n) ? n : null;
  })();

  const myPlayer = isWhite ? game?.whitePlayer : game?.blackPlayer;
  const currSym  = CUR_SYM[currency] ?? '$';
  const reasonLabel = reason
    ? (REASON_LABELS[reason] ?? reason.replace(/_/g, ' '))
    : null;

  // ── Share ──────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    const opName = (isWhite ? game?.blackPlayer?.username : game?.whitePlayer?.username) ?? 'opponent';
    const text = won
      ? (isPaid && prize
          ? `🏆 I just won a Paid Match on ProChess and earned ${currSym}${prize.toFixed(2)}! 🎉${reasonLabel ? ` (${reasonLabel})` : ''}`
          : `🏆 Beat ${opName} on ProChess${reasonLabel ? ` by ${reasonLabel}` : ''}! ♟️`)
      : drew
        ? `🤝 My ProChess match ended in a Draw${reasonLabel ? ` — ${reasonLabel}` : ''}. Well played!`
        : `♟️ Great game on ProChess${reasonLabel ? `. Lost by ${reasonLabel}` : ''}. GG!`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: 'Copied to clipboard', description: 'Paste it anywhere to share!' });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast({ title: 'Share text', description: text });
    }
  };

  // ── Theming ────────────────────────────────────────────────────────────────
  const cardBg = won
    ? 'bg-gradient-to-b from-[#1f1800] via-[#181600] to-[#141414]'
    : drew
      ? 'bg-[#141414]'
      : 'bg-gradient-to-b from-[#180c0c] via-[#141212] to-[#141414]';

  const borderCls = won
    ? 'border-yellow-500/25 result-glow-win'
    : 'border-white/10';

  const titleText = won
    ? (isPaid && prize ? `You Won ${currSym}${prize.toFixed(2)}!` : 'You Won!')
    : drew
      ? 'Game Drawn'
      : 'Good Game!';

  const subtitleText = won
    ? (myPlayer?.username ? `Congratulations, ${myPlayer.username}!` : 'Congratulations!')
    : drew
      ? (reasonLabel ?? 'The game ended in a draw.')
      : 'Better luck next time!';

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        {/* ── Backdrop ── */}
        <Dialog.Overlay
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-[3px] animate-in fade-in duration-200"
          // Backdrop click intentionally does NOT close — use X or ESC
          onPointerDown={(e) => e.preventDefault()}
        />

        {/* ── Panel ── */}
        <Dialog.Content
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 outline-none"
          onEscapeKeyDown={onClose}
          onPointerDownOutside={(e) => e.preventDefault()}
          aria-describedby="mrd-desc"
        >
          <div
            className={cn(
              'relative w-full max-w-[420px] rounded-2xl border shadow-2xl overflow-hidden',
              'animate-in zoom-in-95 fade-in slide-in-from-bottom-3 duration-300',
              cardBg,
              borderCls,
            )}
          >
            {/* Animations */}
            {won && <Confetti />}
            {won && isPaid && stake && <CoinBurst />}

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 z-20 w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-white/30"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Scrollable content */}
            <div
              className="relative z-10 p-5 sm:p-6 overflow-y-auto"
              style={{ maxHeight: 'min(92vh, 680px)' }}
            >
              <div className="space-y-5">

                {/* ── Icon ── */}
                <div className="flex justify-center pt-1">
                  {won ? (
                    <div className="relative flex items-center justify-center">
                      <div className="w-20 h-20 rounded-full bg-yellow-500/15 flex items-center justify-center animate-trophy-bounce">
                        <Trophy className="w-10 h-10 text-yellow-500" />
                      </div>
                      {/* Ping ring — starts after bounce settles */}
                      <div
                        className="absolute inset-0 rounded-full bg-yellow-500/10 animate-ping"
                        style={{ animationDelay: '0.85s', animationDuration: '2.5s' }}
                        aria-hidden="true"
                      />
                    </div>
                  ) : drew ? (
                    <div className="w-20 h-20 rounded-full bg-gray-500/15 flex items-center justify-center">
                      <Minus className="w-10 h-10 text-gray-400" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center">
                      <X className="w-10 h-10 text-red-400/80" />
                    </div>
                  )}
                </div>

                {/* ── Title ── */}
                <div className="text-center space-y-1.5">
                  <Dialog.Title asChild>
                    <h2
                      className={cn(
                        'text-2xl font-bold tracking-tight',
                        won ? 'text-yellow-400' : drew ? 'text-gray-200' : 'text-gray-200',
                      )}
                    >
                      {titleText}
                    </h2>
                  </Dialog.Title>

                  <p className="text-gray-400 text-sm">{subtitleText}</p>

                  {won && reasonLabel && !drew && (
                    <p className="text-xs font-semibold text-yellow-600/80 uppercase tracking-widest">
                      {reasonLabel}
                    </p>
                  )}
                  {lost && reasonLabel && (
                    <p className="text-xs text-gray-500 uppercase tracking-wider">
                      Lost by {reasonLabel}
                    </p>
                  )}

                  <p id="mrd-desc" className="sr-only">
                    Match result: {won ? 'Victory' : drew ? 'Draw' : 'Defeat'}
                    {reasonLabel ? `, by ${reasonLabel}` : ''}.
                  </p>
                </div>

                {/* ── Players ── */}
                {game?.whitePlayer && game?.blackPlayer && (
                  <div className="flex items-center justify-between bg-white/[0.04] rounded-xl px-4 py-3 border border-white/5">
                    <PlayerAvatar
                      username={game.whitePlayer.username}
                      color="white"
                      isWinner={result === 'WHITE_WINS'}
                    />
                    <div className="flex flex-col items-center gap-1.5 px-3">
                      <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                        vs
                      </span>
                      <div className="w-px h-5 bg-white/10" aria-hidden="true" />
                    </div>
                    <PlayerAvatar
                      username={game.blackPlayer.username}
                      color="black"
                      isWinner={result === 'BLACK_WINS'}
                    />
                  </div>
                )}

                {/* ── Stats grid ── */}
                <div className="grid grid-cols-2 gap-2">
                  <StatTile
                    icon={<Hash className="w-3.5 h-3.5" />}
                    label="Moves"
                    value={String(game?.moveCount ?? '—')}
                  />
                  <StatTile
                    icon={<Clock className="w-3.5 h-3.5" />}
                    label="Duration"
                    value={formatDuration(game?.startedAt, game?.endedAt)}
                  />
                  <StatTile
                    icon={<DollarSign className="w-3.5 h-3.5" />}
                    label="Match Type"
                    value={isPaid ? 'Paid Match' : 'Free Match'}
                    gold={isPaid}
                  />
                  <StatTile
                    icon={<Calendar className="w-3.5 h-3.5" />}
                    label="Date"
                    value={formatGameDate(game?.endedAt ?? game?.startedAt)}
                  />
                </div>

                {/* ── Paid financials ── */}
                {isPaid && stake != null && (
                  <div
                    className={cn(
                      'rounded-xl p-4 border space-y-2.5',
                      won
                        ? 'bg-gradient-to-br from-yellow-500/10 to-green-500/5 border-yellow-500/20'
                        : 'bg-white/[0.04] border-white/8',
                    )}
                  >
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      Match Financials · {currency}
                    </p>

                    <div className="space-y-1.5 text-sm">
                      <Row label="Entry Fee" value={`${currSym}${stake.toFixed(2)}`} />

                      {won && prize != null && (
                        <Row
                          label="Prize Won"
                          value={`+${currSym}${prize.toFixed(2)}`}
                          valueClass="font-bold text-green-400 animate-wallet-pop"
                        />
                      )}
                      {lost && (
                        <Row
                          label="Stake Lost"
                          value={`-${currSym}${stake.toFixed(2)}`}
                          valueClass="text-red-400"
                        />
                      )}
                      {drew && (
                        <Row
                          label="Stake Refunded"
                          value={`${currSym}${stake.toFixed(2)}`}
                          valueClass="text-yellow-400"
                        />
                      )}

                      <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                        <span className="text-gray-300 font-medium">Wallet Balance</span>
                        {walletsLoading ? (
                          <span className="flex items-center gap-1 text-gray-500 text-xs">
                            <Loader2 className="w-3 h-3 animate-spin" /> Loading…
                          </span>
                        ) : walletBalance != null ? (
                          <span
                            className={cn(
                              'font-bold text-sm',
                              won ? 'text-green-400' : 'text-white',
                            )}
                          >
                            {formatCurrency(walletBalance, currency)}
                          </span>
                        ) : (
                          <span className="text-gray-500 text-xs">—</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Action buttons ── */}
                <div className="space-y-2 pt-1" role="group" aria-label="Post-match actions">

                  {/* Rematch (state-aware) */}
                  {onRematch && rematchState === 'idle' && (
                    <Button
                      onClick={onRematch}
                      autoFocus
                      className={cn(
                        'w-full gap-2 font-semibold',
                        won ? 'bg-yellow-500 hover:bg-yellow-400 text-black' : '',
                      )}
                    >
                      <RotateCcw className="w-4 h-4" /> Rematch
                    </Button>
                  )}
                  {rematchState === 'pending' && (
                    <Button disabled className="w-full gap-2 opacity-60">
                      <Loader2 className="w-4 h-4 animate-spin" /> Waiting for opponent…
                    </Button>
                  )}
                  {rematchState === 'incoming' && onAcceptRematch && (
                    <Button
                      onClick={onAcceptRematch}
                      autoFocus
                      className="w-full gap-2 bg-green-600 hover:bg-green-500 font-semibold"
                    >
                      <Swords className="w-4 h-4" /> Accept Rematch
                    </Button>
                  )}

                  {/* Review + Wallet (paid win shows both) */}
                  <div
                    className={cn(
                      'grid gap-2',
                      isPaid && won ? 'grid-cols-2' : 'grid-cols-1',
                    )}
                  >
                    {game?.id && (
                      <Button asChild variant="outline" className="gap-1.5 w-full">
                        <Link href={`/game/${game.id}/review`}>
                          <BookOpen className="w-4 h-4" /> Review
                        </Link>
                      </Button>
                    )}
                    {isPaid && won && (
                      <Button
                        asChild
                        variant="outline"
                        className="gap-1.5 w-full border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10 hover:border-yellow-500/50"
                      >
                        <Link href="/wallet">
                          <Wallet className="w-4 h-4" /> Wallet
                        </Link>
                      </Button>
                    )}
                  </div>

                  {/* New Game + Home */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button asChild variant="secondary" className="gap-1.5">
                      <Link href="/lobby">
                        <Swords className="w-4 h-4" /> New Game
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="ghost"
                      className="gap-1.5 text-gray-400 hover:text-white"
                    >
                      <Link href="/dashboard">
                        <Home className="w-4 h-4" /> Home
                      </Link>
                    </Button>
                  </div>

                  {/* Share */}
                  <Button
                    onClick={handleShare}
                    variant="ghost"
                    className="w-full gap-2 text-gray-500 hover:text-gray-200 text-sm"
                    aria-label="Share match result"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    {copied ? '✓ Copied to clipboard' : 'Share Result'}
                  </Button>
                </div>

              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ─── Row helper ───────────────────────────────────────────────────────────────

function Row({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-400">{label}</span>
      <span className={cn('font-medium text-white', valueClass)}>{value}</span>
    </div>
  );
}
