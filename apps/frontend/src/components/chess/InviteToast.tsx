'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';
import { useAuthStore } from '@/store/authStore';
import { getMatchmakingSocket } from '@/lib/socket';
import { Button } from '@/components/ui/Button';
import { Swords, X, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InviteData {
  inviteId: string;
  inviterId: string;
  inviterUsername: string;
  options: {
    gameType: 'FREE' | 'PAID';
    timeMinutes: number;
    increment: number;
    stake?: number;
  };
}

const INVITE_TTL = 60;

export function InviteToast() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [timeLeft, setTimeLeft] = useState(INVITE_TTL);
  const [accepting, setAccepting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const clearInvite = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setInvite(null);
    setTimeLeft(INVITE_TTL);
    setAccepting(false);
  }, []);

  useEffect(() => {
    const token = Cookies.get('accessToken');
    if (!token || !isAuthenticated) return;

    const socket = getMatchmakingSocket(token);

    const onInviteReceived = (data: InviteData) => {
      setInvite(data);
      setTimeLeft(INVITE_TTL);
      setAccepting(false);

      // Start countdown
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInvite();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    };

    const onInviteCancelled = () => clearInvite();

    socket.on('invite_received', onInviteReceived);
    socket.on('invite_cancelled', onInviteCancelled);

    return () => {
      socket.off('invite_received', onInviteReceived);
      socket.off('invite_cancelled', onInviteCancelled);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAuthenticated, clearInvite]);

  const accept = useCallback(() => {
    if (!invite) return;
    const token = Cookies.get('accessToken');
    if (!token) return;

    setAccepting(true);
    if (timerRef.current) clearInterval(timerRef.current);

    const socket = getMatchmakingSocket(token);
    socket.once('match_found', (data: { game: { id: string } }) => {
      clearInvite();
      router.push(`/game/${data.game.id}`);
    });
    socket.emit('accept_invite', { inviteId: invite.inviteId });
  }, [invite, router, clearInvite]);

  const decline = useCallback(() => {
    if (!invite) return;
    const token = Cookies.get('accessToken');
    if (!token) return;

    getMatchmakingSocket(token).emit('decline_invite', { inviteId: invite.inviteId });
    clearInvite();
  }, [invite, clearInvite]);

  if (!invite) return null;

  const tcLabel = `${invite.options.timeMinutes}+${invite.options.increment}`;
  const progress = (timeLeft / INVITE_TTL) * 100;

  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-50 w-80 rounded-2xl shadow-2xl',
      'bg-card border border-primary/30',
      'animate-in slide-in-from-bottom-4 fade-in duration-300',
    )}>
      {/* Progress bar at top */}
      <div className="h-1 rounded-t-2xl overflow-hidden bg-muted">
        <div
          className={cn(
            'h-full transition-all duration-1000 ease-linear',
            timeLeft > 20 ? 'bg-primary' : timeLeft > 10 ? 'bg-yellow-500' : 'bg-destructive',
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center font-bold text-primary shrink-0 text-sm">
              {invite.inviterUsername[0].toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">{invite.inviterUsername}</p>
              <p className="text-xs text-muted-foreground">wants to play chess</p>
            </div>
          </div>
          <div className={cn(
            'flex items-center gap-1 text-xs shrink-0 font-mono font-medium',
            timeLeft > 20 ? 'text-muted-foreground' : timeLeft > 10 ? 'text-yellow-500' : 'text-destructive',
          )}>
            <Clock className="w-3 h-3" />
            {timeLeft}s
          </div>
        </div>

        {/* Game settings chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-mono">
            {tcLabel}
          </span>
          <span className={cn(
            'px-2 py-0.5 rounded-full text-xs font-medium',
            invite.options.gameType === 'FREE'
              ? 'bg-blue-500/10 text-blue-400'
              : 'bg-yellow-500/10 text-yellow-500',
          )}>
            {invite.options.gameType === 'FREE' ? 'Free' : 'Paid'}
          </span>
          {invite.options.gameType === 'PAID' && invite.options.stake && (
            <span className="px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-500 text-xs font-medium">
              ${invite.options.stake} stake
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={accept}
            disabled={accepting}
            size="sm"
            className="flex-1 gap-1.5 h-8 text-xs"
          >
            {accepting ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Joining...</>
            ) : (
              <><Swords className="w-3.5 h-3.5" /> Accept</>
            )}
          </Button>
          <Button
            onClick={decline}
            disabled={accepting}
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 h-8 text-xs"
          >
            <X className="w-3.5 h-3.5" /> Decline
          </Button>
        </div>
      </div>
    </div>
  );
}
