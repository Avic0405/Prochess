'use client';

import { useEffect, useRef } from 'react';
import { Socket } from 'socket.io-client';
import Cookies from 'js-cookie';
import { getGameSocket, getMatchmakingSocket, getNotificationsSocket } from '@/lib/socket';

export function useGameSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = Cookies.get('accessToken');
    if (!token) return;
    socketRef.current = getGameSocket(token);
    return () => { socketRef.current?.disconnect(); };
  }, []);

  return socketRef.current;
}

export function useMatchmakingSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = Cookies.get('accessToken');
    if (!token) return;
    socketRef.current = getMatchmakingSocket(token);
    return () => { socketRef.current?.disconnect(); };
  }, []);

  return socketRef.current;
}

export function useNotificationsSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = Cookies.get('accessToken');
    if (!token) return;
    socketRef.current = getNotificationsSocket(token);
    return () => { socketRef.current?.disconnect(); };
  }, []);

  return socketRef.current;
}
