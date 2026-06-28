import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:4000';

let gameSocket: Socket | null = null;
let matchmakingSocket: Socket | null = null;
let notificationsSocket: Socket | null = null;

export const getGameSocket = (token: string): Socket => {
  const currentToken = (gameSocket?.auth as any)?.token;
  if (!gameSocket?.connected || currentToken !== token) {
    gameSocket?.disconnect();
    gameSocket = io(`${SOCKET_URL}/game`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return gameSocket;
};

export const getMatchmakingSocket = (token: string): Socket => {
  const currentToken = (matchmakingSocket?.auth as any)?.token;
  if (!matchmakingSocket?.connected || currentToken !== token) {
    matchmakingSocket?.disconnect();
    matchmakingSocket = io(`${SOCKET_URL}/matchmaking`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return matchmakingSocket;
};

export const getNotificationsSocket = (token: string): Socket => {
  if (!notificationsSocket?.connected) {
    notificationsSocket = io(`${SOCKET_URL}/notifications`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
  }
  return notificationsSocket;
};

export const disconnectAll = () => {
  gameSocket?.disconnect();
  matchmakingSocket?.disconnect();
  notificationsSocket?.disconnect();
  gameSocket = null;
  matchmakingSocket = null;
  notificationsSocket = null;
};
