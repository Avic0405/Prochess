/**
 * Reusable GA4 custom event helpers for ProChess.live.
 *
 * Where a GA4 "recommended event" name exists (sign_up, login, purchase) we use it —
 * recommended events get better automatic reporting in GA4 and are the ones GA4 will
 * let you flag as key events (conversions) with a single toggle in Admin → Events.
 *
 * KEY_EVENTS mirrors what should be marked "Mark as key event" in the GA4 Admin UI —
 * GA4 conversions are configured per-property there, not from client code.
 */
import { trackEvent } from './gtag';
import type { Currency } from '@/types';

export const KEY_EVENTS = ['sign_up', 'login', 'purchase', 'game_started', 'game_finished'] as const;

type Gateway = 'stripe' | 'razorpay';
type GameType = 'FREE' | 'PAID';

// ─── Auth ───────────────────────────────────────────────────────────────────

export function trackRegistration(params: { userId?: string } = {}) {
  trackEvent('sign_up', { method: 'email', user_id: params.userId });
}

export function trackLogin(params: { method?: 'email' | 'facebook'; userId?: string } = {}) {
  trackEvent('login', { method: params.method ?? 'email', user_id: params.userId });
}

export function trackGoogleLogin(params: { userId?: string } = {}) {
  trackEvent('login', { method: 'google', user_id: params.userId });
}

export function trackLogout() {
  trackEvent('logout');
}

// ─── Matchmaking & Games ────────────────────────────────────────────────────

export function trackStartMatchmaking(params: {
  gameType: GameType;
  timeMinutes: number;
  increment: number;
  stake?: number;
  currency?: Currency;
}) {
  trackEvent('start_matchmaking', {
    game_type: params.gameType,
    time_control: `${params.timeMinutes}+${params.increment}`,
    stake: params.stake,
    currency: params.currency,
  });
}

export function trackMatchFound(params: { gameId: string; viaInvite: boolean }) {
  trackEvent('match_found', { game_id: params.gameId, via_invite: params.viaInvite });
}

export function trackGameStarted(params: {
  gameId: string;
  gameType: GameType;
  timeMinutes?: number;
  stake?: number;
  currency?: Currency;
  mode?: 'online' | 'bot';
}) {
  trackEvent('game_started', {
    game_id: params.gameId,
    game_type: params.gameType,
    time_control: params.timeMinutes,
    stake: params.stake,
    currency: params.currency,
    mode: params.mode ?? 'online',
  });
}

export function trackGameFinished(params: {
  gameId: string;
  result: string;
  reason?: string;
  won: boolean | null;
  mode?: 'online' | 'bot';
}) {
  trackEvent('game_finished', {
    game_id: params.gameId,
    result: params.result,
    reason: params.reason,
    won: params.won,
    mode: params.mode ?? 'online',
  });
}

export function trackGameAbandoned(params: { gameId: string; reason?: string }) {
  trackEvent('game_abandoned', { game_id: params.gameId, reason: params.reason ?? 'disconnect' });
}

export function trackFriendInvite(params: { inviteeId: string; gameType: GameType }) {
  trackEvent('friend_invite', { invitee_id: params.inviteeId, game_type: params.gameType });
}

export function trackBotLevelSelected(params: { level: number; name: string; elo: number }) {
  trackEvent('bot_level_selected', { level: params.level, name: params.name, elo: params.elo });
}

// ─── Wallet & Payments ──────────────────────────────────────────────────────

export function trackWalletOpened(params: { currency?: Currency } = {}) {
  trackEvent('wallet_opened', { currency: params.currency });
}

export function trackAddMoney(params: { currency: Currency }) {
  trackEvent('add_money', { currency: params.currency });
}

export function trackPaymentStarted(params: { amount: number; currency: Currency; gateway: Gateway }) {
  trackEvent('payment_started', { value: params.amount, currency: params.currency, gateway: params.gateway });
}

export function trackPaymentSuccess(params: {
  amount: number;
  currency: Currency;
  gateway: Gateway;
  transactionId: string;
}) {
  // Standard GA4 ecommerce event — auto-detected as a key event by default in most properties.
  trackEvent('purchase', {
    value: params.amount,
    currency: params.currency,
    transaction_id: params.transactionId,
    payment_type: params.gateway,
  });
}

export function trackPaymentFailed(params: {
  amount?: number;
  currency?: Currency;
  gateway: Gateway;
  reason?: string;
}) {
  trackEvent('payment_failed', {
    value: params.amount,
    currency: params.currency,
    gateway: params.gateway,
    reason: params.reason,
  });
}

// ─── Tournaments & Puzzles ──────────────────────────────────────────────────
// No tournament/puzzle feature exists in the product yet — these are provided so the
// events are ready to wire up the moment those features ship.

export function trackTournamentJoined(params: { tournamentId: string }) {
  trackEvent('tournament_joined', { tournament_id: params.tournamentId });
}

export function trackPuzzleStarted(params: { puzzleId?: string } = {}) {
  trackEvent('puzzle_started', { puzzle_id: params.puzzleId });
}

export function trackPuzzleCompleted(params: { puzzleId?: string; success?: boolean } = {}) {
  trackEvent('puzzle_completed', { puzzle_id: params.puzzleId, success: params.success });
}

// ─── Profile & Social ───────────────────────────────────────────────────────

export function trackLeaderboardViewed() {
  trackEvent('leaderboard_viewed');
}

export function trackProfileUpdated(params: { fields: string[] }) {
  trackEvent('profile_updated', { fields: params.fields.join(',') });
}

export function trackSettingsChanged(params: { setting: string }) {
  trackEvent('settings_changed', { setting: params.setting });
}
