'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { getMatchmakingSocket } from '@/lib/socket';
import Cookies from 'js-cookie';
import api from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { BotLevelModal } from '@/components/chess/BotLevelModal';
import { cn, formatCurrency } from '@/lib/utils';
import { Swords, DollarSign, Clock, Zap, Search, X, UserCheck, ChevronDown, Bot } from 'lucide-react';
import { toast } from '@/hooks/useToast';
import { Currency } from '@/types';
import { trackStartMatchmaking, trackMatchFound, trackFriendInvite } from '@/lib/analytics/events';

const TIME_CONTROLS = [
  { label: 'Bullet', value: 1, increment: 0, icon: Zap },
  { label: 'Blitz 3+2', value: 3, increment: 2, icon: Zap },
  { label: 'Blitz 5+0', value: 5, increment: 0, icon: Clock },
  { label: 'Rapid 10+0', value: 10, increment: 0, icon: Clock },
  { label: 'Rapid 15+10', value: 15, increment: 10, icon: Clock },
  { label: 'Classical 30', value: 30, increment: 0, icon: Clock },
];

type MatchStatus = 'idle' | 'searching' | 'inviting' | 'found';

function LobbyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isHydrated } = useAuthStore();

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
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);
  const [botModalOpen, setBotModalOpen] = useState(false);

  const { data: wallets = [] } = useQuery<any[]>({
    queryKey: ['wallets'],
    queryFn: () => api.get('/wallet').then((r) => r.data),
    enabled: !!user,
  });

  // Derive active currency from wallets (or user region as fallback)
  const activeWallet = wallets.find((w) => w.isActive) ?? wallets[0];
  const activeCurrency: Currency = selectedCurrency ?? activeWallet?.currency ?? (user?.region as Currency) ?? 'USD';
  const activeCurrencyWallet = wallets.find((w) => w.currency === activeCurrency);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, isHydrated]);

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

    // Remove stale listeners before re-attaching to prevent duplicates
    socket.off('match_found');
    socket.off('invite_accepted');
    socket.off('invite_sent');
    socket.off('invite_declined');
    socket.off('invite_expired');
    socket.off('exception');

    socket.on('match_found', (data: { game: { id: string } }) => {
      setStatus('found');
      trackMatchFound({ gameId: data.game.id, viaInvite: false });
      setTimeout(() => router.push(`/game/${data.game.id}`), 1500);
    });

    socket.on('invite_accepted', (data: { game: { id: string } }) => {
      setStatus('found');
      trackMatchFound({ gameId: data.game.id, viaInvite: true });
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

    // Server-side validation errors (insufficient balance, wallet not active, etc.)
    socket.on('exception', (err: { message?: string; status?: string }) => {
      setStatus('idle');
      setActiveInviteId(null);
      const msg = err?.message ?? 'Something went wrong. Please try again.';
      toast({ title: 'Cannot join queue', description: msg, variant: 'destructive' });
    });

    return socket;
  }, [user, router]);

  const CURRENCY_SYMBOLS: Record<Currency, string> = {
    USD: '$', INR: '₹', EUR: '€', GBP: '£',
  };
  const CURRENCY_FLAGS: Record<Currency, string> = {
    USD: '🇺🇸', INR: '🇮🇳', EUR: '🇪🇺', GBP: '🇬🇧',
  };

  const buildOptions = () => {
    const options: Record<string, unknown> = {
      gameType,
      timeMinutes: tc.value,
      increment: tc.increment,
    };
    if (gameType === 'PAID') {
      options.stake = parseFloat(stake);
      options.currency = activeCurrency;
    }
    return options;
  };

  const validatePaid = (): boolean => {
    if (gameType !== 'PAID') return true;
    const stakeNum = parseFloat(stake);
    if (!stake || stakeNum <= 0) {
      toast({ title: 'Enter a valid stake amount', variant: 'destructive' });
      return false;
    }
    const walletBalance = Number(activeCurrencyWallet?.balance ?? 0);
    if (walletBalance < stakeNum) {
      toast({
        title: 'Insufficient balance',
        description: `Your ${activeCurrency} wallet has ${formatCurrency(walletBalance, activeCurrency)}. Need ${formatCurrency(stakeNum, activeCurrency)}. Add funds first.`,
        variant: 'destructive',
      });
      return false;
    }
    return true;
  };

  const startSearch = () => {
    if (!user) return;
    if (!validatePaid()) return;

    const socket = getSocket();
    if (!socket) return;

    socket.emit('join_queue', buildOptions());
    trackStartMatchmaking({
      gameType,
      timeMinutes: tc.value,
      increment: tc.increment,
      stake: gameType === 'PAID' ? parseFloat(stake) : undefined,
      currency: gameType === 'PAID' ? activeCurrency : undefined,
    });
    setStatus('searching');
  };

  const sendInvite = () => {
    if (!user || !inviteUserId) return;
    if (!validatePaid()) return;

    const socket = getSocket();
    if (!socket) return;

    socket.emit('invite_friend', { inviteeId: inviteUserId, ...buildOptions() });
    trackFriendInvite({ inviteeId: inviteUserId, gameType });
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
        <div className="grid grid-cols-2 xs:grid-cols-3 gap-3">
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

          {/* Independent of the FREE/PAID matchmaking flow above — opens the level-select
              modal directly instead of touching gameType/buildOptions/the queue socket. */}
          <button
            onClick={() => setBotModalOpen(true)}
            className="p-4 rounded-xl border-2 border-border hover:border-primary/50 transition-all text-left relative"
          >
            <span className="absolute top-2 right-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/15 text-primary">
              NEW
            </span>
            <Bot className="w-6 h-6 mb-2 text-primary" />
            <p className="font-semibold">Play with Bot</p>
            <p className="text-xs text-muted-foreground">Practice and improve</p>
          </button>
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
          <div className="space-y-3">
            {/* Currency selector */}
            {wallets.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Wallet Currency</label>
                <div className="flex flex-wrap gap-2">
                  {wallets.map((w) => (
                    <button
                      key={w.currency}
                      onClick={() => setSelectedCurrency(w.currency)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all',
                        activeCurrency === w.currency
                          ? 'border-primary bg-primary/10 text-foreground font-medium'
                          : 'border-border text-muted-foreground hover:border-primary/50',
                      )}
                    >
                      {CURRENCY_FLAGS[w.currency as Currency]} {w.currency}
                      {w.isActive && <span className="text-xs text-primary">(active)</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stake input */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">
                Entry Fee ({CURRENCY_FLAGS[activeCurrency]} {activeCurrency})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {CURRENCY_SYMBOLS[activeCurrency]}
                </span>
                <Input
                  type="number"
                  placeholder={activeCurrency === 'INR' ? 'e.g. 100' : 'e.g. 5'}
                  value={stake}
                  onChange={(e) => setStake(e.target.value)}
                  className="pl-8"
                  min={activeCurrency === 'INR' ? 50 : 1}
                  step="0.01"
                />
              </div>
              {(() => {
                const bal = Number(activeCurrencyWallet?.balance ?? 0);
                const stakeNum = parseFloat(stake || '0');
                const insufficient = stakeNum > 0 && bal < stakeNum;
                return (
                  <p className={cn('text-xs', insufficient ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                    {CURRENCY_FLAGS[activeCurrency]} {activeCurrency} Wallet:{' '}
                    {formatCurrency(bal, activeCurrency)} available
                    {insufficient && ' — insufficient balance'}
                  </p>
                );
              })()}
            </div>
          </div>
        )}

        {/* Action button */}
        {status === 'idle' && (
          <Button
            onClick={isInviteMode ? sendInvite : startSearch}
            className="w-full"
            size="lg"
            disabled={gameType === 'PAID' && parseFloat(stake || '0') > Number(activeCurrencyWallet?.balance ?? 0)}
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

      <BotLevelModal open={botModalOpen} onOpenChange={setBotModalOpen} />
    </div>
  );
}

export default function LobbyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    }>
      <LobbyContent />
    </Suspense>
  );
}
