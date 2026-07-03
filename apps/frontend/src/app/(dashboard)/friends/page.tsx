'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/hooks/useToast';
import { PublicUser, FriendRequest } from '@/types';
import { UserPlus, Search, Check, X, Swords, User, Users, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function FriendsPage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');

  const { data: friends = [] } = useQuery<PublicUser[]>({
    queryKey: ['friends'],
    queryFn: () => api.get('/users/friends').then((r) => r.data),
  });

  const { data: pendingRequests = [] } = useQuery<FriendRequest[]>({
    queryKey: ['friend-requests'],
    queryFn: () => api.get('/users/friends/requests').then((r) => r.data),
  });

  const { data: searchResults = [] } = useQuery<PublicUser[]>({
    queryKey: ['user-search', searchQuery],
    queryFn: () => api.get(`/users/search?q=${searchQuery}`).then((r) => r.data),
    enabled: searchQuery.length >= 2,
  });

  const acceptMutation = useMutation({
    mutationFn: (requestId: string) =>
      api.post(`/users/friends/request/${requestId}/accept`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
      toast({ title: 'Friend request accepted!' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (requestId: string) =>
      api.post(`/users/friends/request/${requestId}/reject`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests'] });
    },
  });

  const sendRequestMutation = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/users/friends/request/${userId}`),
    onSuccess: () => {
      toast({ title: 'Friend request sent!' });
      queryClient.invalidateQueries({ queryKey: ['user-search'] });
    },
    onError: (e: any) =>
      toast({ variant: 'destructive', title: e?.response?.data?.message ?? 'Error' }),
  });

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl font-bold">Friends</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl w-full sm:w-fit">
        {([
          { key: 'friends', label: 'Friends', count: friends.length },
          { key: 'requests', label: 'Requests', count: pendingRequests.length },
          { key: 'search', label: 'Find People' },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1.5',
              activeTab === tab.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {'count' in tab && tab.count > 0 && (
              <span className={cn(
                'w-5 h-5 rounded-full text-xs flex items-center justify-center',
                activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/30',
              )}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Friends list */}
      {activeTab === 'friends' && (
        <div className="space-y-2">
          {friends.length === 0 ? (
            <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">
              <User className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No friends yet. Search for players to add!</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setActiveTab('search')}
              >
                Find People
              </Button>
            </div>
          ) : (
            friends.map((friend) => (
              <FriendCard key={friend.id} friend={friend} />
            ))
          )}
        </div>
      )}

      {/* Pending requests */}
      {activeTab === 'requests' && (
        <div className="space-y-2">
          {pendingRequests.length === 0 ? (
            <div className="bg-card border rounded-xl p-8 text-center text-muted-foreground">
              No pending friend requests
            </div>
          ) : (
            pendingRequests.map((req) => (
              <div key={req.id} className="flex items-center justify-between bg-card border rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                    {req.sender.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{req.sender.username}</p>
                    <p className="text-xs text-muted-foreground">{req.sender.rating} ELO</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => acceptMutation.mutate(req.id)}
                    disabled={acceptMutation.isPending}
                    className="gap-1"
                  >
                    <Check className="w-3 h-3" /> Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectMutation.mutate(req.id)}
                    disabled={rejectMutation.isPending}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Search */}
      {activeTab === 'search' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            {searchQuery.length >= 2 && searchResults.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No users found</p>
            )}
            {searchResults.map((u) => (
              <div key={u.id} className="flex items-center justify-between bg-card border rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
                    {u.username[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{u.username}</p>
                    <p className="text-xs text-muted-foreground">{u.rating} ELO</p>
                  </div>
                </div>
                {u.friendStatus === 'FRIENDS' ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 px-2 py-1 bg-green-500/10 rounded-lg">
                    <Users className="w-3 h-3" /> Friends
                  </span>
                ) : u.friendStatus === 'PENDING_SENT' ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground px-2 py-1 bg-muted rounded-lg">
                    <Clock className="w-3 h-3" /> Pending
                  </span>
                ) : u.friendStatus === 'PENDING_RECEIVED' ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setActiveTab('requests');
                    }}
                    className="gap-1"
                  >
                    <Check className="w-3 h-3" /> Accept
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendRequestMutation.mutate(u.id)}
                    disabled={sendRequestMutation.isPending}
                    className="gap-1"
                  >
                    <UserPlus className="w-3 h-3" /> Add
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FriendCard({ friend }: { friend: PublicUser }) {
  return (
    <div className="flex items-center justify-between bg-card border rounded-xl p-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary">
            {friend.username[0].toUpperCase()}
          </div>
          <span className={cn(
            'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card',
            friend.isOnline ? 'bg-green-500' : 'bg-muted-foreground',
          )} />
        </div>
        <div>
          <p className="font-medium">{friend.username}</p>
          <p className="text-xs text-muted-foreground">
            {friend.rating} ELO · {friend.isOnline ? 'Online' : 'Offline'}
          </p>
        </div>
      </div>

      <div className="flex flex-col xs:flex-row gap-2 shrink-0">
        <Button asChild size="sm" variant="outline" className="gap-1.5">
          <Link href={`/profile/${friend.username}`}>
            <User className="w-3 h-3" /> Profile
          </Link>
        </Button>
        {friend.isOnline && (
          <Button asChild size="sm" className="gap-1.5">
            <Link href={`/lobby?invite=${friend.id}&inviteName=${friend.username}`}>
              <Swords className="w-3 h-3" /> Challenge
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}
