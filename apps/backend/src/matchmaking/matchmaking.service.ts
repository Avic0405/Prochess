import {
  Injectable,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GamesService } from '../games/games.service';
import { NotificationsService } from '../notifications/notifications.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';
import { Currency, TimeControl } from '@prisma/client';

interface QueueEntry {
  userId: string;
  username: string;
  rating: number;
  gameType: 'FREE' | 'PAID';
  stake?: number;
  currency?: string;
  timeControl: string;
  timeMinutes: number;
  increment: number;
  joinedAt: number;
}

const QUEUE_KEY = (key: string) => `matchmaking:${key}`;
const RATING_RANGE_BASE = 100;
const RATING_EXPAND_PER_30S = 50;

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);

  constructor(
    private prisma: PrismaService,
    private gamesService: GamesService,
    private notifications: NotificationsService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  async joinQueue(
    userId: string,
    options: {
      gameType: 'FREE' | 'PAID';
      stake?: number;
      currency?: string;
      timeControl?: string;
      timeMinutes?: number;
      increment?: number;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, rating: true },
    });
    if (!user) throw new BadRequestException('User not found');

    // Check if already in queue
    const existing = await this.prisma.matchmakingQueue.findUnique({ where: { userId } });
    if (existing) throw new BadRequestException('Already in matchmaking queue');

    // For paid matches, verify active wallet currency and balance
    if (options.gameType === 'PAID') {
      if (!options.stake || options.stake <= 0) {
        throw new BadRequestException('Stake amount required for paid matches');
      }
      if (!options.currency) {
        throw new BadRequestException('Currency is required for paid matches');
      }
      const wallet = await this.prisma.wallet.findFirst({
        where: { userId, currency: options.currency as any, isActive: true },
      });
      if (!wallet) {
        throw new BadRequestException(
          `Your active wallet is not set to ${options.currency}. Switch your active wallet first.`,
        );
      }
      if (Number(wallet.balance) < options.stake) {
        throw new BadRequestException('Insufficient wallet balance');
      }
    }

    const timeMinutes = options.timeMinutes ?? 10;
    const increment = options.increment ?? 0;

    const entry: QueueEntry = {
      userId,
      username: user.username,
      rating: user.rating,
      gameType: options.gameType,
      stake: options.stake,
      currency: options.currency,
      timeControl: options.timeControl ?? 'BLITZ',
      timeMinutes,
      increment,
      joinedAt: Date.now(),
    };

    const queueKey = this.buildQueueKey(entry);

    // Save to DB + Redis
    await this.prisma.matchmakingQueue.create({
      data: {
        userId,
        gameType: options.gameType,
        stake: options.stake,
        currency: options.currency as Currency | undefined,
        ratingMin: user.rating - RATING_RANGE_BASE,
        ratingMax: user.rating + RATING_RANGE_BASE,
        timeControl: (options.timeControl as TimeControl) ?? TimeControl.BLITZ,
        timeMinutes,
        increment,
      },
    });

    await this.redis.zadd(queueKey, user.rating, JSON.stringify(entry));

    // Attempt immediate match
    const match = await this.findMatch(entry, queueKey);
    if (match) return match;

    const position = await this.getQueuePosition(userId, queueKey);
    return { status: 'queued', position };
  }

  async leaveQueue(userId: string) {
    const queueEntry = await this.prisma.matchmakingQueue.findUnique({ where: { userId } });
    if (!queueEntry) return { status: 'not_in_queue' };

    const fakeEntry: QueueEntry = {
      userId,
      username: '',
      rating: 0,
      gameType: queueEntry.gameType as 'FREE' | 'PAID',
      stake: queueEntry.stake ? Number(queueEntry.stake) : undefined,
      currency: queueEntry.currency ?? undefined,
      timeControl: queueEntry.timeControl,
      timeMinutes: queueEntry.timeMinutes,
      increment: queueEntry.increment,
      joinedAt: 0,
    };
    const queueKey = this.buildQueueKey(fakeEntry);

    // Remove from Redis
    const members = await this.redis.zrange(queueKey, 0, -1);
    for (const member of members) {
      const e = JSON.parse(member) as QueueEntry;
      if (e.userId === userId) {
        await this.redis.zrem(queueKey, member);
        break;
      }
    }

    await this.prisma.matchmakingQueue.delete({ where: { userId } });
    return { status: 'left_queue' };
  }

  async inviteFriend(
    inviterId: string,
    inviteeId: string,
    options: {
      gameType: 'FREE' | 'PAID';
      stake?: number;
      currency?: string;
      timeMinutes?: number;
      increment?: number;
    },
  ) {
    const [inviter, invitee] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: inviterId }, select: { username: true } }),
      this.prisma.user.findUnique({ where: { id: inviteeId }, select: { username: true } }),
    ]);

    if (!inviter || !invitee) throw new BadRequestException('User not found');

    const inviteId = `invite:${inviterId}:${inviteeId}:${Date.now()}`;
    await this.redis.setex(inviteId, 60, JSON.stringify({ inviterId, inviteeId, options, inviterUsername: inviter.username }));

    await this.notifications.create(inviteeId, {
      type: 'GAME_INVITE',
      title: 'Game Invite',
      body: `${inviter.username} invited you to play chess`,
      data: { inviteId, inviterId, options },
    });

    return { inviteId, status: 'invite_sent', inviterUsername: inviter.username, inviteeId, options };
  }

  async declineInvite(inviteId: string, userId: string): Promise<{ status: string; inviterId: string }> {
    const raw = await this.redis.get(inviteId);
    if (!raw) return { status: 'not_found', inviterId: '' };

    const invite = JSON.parse(raw) as { inviterId: string; inviteeId: string };
    if (invite.inviteeId !== userId) throw new BadRequestException('Not your invite');

    await this.redis.del(inviteId);
    return { status: 'declined', inviterId: invite.inviterId };
  }

  async cancelInvite(inviteId: string): Promise<void> {
    await this.redis.del(inviteId);
  }

  async getInvite(inviteId: string): Promise<boolean> {
    const raw = await this.redis.get(inviteId);
    return raw !== null;
  }

  async acceptInvite(inviteId: string, userId: string) {
    const raw = await this.redis.get(inviteId);
    if (!raw) throw new BadRequestException('Invite expired or not found');

    const invite = JSON.parse(raw) as {
      inviterId: string;
      inviteeId: string;
      options: { gameType: 'FREE' | 'PAID'; stake?: number; currency?: string; timeMinutes?: number; increment?: number };
    };

    if (invite.inviteeId !== userId) throw new BadRequestException('Not your invite');

    // For paid invites: validate BOTH players have a wallet in the invite currency
    if (invite.options.gameType === 'PAID' && invite.options.stake) {
      const inviteCurrency = (invite.options.currency as Currency) ?? Currency.USD;

      const [inviterWallet, inviteeWallet] = await Promise.all([
        this.prisma.wallet.findFirst({
          where: { userId: invite.inviterId, currency: inviteCurrency },
        }),
        this.prisma.wallet.findFirst({
          where: { userId: invite.inviteeId, currency: inviteCurrency },
        }),
      ]);

      if (!inviterWallet) {
        throw new BadRequestException(
          `The challenger does not have a ${inviteCurrency} wallet`,
        );
      }
      if (!inviteeWallet) {
        throw new BadRequestException(
          `Both players must use the same active wallet currency to play a paid match. ` +
          `You don't have a ${inviteCurrency} wallet. Switch your active wallet or ask the challenger to use a different currency.`,
        );
      }
      if (Number(inviterWallet.balance) < invite.options.stake) {
        throw new BadRequestException('Challenger has insufficient balance');
      }
      if (Number(inviteeWallet.balance) < invite.options.stake) {
        throw new BadRequestException('Insufficient balance in your wallet');
      }
    }

    await this.redis.del(inviteId);

    const whiteId = Math.random() < 0.5 ? invite.inviterId : invite.inviteeId;
    const blackId = whiteId === invite.inviterId ? invite.inviteeId : invite.inviterId;

    let game;
    if (invite.options.gameType === 'PAID' && invite.options.stake) {
      game = await this.gamesService.createPaidGame(whiteId, blackId, {
        timeMinutes: invite.options.timeMinutes,
        increment: invite.options.increment,
        stake: invite.options.stake,
        currency: (invite.options.currency as Currency) ?? Currency.USD,
      });
    } else {
      game = await this.gamesService.createFreeGame(whiteId, blackId, {
        timeMinutes: invite.options.timeMinutes,
        increment: invite.options.increment,
      });
    }

    await Promise.all([
      this.notifications.create(invite.inviterId, {
        type: 'GAME_STARTED',
        title: 'Game Started',
        body: 'Your game has started!',
        data: { gameId: game.id },
      }),
      this.notifications.create(invite.inviteeId, {
        type: 'GAME_STARTED',
        title: 'Game Started',
        body: 'Your game has started!',
        data: { gameId: game.id },
      }),
    ]);

    return { game, status: 'game_created', inviterId: invite.inviterId };
  }

  async rePollAllQueues(): Promise<Array<{ userId: string; opponentId: string; result: any }>> {
    const allEntries = await this.prisma.matchmakingQueue.findMany({
      include: { user: { select: { id: true, username: true, rating: true } } },
      orderBy: { joinedAt: 'asc' },
    });

    const results: Array<{ userId: string; opponentId: string; result: any }> = [];
    const matchedIds = new Set<string>();

    for (const dbEntry of allEntries) {
      if (matchedIds.has(dbEntry.userId)) continue;

      const entry: QueueEntry = {
        userId: dbEntry.userId,
        username: (dbEntry as any).user.username,
        rating: (dbEntry as any).user.rating,
        gameType: dbEntry.gameType as 'FREE' | 'PAID',
        stake: dbEntry.stake ? Number(dbEntry.stake) : undefined,
        currency: dbEntry.currency ?? undefined,
        timeControl: dbEntry.timeControl,
        timeMinutes: dbEntry.timeMinutes,
        increment: dbEntry.increment,
        joinedAt: dbEntry.joinedAt.getTime(),
      };

      const queueKey = this.buildQueueKey(entry);
      const match = await this.findMatch(entry, queueKey);

      if (match && 'opponentId' in match) {
        matchedIds.add(entry.userId);
        matchedIds.add(match.opponentId as string);
        results.push({ userId: entry.userId, opponentId: match.opponentId as string, result: match });
      }
    }

    return results;
  }

  private async findMatch(entry: QueueEntry, queueKey: string) {
    const waitSecs = (Date.now() - entry.joinedAt) / 1000;
    const range = RATING_RANGE_BASE + Math.floor(waitSecs / 30) * RATING_EXPAND_PER_30S;

    const allMembers = await this.redis.zrange(queueKey, 0, -1);

    // Find the exact Redis member string for the current user
    const selfMember = allMembers.find((m) => (JSON.parse(m) as QueueEntry).userId === entry.userId);

    const members = await this.redis.zrangebyscore(
      queueKey,
      entry.rating - range,
      entry.rating + range,
    );

    const candidates = members
      .map((m) => JSON.parse(m) as QueueEntry)
      .filter((e) => e.userId !== entry.userId);

    if (!candidates.length) return null;

    // Best match = closest rating
    const opponent = candidates.sort(
      (a, b) => Math.abs(a.rating - entry.rating) - Math.abs(b.rating - entry.rating),
    )[0];

    // Remove both from queue — use scanned member strings to avoid JSON mismatch
    if (selfMember) await this.redis.zrem(queueKey, selfMember);
    const opponentMember = members.find((m) => (JSON.parse(m) as QueueEntry).userId === opponent.userId);
    if (opponentMember) await this.redis.zrem(queueKey, opponentMember);

    await this.prisma.matchmakingQueue.deleteMany({
      where: { userId: { in: [entry.userId, opponent.userId] } },
    });

    const whiteId = Math.random() < 0.5 ? entry.userId : opponent.userId;
    const blackId = whiteId === entry.userId ? opponent.userId : entry.userId;

    let game;
    if (entry.gameType === 'PAID' && entry.stake) {
      game = await this.gamesService.createPaidGame(whiteId, blackId, {
        timeMinutes: entry.timeMinutes,
        increment: entry.increment,
        stake: entry.stake,
        currency: (entry.currency as Currency) ?? Currency.USD,
      });
    } else {
      game = await this.gamesService.createFreeGame(whiteId, blackId, {
        timeMinutes: entry.timeMinutes,
        increment: entry.increment,
      });
    }

    await Promise.all([
      this.notifications.create(entry.userId, {
        type: 'GAME_STARTED',
        title: 'Match Found!',
        body: `Game started against ${opponent.username}`,
        data: { gameId: game.id },
      }),
      this.notifications.create(opponent.userId, {
        type: 'GAME_STARTED',
        title: 'Match Found!',
        body: `Game started against ${entry.username}`,
        data: { gameId: game.id },
      }),
    ]);

    return {
      game,
      status: 'matched',
      opponent: { username: opponent.username, rating: opponent.rating },
      opponentId: opponent.userId,
    };
  }

  private buildQueueKey(entry: Pick<QueueEntry, 'gameType' | 'stake' | 'currency' | 'timeMinutes'>): string {
    const segment = entry.gameType === 'PAID'
      ? `PAID:${entry.stake}:${entry.currency ?? 'USD'}`
      : 'FREE';
    return QUEUE_KEY(`${segment}:${entry.timeMinutes}`);
  }

  private async getQueuePosition(userId: string, queueKey: string): Promise<number> {
    const members = await this.redis.zrange(queueKey, 0, -1);
    const idx = members.findIndex((m) => (JSON.parse(m) as QueueEntry).userId === userId);
    return idx + 1;
  }
}
