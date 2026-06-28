'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { getNotificationsSocket } from '@/lib/socket';
import { useAuthStore } from '@/store/authStore';
import Cookies from 'js-cookie';
import { Notification, NotificationType } from '@/types';
import {
  Bell, UserPlus, UserCheck, Swords, Trophy, DollarSign, Info, Play,
} from 'lucide-react';
import { timeAgo, cn } from '@/lib/utils';

function getNotificationRoute(type: NotificationType, data?: Record<string, unknown>): string | null {
  switch (type) {
    case 'FRIEND_REQUEST':
      return '/friends';
    case 'FRIEND_ACCEPTED':
      return '/friends';
    case 'GAME_INVITE':
      return data?.inviterId ? `/lobby?invite=${data.inviterId}` : '/friends';
    case 'GAME_STARTED':
      return data?.gameId ? `/game/${data.gameId}` : null;
    case 'GAME_RESULT':
      return data?.gameId ? `/game/${data.gameId}/review` : null;
    case 'PAYMENT_SUCCESS':
    case 'PAYMENT_FAILED':
      return '/wallet';
    case 'SYSTEM':
    default:
      return null;
  }
}

function NotificationIcon({ type }: { type: NotificationType }) {
  const base = 'w-4 h-4 shrink-0';
  switch (type) {
    case 'FRIEND_REQUEST':   return <UserPlus  className={`${base} text-blue-400`} />;
    case 'FRIEND_ACCEPTED':  return <UserCheck className={`${base} text-green-400`} />;
    case 'GAME_INVITE':      return <Swords    className={`${base} text-purple-400`} />;
    case 'GAME_STARTED':     return <Play      className={`${base} text-primary`} />;
    case 'GAME_RESULT':      return <Trophy    className={`${base} text-yellow-400`} />;
    case 'PAYMENT_SUCCESS':  return <DollarSign className={`${base} text-green-400`} />;
    case 'PAYMENT_FAILED':   return <DollarSign className={`${base} text-destructive`} />;
    default:                 return <Info       className={`${base} text-muted-foreground`} />;
  }
}

export function NotificationBell() {
  const { isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => api.get('/notifications/unread').then((r) => r.data),
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  // Real-time socket push
  useEffect(() => {
    const token = Cookies.get('accessToken');
    if (!token || !isAuthenticated) return;

    const socket = getNotificationsSocket(token);
    socket.on('notification', () => {
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    });

    return () => { socket.off('notification'); };
  }, [isAuthenticated, queryClient]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const notifications = (data as Notification[] | undefined) ?? [];
  const unreadCount = notifications.length;

  const markAllRead = async () => {
    await api.post('/notifications/read-all');
    queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
  };

  const handleClick = async (n: Notification) => {
    // Mark this one as read
    await api.post(`/notifications/${n.id}/read`).catch(() =>
      api.post('/notifications/read-all'),
    );
    queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    setOpen(false);

    const route = getNotificationRoute(n.type, n.data);
    if (route) router.push(route);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-card border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                No unread notifications
              </div>
            ) : (
              notifications.map((n) => {
                const route = getNotificationRoute(n.type, n.data);
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      'w-full text-left flex items-start gap-3 px-4 py-3 border-b last:border-0 transition-colors',
                      !n.isRead ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/50',
                      route ? 'cursor-pointer' : 'cursor-default',
                    )}
                  >
                    <div className="mt-0.5 p-1.5 rounded-full bg-muted shrink-0">
                      <NotificationIcon type={n.type} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.body}</p>
                      <p className="text-xs text-muted-foreground mt-1 opacity-70">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.isRead && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
