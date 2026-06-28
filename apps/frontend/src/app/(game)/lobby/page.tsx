'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';
import { getMatchmakingSocket } from '@/lib/socket';
import Cookies from 'js-cookie';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';
import { Swords, DollarSign, Clock, Zap, Search, X, UserCheck } from 'lucide-react';
import { toast } from '@/hooks/useToast';

const TIME_CONTROLS = [
  { label: 'Bullet', value: 1, increment: 0, icon: Zap },
  { label: 'Blitz 3+2', value: 3, increment: 2, icon: Zap },
  { label: 'Blitz 5+0', value: 5, increment: 0, icon: Clock },
  { label: 'Rapid 10+0', value: 10, increment: 0, icon: Clock },
  { label: 'Rapid 15+10', value: 15, increment: 10, icon: Clock },
  { label: 'Classical 30', value: 30, increment: 0, icon: Clock },
];

type MatchStatus = 'idle' | 'searching' | 'inviting' | 'found';

export default function LobbyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated } = useAuthStore();

  const inviteUserId = searchParams.get('invite');
  const inviteTargetName = searchParams.get('inviteName') ?? inviteUserId ?? '';
  const [gameType, setGameType] = useState<'FREE' | 'PAID'>(
    searchParams.get('type') === 'paid' ? 'PAID' : 'FREE',
  );
  const [selectedTC, setSelectedTC] = useState(3);
  const [stake, setStake] = useState('');
  const [status, setStatus] = useState<MatchStatus>('idle');
  const [searchTime, setSearchTime] = useState(0);
  const [activeInviteId, setActiveInviteId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) router.push('/login');
  }, [isAuthenticated]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (status === 'searching' || status === 'inviting') {
      timer = setInterval(() => setSearchTime((t) => t + 1), 1000);
    } else {
      setSearchTime(0);
    }
    return () => clearInterval(timer);
  }, [status]);

  const tc = TIME_CONTROLS[selectedTC];

  const getSocket = useCallback(() => {
    const token = Cookies.get('accessToken');
    if (!token || !user) return null;
    const socket = getMatchmakingSocket(token);

    socket.on('match_found', (data: { game: { id: string } }) => {
      setStatus('found');
      setTimeout(() => router.push(`/game/${data.game.id}`), 1500);
    });

    // invite accepted: server sends match_found to both players
    socket.on('invite_accepted', (data: { game: { id: string } }) => {
      setStatus('found');
      setTimeout(() => router.push(`/game/${data.game.id}`), 1500);
    });

    socket.on('invite_sent', (data: { inviteId: string }) => {
      setActiveInviteId(data.inviteId);
    });

    socket.on('invite_declined', () => {
      setStatus('idle');
      setActiveInviteId(null);
      toast({ title: 'Challenge declined', description: `${inviteTargetName} declined your challenge.`, variant: 'destructive' });
    });

    socket.on('invite_expired', () => {
      setStatus('idle');
      setActiveInviteId(null);
      toast({ title: 'Challenge expired', description: `${inviteTargetName} did not respond in time.` });
    });

    return socket;
  }, [user, router]);

  const buildOptions = () => {
    const options: Record<string, unknown> = {
      gameType,
      timeMinutes: tc.value,
      increment: tc.increment,
    };
    if (gameType === 'PAID') {
      options.stake = parseFloat(stake);
      options.currency = user?.region;
    }
    return options;
  };

  const startSearch = () => {
    if (!user) return;
    if (gameType === 'PAID' && (!stake || parseFloat(stake) <= 0)) {
      toast({ title: 'Enter a valid stake amount', description: 'Add a stake to continue.', variant: 'destructive' });
      return;
    }

    const socket = getSocket();
    if (!socket) return;

    socket.emit('join_queue', buildOptions());
    setStatus('searching');
  };

  const sendInvite = () => {
    if (!user || !inviteUserId) return;
    if (gameType === 'PAID' && (!stake || parseFloat(stake) <= 0)) {
      toast({ title: 'Enter a valid stake amount', description: 'Add a stake to continue.', variant: 'destructive' });
      return;
    }

    const socket = getSocket();
    if (!socket) return;

    socket.emit('invite_friend', { inviteeId: inviteUserId, ...buildOptions() });
    setStatus('inviting');
  };

  const cancel = () => {
    const token = Cookies.get('accessToken');
    if (!token) return;
    const socket = getMatchmakingSocket(token);
    if (status === 'searching') {
      socket.emit('leave_queue');
    } else if (status === 'inviting' && activeInviteId && inviteUserId) {
      socket.emit('cancel_invite', { inviteId: activeInviteId, inviteeId: inviteUserId });
      setActiveInviteId(null);
    }
    socket.off('match_found');
    socket.off('invite_sent');
    socket.off('invite_accepted');
    socket.off('invite_declined');
    socket.off('invite_expired');
    setStatus('idle');
  };

  if (!user) return null;

  const isInviteMode = !!inviteUserId;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          {isInviteMode ? (
            <>
              <h1 className="text-3xl font-bold">Challenge Friend</h1>
              <p className="text-muted-foreground mt-1 flex items-center justify-center gap-2">
                <UserCheck className="w-4 h-4 text-green-500" />
                {inviteTargetName}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold">Find a Match</h1>
              <p className="text-muted-foreground mt-1">Choose your settings and start playing</p>
            </>
          )}
        </div>

        {/* Game type selector */}
        <div className="grid grid-cols-2 gap-3">
          {(['FREE', 'PAID'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setGameType(type)}
              className={cn(
                'p-4 rounded-xl border-2 transition-all text-left',
                gameType === type
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50',
              )}
            >
              {type === 'FREE' ? (
                <Swords className="w-6 h-6 mb-2 text-blue-500" />
              ) : (
                <DollarSign className="w-6 h-6 mb-2 text-yellow-500" />
              )}
              <p className="font-semibold">{type === 'FREE' ? 'Free Match' : 'Paid Match'}</p>
              <p className="text-xs text-muted-foreground">
                {type === 'FREE' ? 'Rated, no money' : 'Stake real money, win 90%'}
              </p>
            </button>
          ))}
        </div>

        {/* Time control */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Time Control</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {TIME_CONTROLS.map((tc, i) => (
              <button
                key={i}
                onClick={() => setSelectedTC(i)}
                className={cn(
                  'py-2 px-3 rounded-lg border text-sm transition-all',
                  selectedTC === i
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:border-primary/50',
                )}
              >
                {tc.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stake amount (paid only) */}
        {gameType === 'PAID' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Stake ({user.region === 'INR' ? '₹' : '$'})
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                {user.region === 'INR' ? '₹' : '$'}
              </span>
              <Input
                type="number"
                placeholder={user.region === 'INR' ? 'e.g. 100' : 'e.g. 5'}
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="pl-8"
                min={user.region === 'INR' ? 50 : 1}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Wallet: {user.region === 'INR' ? '₹' : '$'}
              {Number(user.wallet?.balance ?? 0).toFixed(2)} available
            </p>
          </div>
        )}

        {/* Action button */}
        {status === 'idle' && (
          <Button
            onClick={isInviteMode ? sendInvite : startSearch}
            className="w-full"
            size="lg"
          >
            {isInviteMode ? (
              <>
                <UserCheck className="w-4 h-4 mr-2" />
                Send Challenge to {inviteTargetName}
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                Find Match
              </>
            )}
          </Button>
        )}

        {(status === 'searching' || status === 'inviting') && (
          <div className="space-y-4">
            <div className="bg-card border rounded-xl p-6 text-center space-y-3">
              <div className="flex justify-center">
                <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
              </div>
              <p className="font-medium">
                {status === 'inviting'
                  ? `Waiting for ${inviteTargetName} to accept...`
                  : searchTime < 30
                    ? 'Searching for opponent...'
                    : searchTime < 60
                      ? 'Expanding search range...'
                      : searchTime < 90
                        ? 'Widening to ±200 ELO...'
                        : 'Searching globally — hang tight!'}
              </p>
              <p className="text-muted-foreground text-sm">
                {Math.floor(searchTime / 60)}:{String(searchTime % 60).padStart(2, '0')} elapsed
              </p>
              {status === 'searching' && searchTime >= 30 && (
                <p className="text-xs text-primary/70">
                  Search range: ±{100 + Math.floor(searchTime / 30) * 50} ELO
                </p>
              )}
            </div>
            <Button onClick={cancel} variant="outline" className="w-full">
              <X className="w-4 h-4 mr-2" /> Cancel
            </Button>
          </div>
        )}

        {status === 'found' && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-6 text-center">
            <p className="text-green-500 font-bold text-xl">Match found!</p>
            <p className="text-muted-foreground text-sm mt-1">Redirecting to game...</p>
          </div>
        )}
      </div>
    </div>
  );
}
