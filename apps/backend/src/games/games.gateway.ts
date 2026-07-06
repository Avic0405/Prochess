import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger, Inject } from '@nestjs/common';
import { createAdapter } from '@socket.io/redis-adapter';
import { GamesService } from './games.service';
import { GameStateService } from './game-state.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

const WS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001')
  .split(',').map((s: string) => s.trim()).filter(Boolean);

@WebSocketGateway({
  cors: { origin: WS_ORIGINS, credentials: true },
  namespace: '/game',
  transports: ['websocket'],
})
export class GamesGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(GamesGateway.name);
  private disconnectTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private gamesService: GamesService,
    private gameStateService: GameStateService,
    private usersService: UsersService,
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  afterInit(server: Server) {
    const pub = this.redis.duplicate();
    const sub = this.redis.duplicate();
    server.adapter(createAdapter(pub, sub));
    this.logger.log('✓ Game WS Gateway initialized (Redis adapter)');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.split(' ')[1];

      if (!token) { client.disconnect(true); return; }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });

      client.userId = payload.sub;
      client.username = payload.username;

      await this.redis.set(`socket:user:${payload.sub}`, client.id, 'EX', 86400);
      await this.redis.sadd('online:users', payload.sub);
      await this.usersService.setOnlineStatus(payload.sub, true);

      client.join(`user:${payload.sub}`);
      this.logger.debug(`User ${payload.sub} connected to /game`);
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (!client.userId) return;

    await this.usersService.setOnlineStatus(client.userId, false);
    await this.redis.srem('online:users', client.userId);
    await this.redis.del(`socket:user:${client.userId}`);

    // Use Redis index instead of full Postgres table scan
    const gameId = await this.gameStateService.getActiveGameIdForUser(client.userId);
    if (gameId) {
      const state = await this.gameStateService.getState(gameId);
      if (state && state.status === 'ACTIVE') {
        this.server.to(`game:${gameId}`).emit('player_disconnected', {
          userId: client.userId,
          gameId,
          gracePeriod: 60,
        });

        const timerKey = `${gameId}:${client.userId}`;
        const timer = setTimeout(async () => {
          // Check Redis — no Postgres query needed
          const current = await this.gameStateService.getState(gameId);
          if (current?.status === 'ACTIVE') {
            const result = await this.gamesService.handleTimeout(gameId, client.userId!);
            if (result) {
              this.server.to(`game:${gameId}`).emit('game_over', { ...result, reason: 'disconnect' });
            }
          }
          this.disconnectTimers.delete(timerKey);
        }, 60_000);

        this.disconnectTimers.set(timerKey, timer);
      }
    }

    this.logger.debug(`User ${client.userId} disconnected from /game`);
  }

  @SubscribeMessage('join_game')
  async handleJoinGame(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { gameId: string },
  ) {
    if (!client.userId) throw new WsException('Unauthorized');

    const game = await this.gamesService.getGame(data.gameId);

    const isWhite = game.whitePlayerId === client.userId;
    const isBlack = game.blackPlayerId === client.userId;
    const playerColor = isWhite ? 'white' : isBlack ? 'black' : null;

    client.join(`game:${data.gameId}`);

    const timerKey = `${data.gameId}:${client.userId}`;
    if (this.disconnectTimers.has(timerKey)) {
      clearTimeout(this.disconnectTimers.get(timerKey)!);
      this.disconnectTimers.delete(timerKey);
      this.server.to(`game:${data.gameId}`).emit('player_reconnected', { userId: client.userId });
    }

    return {
      event: 'game_joined',
      data: { game, isPlayer: isWhite || isBlack, playerColor },
    };
  }

  @SubscribeMessage('make_move')
  async handleMakeMove(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    data: {
      gameId: string;
      from: string;
      to: string;
      promotion?: string;
      timeLeft: number;
    },
  ) {
    if (!client.userId) throw new WsException('Unauthorized');

    const t0 = Date.now();

    // Single service call — clocks updated in Redis, no duplicate DB queries
    const result = await this.gamesService.makeMove(
      data.gameId,
      client.userId,
      { from: data.from, to: data.to, promotion: data.promotion },
      data.timeLeft,
    );

    this.logger.debug(
      `move_made game=${data.gameId} move=${result.moveCount} gw_latency=${Date.now() - t0}ms`,
    );

    this.server.to(`game:${data.gameId}`).emit('move_made', {
      fen: result.fen,
      pgn: result.pgn,
      status: result.status,
      result: result.result,
      isCheck: result.isCheck,
      isCheckmate: result.isCheckmate,
      isDraw: result.isDraw,
      move: {
        id: `${data.gameId}-${result.moveCount}`,
        moveNum: result.moveCount,
        san: result.move.san,
        uci: `${data.from}${data.to}${data.promotion ?? ''}`,
        fen: result.fen,
        from: result.move.from,
        to: result.move.to,
        timeTaken: 0,
        createdAt: new Date().toISOString(),
      },
      playerId: client.userId,
      whiteTime: result.whiteTimeLeft,
      blackTime: result.blackTimeLeft,
    });

    if (result.status === 'COMPLETED') {
      this.server.to(`game:${data.gameId}`).emit('game_over', {
        result: result.result,
        status: result.status,
      });
    }

    return result;
  }

  @SubscribeMessage('resign')
  async handleResign(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { gameId: string },
  ) {
    if (!client.userId) throw new WsException('Unauthorized');
    const result = await this.gamesService.resignGame(data.gameId, client.userId);
    this.server.to(`game:${data.gameId}`).emit('game_over', { ...result, reason: 'resignation' });
    return result;
  }

  @SubscribeMessage('offer_draw')
  async handleOfferDraw(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { gameId: string },
  ) {
    if (!client.userId) throw new WsException('Unauthorized');
    await this.gamesService.offerDraw(data.gameId, client.userId);
    client.to(`game:${data.gameId}`).emit('draw_offered', { offeredBy: client.userId });
    return { status: 'offer_sent' };
  }

  @SubscribeMessage('accept_draw')
  async handleAcceptDraw(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { gameId: string },
  ) {
    if (!client.userId) throw new WsException('Unauthorized');
    const result = await this.gamesService.acceptDraw(data.gameId, client.userId);
    this.server.to(`game:${data.gameId}`).emit('game_over', { ...result, reason: 'draw_accepted' });
    return result;
  }

  @SubscribeMessage('timeout')
  async handleTimeout(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { gameId: string },
  ) {
    if (!client.userId) throw new WsException('Unauthorized');
    const result = await this.gamesService.handleTimeout(data.gameId, client.userId);
    if (result) {
      this.server.to(`game:${data.gameId}`).emit('game_over', { ...result, reason: 'timeout' });
    }
    return result;
  }

  @SubscribeMessage('send_message')
  async handleChatMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { gameId: string; message: string },
  ) {
    if (!client.userId) throw new WsException('Unauthorized');

    const sanitized = data.message.slice(0, 500).trim();
    if (!sanitized) return;

    const msg = await this.prisma.chatMessage.create({
      data: { gameId: data.gameId, senderId: client.userId, message: sanitized },
      include: { sender: { select: { username: true, avatar: true } } },
    });

    this.server.to(`game:${data.gameId}`).emit('chat_message', msg);
    return msg;
  }

  @SubscribeMessage('request_rematch')
  async handleRequestRematch(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { gameId: string },
  ) {
    if (!client.userId) throw new WsException('Unauthorized');

    const game = await this.prisma.game.findUnique({
      where: { id: data.gameId },
      select: {
        id: true, status: true,
        whitePlayerId: true, blackPlayerId: true,
        type: true, timeMinutes: true, increment: true,
        timeControlType: true, stake: true, currency: true,
      },
    });

    if (!game || game.status !== 'COMPLETED') throw new WsException('Game not found or not completed');

    const isPlayer = game.whitePlayerId === client.userId || game.blackPlayerId === client.userId;
    if (!isPlayer) throw new WsException('Not a player in this game');

    const opponentId = game.whitePlayerId === client.userId ? game.blackPlayerId : game.whitePlayerId;

    const key = `rematch:${data.gameId}:${client.userId}`;
    await this.redis.setex(key, 60, JSON.stringify({
      requesterId: client.userId,
      gameId: data.gameId,
      gameType: game.type,
      timeMinutes: game.timeMinutes,
      increment: game.increment,
      timeControlType: game.timeControlType,
      stake: game.stake ? Number(game.stake) : undefined,
      currency: game.currency ?? undefined,
    }));

    this.server.to(`user:${opponentId}`).emit('rematch_requested', {
      gameId: data.gameId,
      requesterId: client.userId,
    });

    return { status: 'rematch_requested' };
  }

  @SubscribeMessage('accept_rematch')
  async handleAcceptRematch(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { gameId: string; requesterId: string },
  ) {
    if (!client.userId) throw new WsException('Unauthorized');

    const key = `rematch:${data.gameId}:${data.requesterId}`;
    const raw = await this.redis.get(key);
    if (!raw) throw new WsException('Rematch request expired');

    const req = JSON.parse(raw) as {
      requesterId: string; gameType: 'FREE' | 'PAID';
      timeMinutes: number; increment: number;
      stake?: number; currency?: string;
    };
    await this.redis.del(key);

    const players = [data.requesterId, client.userId];
    const whiteIdx = Math.floor(Math.random() * 2);
    const newWhiteId = players[whiteIdx];
    const newBlackId = players[1 - whiteIdx];

    let newGame;
    if (req.gameType === 'PAID' && req.stake) {
      newGame = await this.gamesService.createPaidGame(newWhiteId, newBlackId, {
        timeMinutes: req.timeMinutes,
        increment: req.increment,
        stake: req.stake,
        currency: (req.currency as any) ?? 'USD',
      });
    } else {
      newGame = await this.gamesService.createFreeGame(newWhiteId, newBlackId, {
        timeMinutes: req.timeMinutes,
        increment: req.increment,
      });
    }

    const payload = { gameId: newGame.id };
    this.server.to(`user:${data.requesterId}`).emit('rematch_started', payload);
    this.server.to(`user:${client.userId}`).emit('rematch_started', payload);
    return payload;
  }

  emitToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, data);
  }
}
