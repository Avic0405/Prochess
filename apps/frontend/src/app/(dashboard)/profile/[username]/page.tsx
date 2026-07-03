'use client';

import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getRatingColor } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { UserPlus, Swords, Camera, Loader2, Eye, X, TrendingUp, Users, Clock, Check } from 'lucide-react';
import { useToast } from '@/hooks/useToast';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { API_BASE } from '@/lib/api';

function Avatar({
  src,
  username,
  size = 80,
  className = '',
}: {
  src?: string | null;
  username: string;
  size?: number;
  className?: string;
}) {
  if (src) {
    const url = src.startsWith('http') ? src : `${API_BASE}${src}`;
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={username}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {username[0].toUpperCase()}
    </div>
  );
}

function RatingChart({ history }: { history: { rating: number; change: number; createdAt: string }[] }) {
  const data = history.map((h) => ({
    rating: h.rating,
    change: h.change,
    date: new Date(h.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  const ratings = data.map((d) => d.rating);
  const minRating = Math.min(...ratings);
  const maxRating = Math.max(...ratings);
  const padding = Math.max(20, Math.round((maxRating - minRating) * 0.2));
  const yMin = Math.max(100, minRating - padding);
  const yMax = maxRating + padding;

  const trend = data[data.length - 1].rating - data[0].rating;

  return (
    <div className="bg-card border rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5" /> Rating History
        </h2>
        <span className={`text-sm font-semibold ${trend >= 0 ? 'text-green-500' : 'text-destructive'}`}>
          {trend >= 0 ? '+' : ''}{trend} over {data.length} games
        </span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="ratingGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6c5ce7" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6c5ce7" stopOpacity={0}   />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={52}
          />
          <Tooltip
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value: number, _: string, props: any) => {
              const change = props.payload?.change;
              const sign = change >= 0 ? '+' : '';
              return [`${value} ELO  (${sign}${change})`, 'Rating'];
            }}
          />
          <Area
            type="monotone"
            dataKey="rating"
            stroke="#6c5ce7"
            strokeWidth={2}
            fill="url(#ratingGradient)"
            dot={{ r: 3, fill: '#6c5ce7', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#6c5ce7', strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser, updateUser, fetchMe } = useAuthStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [viewingAvatar, setViewingAvatar] = useState(false);

  useEffect(() => {
    if (!viewingAvatar) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setViewingAvatar(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewingAvatar]);

  const { data: profile, isLoading, error } = useQuery({
    queryKey: ['profile', username],
    queryFn: () => api.get(`/users/${username}`).then((r) => r.data),
  });

  const isOwnProfile = currentUser?.username === username;

  const handleAvatarClick = () => {
    if (!isOwnProfile) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'Only image files are allowed' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ variant: 'destructive', title: 'Image must be under 5 MB' });
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    setUploading(true);
    try {
      const { data } = await api.post('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      updateUser({ avatar: data.avatar });
      await fetchMe();
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
      toast({ title: 'Avatar updated!' });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: err?.response?.data?.message ?? 'Please try again.',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const sendFriendRequest = async () => {
    if (!profile) return;
    setSendingRequest(true);
    try {
      await api.post(`/users/friends/request/${profile.id}`);
      toast({ title: 'Friend request sent!' });
      queryClient.invalidateQueries({ queryKey: ['profile', username] });
    } catch (e: any) {
      toast({ variant: 'destructive', title: e?.response?.data?.message ?? 'Error' });
    } finally {
      setSendingRequest(false);
    }
  };

  if (isLoading) return <div className="flex justify-center p-12">Loading...</div>;
  if (error || !profile) return <div className="text-center p-12 text-muted-foreground">User not found</div>;

  const winRate = profile.gamesPlayed > 0
    ? Math.round((profile.wins / profile.gamesPlayed) * 100)
    : 0;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="bg-card border rounded-2xl p-4 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">

          {/* Avatar with upload overlay */}
          <div className="relative shrink-0 group">
            <Avatar src={profile.avatar} username={profile.username} size={96} />

            {profile.avatar && (
              <div className="absolute inset-0 rounded-full bg-black/60 flex flex-col items-center justify-center gap-1
                              opacity-0 group-hover:opacity-100 transition-opacity">
                {isOwnProfile && uploading ? (
                  <Loader2 className="w-6 h-6 text-white animate-spin" />
                ) : (
                  <>
                    <button
                      onClick={() => setViewingAvatar(true)}
                      className="flex items-center gap-1 text-white text-[10px] font-semibold
                                 bg-white/20 hover:bg-white/30 rounded-full px-2 py-0.5 transition-colors"
                      aria-label="View avatar"
                    >
                      <Eye className="w-3 h-3" /> View
                    </button>
                    {isOwnProfile && (
                      <button
                        onClick={handleAvatarClick}
                        className="flex items-center gap-1 text-white text-[10px] font-semibold
                                   bg-white/20 hover:bg-white/30 rounded-full px-2 py-0.5 transition-colors"
                        aria-label="Change avatar"
                      >
                        <Camera className="w-3 h-3" /> Change
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold">{profile.username}</h1>
              <span className={`w-2 h-2 rounded-full ${profile.isOnline ? 'bg-green-500' : 'bg-muted-foreground'}`} />
              <span className="text-sm text-muted-foreground">
                {profile.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${getRatingColor(profile.rating)}`}>
              {profile.rating} ELO
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Member since {new Date(profile.createdAt).toLocaleDateString('en-US')}
            </p>
          </div>

          {!isOwnProfile && currentUser && (
            profile.friendStatus === 'FRIENDS' ? (
              <span className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400 px-3 py-2 bg-green-500/10 rounded-lg sm:shrink-0">
                <Users className="w-4 h-4" /> Friends
              </span>
            ) : profile.friendStatus === 'PENDING_SENT' ? (
              <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground px-3 py-2 bg-muted rounded-lg sm:shrink-0">
                <Clock className="w-4 h-4" /> Request Sent
              </span>
            ) : profile.friendStatus === 'PENDING_RECEIVED' ? (
              <Button
                onClick={sendFriendRequest}
                disabled={sendingRequest}
                className="gap-2 sm:shrink-0 w-full sm:w-auto"
              >
                <Check className="w-4 h-4" />
                {sendingRequest ? 'Accepting...' : 'Accept Request'}
              </Button>
            ) : (
              <Button
                onClick={sendFriendRequest}
                disabled={sendingRequest}
                variant="outline"
                className="gap-2 sm:shrink-0 w-full sm:w-auto"
              >
                <UserPlus className="w-4 h-4" />
                {sendingRequest ? 'Sending...' : 'Add Friend'}
              </Button>
            )
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t">
          {[
            { label: 'Games',    value: profile.gamesPlayed },
            { label: 'Wins',     value: profile.wins,   className: 'text-green-500' },
            { label: 'Losses',   value: profile.losses, className: 'text-destructive' },
            { label: 'Win Rate', value: `${winRate}%` },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className={`text-xl font-bold ${s.className ?? ''}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Rating history chart */}
      {profile.ratingHistory?.length > 1 && (
        <RatingChart history={[...profile.ratingHistory].reverse()} />
      )}

      {/* Recent games */}
      <div className="bg-card border rounded-xl p-6">
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
          <Swords className="w-5 h-5" /> Recent Games
        </h2>
        <div className="space-y-2">
          {[...profile.gamesAsWhite, ...profile.gamesAsBlack]
            .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 10)
            .map((game: any) => {
              const isWhite = !!profile.gamesAsWhite.find((g: any) => g.id === game.id);
              const opponent = isWhite ? game.blackPlayer : game.whitePlayer;
              const won = (isWhite && game.result === 'WHITE_WINS') || (!isWhite && game.result === 'BLACK_WINS');
              const drew = game.result === 'DRAW';

              return (
                <div key={game.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold w-10 ${won ? 'text-green-500' : drew ? 'text-muted-foreground' : 'text-destructive'}`}>
                      {won ? 'Win' : drew ? 'Draw' : 'Loss'}
                    </span>
                    <div className="flex items-center gap-2">
                      <Avatar src={opponent?.avatar} username={opponent?.username ?? '?'} size={24} />
                      <span className="text-sm">vs {opponent?.username}</span>
                      <span className="text-xs text-muted-foreground">({opponent?.rating})</span>
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${game.type === 'PAID' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-muted'}`}>
                    {game.type}
                  </span>
                </div>
              );
            })}
          {[...profile.gamesAsWhite, ...profile.gamesAsBlack].length === 0 && (
            <p className="text-center text-muted-foreground py-6">No games played yet</p>
          )}
        </div>
      </div>

      {/* Avatar lightbox */}
      {viewingAvatar && profile.avatar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setViewingAvatar(false)}
        >
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={profile.avatar.startsWith('http') ? profile.avatar : `${API_BASE}${profile.avatar}`}
              alt={profile.username}
              className="max-w-[90vw] max-h-[80vh] rounded-2xl shadow-2xl object-contain"
            />
            <button
              onClick={() => setViewingAvatar(false)}
              className="absolute -top-3 -right-3 bg-card border rounded-full p-1.5 shadow hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
