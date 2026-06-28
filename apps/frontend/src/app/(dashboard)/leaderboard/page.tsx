'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { getRatingColor } from '@/lib/utils';
import { Trophy, Medal } from 'lucide-react';

export default function LeaderboardPage() {
  const { data: players, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api.get('/users/leaderboard?limit=100').then((r) => r.data),
  });

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center justify-center gap-3">
          <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-yellow-500" /> Global Leaderboard
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">Top rated players worldwide</p>
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[300px]">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-medium text-muted-foreground w-10">#</th>
                  <th className="text-left p-3 sm:p-4 text-xs sm:text-sm font-medium text-muted-foreground">Player</th>
                  <th className="text-right p-3 sm:p-4 text-xs sm:text-sm font-medium text-muted-foreground">Rating</th>
                  <th className="hidden sm:table-cell text-right p-4 text-sm font-medium text-muted-foreground">Games</th>
                  <th className="hidden sm:table-cell text-right p-4 text-sm font-medium text-muted-foreground">Win%</th>
                </tr>
              </thead>
              <tbody>
                {players?.map((player: any, i: number) => {
                  const winRate = player.gamesPlayed > 0
                    ? Math.round((player.wins / player.gamesPlayed) * 100)
                    : 0;

                  return (
                    <tr key={player.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="p-3 sm:p-4">
                        <div className="flex items-center justify-center w-7">
                          {i === 0 && <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-500" />}
                          {i === 1 && <Medal className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />}
                          {i === 2 && <Medal className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" />}
                          {i > 2 && <span className="text-muted-foreground text-xs sm:text-sm">{i + 1}</span>}
                        </div>
                      </td>
                      <td className="p-3 sm:p-4">
                        <Link
                          href={`/profile/${player.username}`}
                          className="flex items-center gap-2 sm:gap-3 hover:text-primary transition-colors"
                        >
                          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {player.username[0].toUpperCase()}
                          </div>
                          <span className="font-medium text-sm truncate max-w-[110px] sm:max-w-none">{player.username}</span>
                          {player.isOnline && (
                            <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                          )}
                        </Link>
                      </td>
                      <td className="p-3 sm:p-4 text-right">
                        <span className={`font-bold text-sm ${getRatingColor(player.rating)}`}>
                          {player.rating}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell p-4 text-right text-muted-foreground text-sm">{player.gamesPlayed}</td>
                      <td className="hidden sm:table-cell p-4 text-right text-muted-foreground text-sm">{winRate}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
