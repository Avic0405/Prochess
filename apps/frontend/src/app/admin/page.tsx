'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Users, Swords, DollarSign, TrendingUp, Ban, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AdminPage() {
  const router = useRouter();
  const { user, isAuthenticated, isHydrated } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'users' | 'games' | 'payments'>('users');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!isHydrated) return;
    if (!isAuthenticated) router.push('/login');
    else if (user?.role !== 'ADMIN') router.push('/dashboard');
  }, [isAuthenticated, isHydrated, user]);

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => api.get('/admin/stats').then((r) => r.data),
    enabled: user?.role === 'ADMIN',
  });

  const { data: usersData } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: () => api.get(`/admin/users?search=${search}`).then((r) => r.data),
    enabled: activeTab === 'users' && user?.role === 'ADMIN',
  });

  const { data: gamesData } = useQuery({
    queryKey: ['admin-games'],
    queryFn: () => api.get('/admin/games').then((r) => r.data),
    enabled: activeTab === 'games' && user?.role === 'ADMIN',
  });

  const { data: paymentsData } = useQuery({
    queryKey: ['admin-payments'],
    queryFn: () => api.get('/admin/payments').then((r) => r.data),
    enabled: activeTab === 'payments' && user?.role === 'ADMIN',
  });

  const banMutation = useMutation({
    mutationFn: ({ userId, ban }: { userId: string; ban: boolean }) =>
      api.patch(`/admin/users/${userId}/ban`, { ban }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  if (!user || user.role !== 'ADMIN') return null;

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Admin Panel</h1>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Users, label: 'Total Users', value: stats.totalUsers, color: 'text-blue-500' },
            { icon: Swords, label: 'Active Games', value: stats.activeGames, color: 'text-green-500' },
            { icon: TrendingUp, label: 'Total Games', value: stats.totalGames, color: 'text-purple-500' },
            {
              icon: DollarSign,
              label: 'Revenue (10%)',
              value: `$${parseFloat(stats.totalRevenue ?? '0').toFixed(2)}`,
              color: 'text-yellow-500',
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-card border rounded-xl p-5">
              <stat.icon className={`w-5 h-5 ${stat.color} mb-3`} />
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="flex border-b">
          {(['users', 'games', 'payments'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-6 py-3 text-sm font-medium capitalize transition-colors',
                activeTab === tab ? 'bg-muted text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'users' && (
            <div className="space-y-4">
              <Input
                placeholder="Search by username or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="max-w-xs"
              />
              <div className="space-y-2">
                {usersData?.users?.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30">
                    <div>
                      <p className="font-medium text-sm">{u.username}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs">{u.rating} ELO</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs">{u.gamesPlayed} games</span>
                        {u.isBanned && (
                          <span className="text-xs px-1.5 py-0.5 bg-destructive/20 text-destructive rounded">
                            Banned
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={u.isBanned ? 'outline' : 'destructive'}
                      onClick={() => banMutation.mutate({ userId: u.id, ban: !u.isBanned })}
                      className="gap-1"
                    >
                      {u.isBanned ? (
                        <><CheckCircle className="w-3 h-3" /> Unban</>
                      ) : (
                        <><Ban className="w-3 h-3" /> Ban</>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'games' && (
            <div className="space-y-2">
              {gamesData?.games?.map((g: any) => (
                <div key={g.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">
                      {g.whitePlayer?.username} vs {g.blackPlayer?.username}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {g.status} • {g.type}
                      {g.stake && ` • ${g.currency === 'INR' ? '₹' : '$'}${g.stake}`}
                    </p>
                  </div>
                  <span className={cn('text-xs px-2 py-0.5 rounded-full',
                    g.status === 'ACTIVE' ? 'bg-green-500/20 text-green-500' :
                    g.status === 'COMPLETED' ? 'bg-muted text-muted-foreground' :
                    'bg-yellow-500/20 text-yellow-500'
                  )}>
                    {g.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-2">
              {paymentsData?.transactions?.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">
                      {t.wallet?.user?.username} — {t.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-sm font-bold',
                      t.type === 'DEPOSIT' || t.type === 'GAME_WIN' ? 'text-green-500' : 'text-destructive'
                    )}>
                      ${parseFloat(t.amount).toFixed(2)}
                    </p>
                    <span className={cn('text-xs',
                      t.status === 'COMPLETED' ? 'text-green-500' :
                      t.status === 'PENDING' ? 'text-yellow-500' : 'text-destructive'
                    )}>
                      {t.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
