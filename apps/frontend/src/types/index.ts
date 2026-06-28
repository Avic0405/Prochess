export interface User {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  isOnline: boolean;
  role: 'USER' | 'ADMIN';
  region: 'USD' | 'INR';
  createdAt: string;
  wallet?: Wallet;
}

export interface Wallet {
  balance: string | number;
  lockedBalance: string | number;
  currency: 'USD' | 'INR';
}

export interface Transaction {
  id: string;
  amount: string | number;
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'GAME_STAKE' | 'GAME_WIN' | 'GAME_REFUND' | 'COMMISSION';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  description?: string;
  createdAt: string;
  game?: { id: string; type: string; result?: string };
}

export interface Game {
  id: string;
  whitePlayerId: string;
  blackPlayerId: string;
  whitePlayer: PublicUser;
  blackPlayer: PublicUser;
  status: GameStatus;
  type: 'FREE' | 'PAID';
  timeControlType: TimeControl;
  timeMinutes: number;
  increment: number;
  stake?: string | number;
  currency?: 'USD' | 'INR';
  fen?: string;
  pgn?: string;
  result?: GameResult;
  winnerId?: string;
  whiteTimeLeft: number;
  blackTimeLeft: number;
  currentTurn: 'w' | 'b';
  moveCount: number;
  moves: Move[];
  chatMessages: ChatMessage[];
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
}

export type GameStatus =
  | 'WAITING'
  | 'PAYMENT_PENDING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'ABANDONED'
  | 'DISPUTED';

export type GameResult = 'WHITE_WINS' | 'BLACK_WINS' | 'DRAW' | 'ABANDONED';

export type TimeControl = 'BULLET' | 'BLITZ' | 'RAPID' | 'CLASSICAL' | 'CUSTOM';

export interface Move {
  id: string;
  moveNum: number;
  san: string;
  uci: string;
  fen: string;
  timeTaken: number;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  message: string;
  sender: { username: string; avatar?: string };
  createdAt: string;
}

export interface PublicUser {
  id: string;
  username: string;
  avatar?: string;
  rating: number;
  isOnline?: boolean;
}

export interface FriendRequest {
  id: string;
  senderId: string;
  sender: PublicUser;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  createdAt: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export type NotificationType =
  | 'FRIEND_REQUEST'
  | 'FRIEND_ACCEPTED'
  | 'GAME_INVITE'
  | 'GAME_STARTED'
  | 'GAME_RESULT'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED'
  | 'SYSTEM';

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface MatchmakingOptions {
  gameType: 'FREE' | 'PAID';
  stake?: number;
  currency?: 'USD' | 'INR';
  timeControl?: TimeControl;
  timeMinutes?: number;
  increment?: number;
}
