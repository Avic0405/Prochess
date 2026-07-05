'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import {
  ChevronLeft, ChevronRight, History, Swords,
  Trophy, Minus, DollarSign, Eye,
} from 'lucide-react';

const TIME_OPTIONS = [
  { label: 'All', value: '' },
  { label: '1 min', value: '1' },
  { label: '3 min', value: '3' },
  { label: '5 min', value: '5' },
  { label: '10 min', value: '10' },
  { label: '15 min', value: '15' },
  { label: '30 min', value: '30' },
];

import { API_BASE } from '@/lib/api';

function avatarUrl(avatar?: string | null) {
  if (!avatar) return null;
  return avatar.startsWith('http') ? avatar : `${API_BASE}${avatar}`;
}

function HistoryContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isHydrated } = useAuthStore();

  useEffect(() => {
    if (isHydrated && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isHydrated]);

  const page       = Number(searchParams.get('page') ?? '1');
  const result     = searchParams.get('result') ?? '';
  const gameType   = searchParams.get('gameType') ?? '';
  const timeMinutes = searchParams.get('timeMinutes') ?? '';

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value); else params.delete(key);
    if (key !== 'page') params.delete('page'); // reset pagination on filter change
    router.push(`${pathname}?${params.toString()}`);
  }

  const { data, isLoading } = useQuery({
    queryKey: ['game-history', page, result, gameType, timeMinutes],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (result)      params.set('result', result);
      if (gameType)    params.set('gameType', gameType);
      if (timeMinutes) params.set('timeMinutes', timeMinutes);
      return api.get(`/games/history?${params.toString()}`).then((r) => r.data);
    },
    enabled: isAuthenticated,
    placeholderData: (prev) => prev,
  });

  const games = data?.games ?? [];
  const totalPages = data?.pages ?? 1;
  const total = data?.total ?? 0;

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <History className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold">Game History</h1>
          <p className="text-sm text-muted-foreground">{total} completed games</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        {/* Result filter */}
        <FilterGroup label="Result">
          {[
            { label: 'All', value: '' },
            { label: 'Win',  value: 'win'  },
            { label: 'Loss', value: 'loss' },
            { label: 'Draw', value: 'draw' },
          ].map((opt) => (
            <FilterChip
              key={opt.value}
              active={result === opt.value}
              onClick={() => setParam('result', opt.value)}
            >
              {opt.label}
            </FilterChip>
          ))}
        </FilterGroup>

        {/* Type filter */}
        <FilterGroup label="Type">
          {[
            { label: 'All',  value: ''     },
            { label: 'Free', value: 'FREE' },
            { label: 'Paid', value: 'PAID' },
          ].map((opt) => (
            <FilterChip
              key={opt.value}
              active={gameType === opt.value}
              onClick={() => setParam('gameType', opt.value)}
            >
              {opt.label}
            </FilterChip>
          ))}
        </FilterGroup>

        {/* Time control filter */}
        <FilterGroup label="Time">
          {TIME_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.value}
              active={timeMinutes === opt.value}
              onClick={() => setParam('timeMinutes', opt.value)}
            >
              {opt.label}
            </FilterChip>
          ))}
        </FilterGroup>
      </div>

      {/* Game list */}
      <div className="bg-card border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-4 py-3 flex items-center gap-3 animate-pulse">
                <div className="w-8 h-8 bg-muted rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-muted rounded w-40" />
                  <div className="h-3 bg-muted rounded w-24" />
                </div>
                <div className="w-12 h-5 bg-muted rounded" />
              </div>
            ))}
          </div>
        ) : games.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Swords className="w-10 h-10 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">No games match these filters</p>
            <button
              onClick={() => router.push(pathname)}
              className="text-sm text-primary hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {games.map((game: any) => {
              const isWhite = game.whitePlayer?.id === user.id;
              const opponent = isWhite ? game.blackPlayer : game.whitePlayer;
              const myResult =
                (isWhite && game.result === 'WHITE_WINS') || (!isWhite && game.result === 'BLACK_WINS')
                  ? 'win'
                  : game.result === 'DRAW'
                  ? 'draw'
                  : 'loss';

              const av = avatarUrl(opponent?.avatar);
              const date = new Date(game.endedAt ?? game.createdAt).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric',
              });

              return (
                <div key={game.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group">
                  {/* Result badge */}
                  <div className={cn(
                    'w-10 shrink-0 text-center text-xs font-bold py-1 rounded',
                    myResult === 'win'  && 'bg-green-500/15 text-green-500',
                    myResult === 'loss' && 'bg-destructive/15 text-destructive',
                    myResult === 'draw' && 'bg-muted text-muted-foreground',
                  )}>
                    {myResult === 'win' ? 'Win' : myResult === 'loss' ? 'Loss' : 'Draw'}
                  </div>

                  {/* Opponent */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {av ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={av} alt={opponent?.username} className="w-7 h-7 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {(opponent?.username ?? '?')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{opponent?.username ?? 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{opponent?.rating ?? '—'} ELO</p>
                    </div>
                  </div>

                  {/* Meta — visible on sm+; on mobile show date only */}
                  <div className="flex flex-col sm:flex-row items-end sm:items-center gap-0.5 sm:gap-3 text-xs text-muted-foreground shrink-0">
                    <span className="hidden sm:inline">{game.timeMinutes}+{game.increment ?? 0}</span>
                    <span className="hidden sm:inline">{game.moveCount ?? 0} moves</span>
                    <span>{date}</span>
                  </div>

                  {/* Type badge — sm+ only */}
                  {game.type === 'PAID' ? (
                    <span className="hidden sm:flex items-center gap-1 text-xs text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full shrink-0">
                      <DollarSign className="w-3 h-3" /> Paid
                    </span>
                  ) : null}

                  {/* Result icon */}
                  <div className="shrink-0 text-muted-foreground hidden sm:block">
                    {myResult === 'win'  ? <Trophy className="w-4 h-4 text-yellow-500" /> :
                     myResult === 'draw' ? <Minus  className="w-4 h-4" /> :
                                          <span className="w-4 h-4 block" />}
                  </div>

                  {/* Review link — always visible (touch-friendly) */}
                  <Link
                    href={`/game/${game.id}/review`}
                    className="shrink-0 flex items-center gap-1 text-xs text-primary sm:opacity-0 sm:group-hover:opacity-100 transition-opacity px-2 py-1 rounded hover:bg-primary/10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Eye className="w-3.5 h-3.5" /> Review
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setParam('page', String(page - 1))}
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setParam('page', String(page + 1))}
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground font-medium w-10 shrink-0">{label}</span>
      <div className="flex gap-1">{children}</div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-muted/80',
      )}
    >
      {children}
    </button>
  );
}

export default function HistoryPage() {
  return (
    <Suspense>
      <HistoryContent />
    </Suspense>
  );
}
