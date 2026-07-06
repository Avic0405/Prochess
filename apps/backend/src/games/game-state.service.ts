import {
  Injectable,
  Logger,
  Inject,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import { GameStatus, GameResult } from '@prisma/client';
import Redis from 'ioredis';

export interface PlayerSnapshot {
  id: string;
  username: string;
  avatar: string | null;
  rating: number;
}

export interface StoredMove {
  moveNum: number;
  san: string;
  uci: string;
  fen: string;
  createdAt: string;
}

export interface RedisGameState {
  gameId: string;
  whitePlayer: PlayerSnapshot;
  blackPlayer: PlayerSnapshot;
  fen: string;
  pgn: string;
  currentTurn: string;
  moveCount: number;
  moves: StoredMove[];
  whiteTimeLeft: number;
  blackTimeLeft: number;
  status: string;
  result: string | null;
  winnerId: string | null;
  type: string;
  stake: number | null;
  currency: string | null;
  timeMinutes: number;
  increment: number;
  startedAt: string;
  lastMoveAt: string | null;
  /** last move number already saved in Postgres */
  persistedMoveCount: number;
}

const GAME_STATE_TTL = 86_400;  // 24 h for active games
const DONE_GAME_TTL  = 3_600;   // 1 h retention after completion

@Injectable()
export class GameStateService implements OnApplicationBootstrap {
  private readonly logger = new Logger(GameStateService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  // ── Bootstrap ─────────────────────────────────────────────────────────────

  async onApplicationBootstrap() {
    try {
      const activeGames = await this.prisma.game.findMany({
        where: { status: 'ACTIVE' },
        include: {
          whitePlayer: { select: { id: true, username: true, avatar: true, rating: true } },
          blackPlayer: { select: { id: true, username: true, avatar: true, rating: true } },
          moves: { orderBy: { moveNum: 'asc' } },
        },
      });

      let seeded = 0;
      for (const g of activeGames) {
        const existing = await this.getState(g.id);
        if (existing) continue;

        const state: RedisGameState = {
          gameId: g.id,
          whitePlayer: g.whitePlayer as PlayerSnapshot,
          blackPlayer: g.blackPlayer as PlayerSnapshot,
          fen: g.fen ?? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          pgn: g.pgn ?? '',
          currentTurn: g.currentTurn ?? 'w',
          moveCount: g.moveCount,
          moves: g.moves.map(m => ({
            moveNum: m.moveNum,
            san: m.san,
            uci: m.uci,
            fen: m.fen,
            createdAt: m.createdAt.toISOString(),
          })),
          whiteTimeLeft: g.whiteTimeLeft ?? g.timeMinutes * 60,
          blackTimeLeft: g.blackTimeLeft ?? g.timeMinutes * 60,
          status: g.status,
          result: null,
          winnerId: null,
          type: g.type,
          stake: g.stake ? Number(g.stake) : null,
          currency: g.currency ?? null,
          timeMinutes: g.timeMinutes,
          increment: g.increment ?? 0,
          startedAt: g.startedAt?.toISOString() ?? new Date().toISOString(),
          lastMoveAt: g.lastMoveAt?.toISOString() ?? null,
          persistedMoveCount: g.moveCount,
        };

        await this.redis.setex(this.stateKey(g.id), GAME_STATE_TTL, JSON.stringify(state));
        await Promise.all([
          this.redis.setex(this.userGameKey(g.whitePlayer.id), GAME_STATE_TTL, g.id),
          this.redis.setex(this.userGameKey(g.blackPlayer.id), GAME_STATE_TTL, g.id),
        ]);
        seeded++;
      }

      if (seeded > 0) this.logger.log(`Bootstrapped ${seeded} active game(s) into Redis`);
    } catch (err: any) {
      this.logger.warn(`Bootstrap failed (non-fatal): ${err?.message}`);
    }
  }

  // ── Keys ──────────────────────────────────────────────────────────────────

  private stateKey(gameId: string) { return `game:state:${gameId}`; }
  private userGameKey(userId: string) { return `user:active_game:${userId}`; }

  // ── Init ──────────────────────────────────────────────────────────────────

  async initState(game: {
    id: string;
    whitePlayer: PlayerSnapshot;
    blackPlayer: PlayerSnapshot;
    type: string;
    stake: number | null;
    currency: string | null;
    timeMinutes: number;
    increment: number;
    whiteTimeLeft: number;
    blackTimeLeft: number;
    startedAt: Date;
  }): Promise<void> {
    const state: RedisGameState = {
      gameId: game.id,
      whitePlayer: game.whitePlayer,
      blackPlayer: game.blackPlayer,
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: '',
      currentTurn: 'w',
      moveCount: 0,
      moves: [],
      whiteTimeLeft: game.whiteTimeLeft,
      blackTimeLeft: game.blackTimeLeft,
      status: 'ACTIVE',
      result: null,
      winnerId: null,
      type: game.type,
      stake: game.stake,
      currency: game.currency,
      timeMinutes: game.timeMinutes,
      increment: game.increment,
      startedAt: game.startedAt.toISOString(),
      lastMoveAt: null,
      persistedMoveCount: 0,
    };

    await this.redis.setex(this.stateKey(game.id), GAME_STATE_TTL, JSON.stringify(state));
    await Promise.all([
      this.redis.setex(this.userGameKey(game.whitePlayer.id), GAME_STATE_TTL, game.id),
      this.redis.setex(this.userGameKey(game.blackPlayer.id), GAME_STATE_TTL, game.id),
    ]);
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async getState(gameId: string): Promise<RedisGameState | null> {
    const raw = await this.redis.get(this.stateKey(gameId));
    if (!raw) return null;
    try { return JSON.parse(raw) as RedisGameState; } catch { return null; }
  }

  async getActiveGameIdForUser(userId: string): Promise<string | null> {
    return this.redis.get(this.userGameKey(userId));
  }

  // ── Apply move (no Postgres write) ────────────────────────────────────────

  async applyMove(
    gameId: string,
    update: {
      fen: string;
      pgn: string;
      san: string;
      uci: string;
      turn: string;
      moveCount: number;
      whiteTimeLeft: number;
      blackTimeLeft: number;
      status: string;
      result: string | null;
      winnerId: string | null;
    },
  ): Promise<RedisGameState> {
    const state = await this.getState(gameId);
    if (!state) throw new NotFoundException('Game state not found in Redis');

    const move: StoredMove = {
      moveNum: update.moveCount,
      san: update.san,
      uci: update.uci,
      fen: update.fen,
      createdAt: new Date().toISOString(),
    };

    const newState: RedisGameState = {
      ...state,
      fen: update.fen,
      pgn: update.pgn,
      currentTurn: update.turn,
      moveCount: update.moveCount,
      moves: [...state.moves, move],
      whiteTimeLeft: update.whiteTimeLeft,
      blackTimeLeft: update.blackTimeLeft,
      status: update.status,
      result: update.result,
      winnerId: update.winnerId,
      lastMoveAt: new Date().toISOString(),
    };

    const ttl = update.status === 'COMPLETED' ? DONE_GAME_TTL : GAME_STATE_TTL;
    await this.redis.setex(this.stateKey(gameId), ttl, JSON.stringify(newState));
    return newState;
  }

  // ── Terminate a game (resign / draw / timeout) ────────────────────────────

  async terminateGame(
    gameId: string,
    result: string,
    winnerId: string | null,
  ): Promise<RedisGameState | null> {
    const state = await this.getState(gameId);
    if (!state) return null;

    const updated: RedisGameState = { ...state, status: 'COMPLETED', result, winnerId };
    await this.redis.setex(this.stateKey(gameId), DONE_GAME_TTL, JSON.stringify(updated));
    return updated;
  }

  // ── Periodic checkpoint (every 10 moves) ─────────────────────────────────

  async checkpoint(gameId: string, state: RedisGameState): Promise<void> {
    const unpersisted = state.moves.slice(state.persistedMoveCount);
    if (unpersisted.length === 0) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.game.update({
          where: { id: gameId },
          data: {
            fen: state.fen,
            pgn: state.pgn,
            currentTurn: state.currentTurn,
            moveCount: state.moveCount,
            whiteTimeLeft: state.whiteTimeLeft,
            blackTimeLeft: state.blackTimeLeft,
            lastMoveAt: state.lastMoveAt ? new Date(state.lastMoveAt) : undefined,
          },
        });

        await tx.move.createMany({
          data: unpersisted.map(m => ({
            gameId,
            moveNum: m.moveNum,
            san: m.san,
            uci: m.uci,
            fen: m.fen,
            createdAt: new Date(m.createdAt),
          })),
          skipDuplicates: true,
        });
      });

      // Update persistedMoveCount in Redis
      const fresh = await this.getState(gameId);
      if (fresh) {
        fresh.persistedMoveCount = state.moveCount;
        await this.redis.setex(this.stateKey(gameId), GAME_STATE_TTL, JSON.stringify(fresh));
      }

      this.logger.debug(`Checkpoint: game ${gameId} at move ${state.moveCount}`);
    } catch (err: any) {
      this.logger.error(`Checkpoint failed for ${gameId}: ${err.message}`);
    }
  }

  // ── Final persist on game completion ─────────────────────────────────────

  async persistCompletion(gameId: string, state: RedisGameState): Promise<void> {
    const unpersisted = state.moves.slice(state.persistedMoveCount);

    await this.prisma.$transaction(async (tx) => {
      await tx.game.update({
        where: { id: gameId },
        data: {
          fen: state.fen,
          pgn: state.pgn,
          currentTurn: state.currentTurn,
          moveCount: state.moveCount,
          whiteTimeLeft: state.whiteTimeLeft,
          blackTimeLeft: state.blackTimeLeft,
          lastMoveAt: state.lastMoveAt ? new Date(state.lastMoveAt) : undefined,
          status: GameStatus.COMPLETED,
          result: state.result as GameResult,
          winnerId: state.winnerId,
          endedAt: new Date(),
        },
      });

      if (unpersisted.length > 0) {
        await tx.move.createMany({
          data: unpersisted.map(m => ({
            gameId,
            moveNum: m.moveNum,
            san: m.san,
            uci: m.uci,
            fen: m.fen,
            createdAt: new Date(m.createdAt),
          })),
          skipDuplicates: true,
        });
      }
    });

    this.logger.log(`Persisted game ${gameId} to Postgres (${state.moveCount} total moves)`);
  }

  // ── Cleanup after completion ──────────────────────────────────────────────

  async cleanup(gameId: string, whitePlayerId: string, blackPlayerId: string): Promise<void> {
    await Promise.all([
      this.redis.del(this.userGameKey(whitePlayerId)),
      this.redis.del(this.userGameKey(blackPlayerId)),
    ]);
  }

  // ── Shape builder for getGame responses ──────────────────────────────────

  toGameShape(state: RedisGameState, chatMessages: any[] = []): any {
    return {
      id: state.gameId,
      whitePlayerId: state.whitePlayer.id,
      blackPlayerId: state.blackPlayer.id,
      whitePlayer: state.whitePlayer,
      blackPlayer: state.blackPlayer,
      fen: state.fen,
      pgn: state.pgn,
      currentTurn: state.currentTurn,
      moveCount: state.moveCount,
      status: state.status,
      result: state.result,
      winnerId: state.winnerId,
      type: state.type,
      stake: state.stake,
      currency: state.currency,
      timeMinutes: state.timeMinutes,
      increment: state.increment,
      whiteTimeLeft: state.whiteTimeLeft,
      blackTimeLeft: state.blackTimeLeft,
      startedAt: state.startedAt,
      endedAt: null,
      lastMoveAt: state.lastMoveAt,
      moves: state.moves,
      chatMessages,
      whiteAccepted: true,
      blackAccepted: true,
    };
  }
}
