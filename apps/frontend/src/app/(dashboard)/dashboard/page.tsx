'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { formatCurrency, getRatingColor } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Trophy, Swords, Users, TrendingUp, Clock, DollarSign } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated]);

  const { data: stats } = useQuery({
    queryKey: ['my-stats'],
    queryFn: () => api.get('/users/me').then((r) => r.data),
    enabled: isAuthenticated,
  });

  const { data: recentGames } = useQuery({
    queryKey: ['recent-games'],
    queryFn: () => api.get('/games/history?limit=5').then((r) => r.data),
    enabled: isAuthenticated,
  });

  if (!user) return null;

  const winRate = user.gamesPlayed > 0
    ? Math.round((user.wins / user.gamesPlayed) * 100)
    : 0;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-primary/20 to-primary/5 border border-primary/20 rounded-xl p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Welcome, {user.username}!</h1>
            <p className={`text-base sm:text-lg font-semibold mt-1 ${getRatingColor(user.rating)}`}>
              Rating: {user.rating}
            </p>
          </div>
          <div className="flex gap-3">
            <Button asChild variant="outline" className="flex-1 sm:flex-none">
              <Link href="/lobby">Quick Match</Link>
            </Button>
            <Button asChild className="flex-1 sm:flex-none">
              <Link href="/lobby?type=paid">Paid Match</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Trophy, label: 'Rating', value: user.rating, color: 'text-yellow-500' },
          { icon: Swords, label: 'Games Played', value: user.gamesPlayed, color: 'text-blue-500' },
          { icon: TrendingUp, label: 'Win Rate', value: `${winRate}%`, color: 'text-green-500' },
          {
            icon: DollarSign,
            label: 'Wallet',
            value: stats?.wallet
              ? formatCurrency(stats.wallet.balance, stats.wallet.currency)
              : '—',
            color: 'text-purple-500',
          },
        ].map((stat) => (
          <div key={stat.label} className="bg-card border rounded-xl p-5">
            <stat.icon className={`w-6 h-6 ${stat.color} mb-3`} />
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-sm text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* W/L/D row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-green-500">{user.wins}</p>
          <p className="text-sm text-muted-foreground">Wins</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-destructive">{user.losses}</p>
          <p className="text-sm text-muted-foreground">Losses</p>
        </div>
        <div className="bg-card border rounded-xl p-4 text-center">
          <p className="text-3xl font-bold text-muted-foreground">{user.draws}</p>
          <p className="text-sm text-muted-foreground">Draws</p>
        </div>
      </div>

      {/* Recent games */}
      {recentGames?.games?.length > 0 && (
        <div className="bg-card border rounded-xl p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5" /> Recent Games
            </h2>
            <Link href="/history" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {recentGames.games.map((game: any) => {
              const isWhite = game.whitePlayer?.id === user.id;
              const opponent = isWhite ? game.blackPlayer : game.whitePlayer;
              const won =
                (isWhite && game.result === 'WHITE_WINS') ||
                (!isWhite && game.result === 'BLACK_WINS');
              const drew = game.result === 'DRAW';

              return (
                <Link
                  key={game.id}
                  href={`/game/${game.id}`}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold ${won ? 'text-green-500' : drew ? 'text-muted-foreground' : 'text-destructive'}`}>
                      {won ? 'Win' : drew ? 'Draw' : 'Loss'}
                    </span>
                    <span className="text-sm">vs {opponent?.username}</span>
                    <span className="text-xs text-muted-foreground">({opponent?.rating})</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${game.type === 'PAID' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-muted text-muted-foreground'}`}>
                    {game.type}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
