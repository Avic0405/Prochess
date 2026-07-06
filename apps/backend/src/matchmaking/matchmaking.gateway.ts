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
import { MatchmakingService } from './matchmaking.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

const WS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001')
  .split(',').map((s: string) => s.trim()).filter(Boolean);

@WebSocketGateway({
  cors: { origin: WS_ORIGINS, credentials: true },
  namespace: '/matchmaking',
  transports: ['websocket'],
})
export class MatchmakingGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(MatchmakingGateway.name);

  constructor(
    private matchmakingService: MatchmakingService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  afterInit(server: Server) {
    const pub = this.redis.duplicate();
    const sub = this.redis.duplicate();
    server.adapter(createAdapter(pub, sub));
    this.logger.log('✓ Matchmaking WS Gateway initialized (Redis adapter)');

    // Re-poll all queues every 30 s to catch unmatched players
    setInterval(async () => {
      try {
        const matched = await this.matchmakingService.rePollAllQueues();
        for (const { userId, opponentId, result } of matched) {
          this.logger.log(`Re-poll matched ${userId} vs ${opponentId}`);
          this.server.to(`user:${userId}`).emit('match_found', result);
          this.server.to(`user:${opponentId}`).emit('match_found', result);
        }
      } catch (e) {
        this.logger.error('Re-poll error', e);
      }
    }, 30_000);
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) { client.disconnect(true); return; }
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });
      client.userId = payload.sub;
      client.join(`user:${payload.sub}`);
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    if (client.userId) {
      await this.matchmakingService.leaveQueue(client.userId);
    }
  }

  @SubscribeMessage('join_queue')
  async handleJoinQueue(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: {
      gameType: 'FREE' | 'PAID';
      stake?: number;
      currency?: string;
      timeControl?: string;
      timeMinutes?: number;
      increment?: number;
    },
  ) {
    if (!client.userId) throw new WsException('Unauthorized');

    const result = await this.matchmakingService.joinQueue(client.userId, data as any);

    if ('game' in result) {
      const opponentId = (result as any).opponentId;
      this.server.to(`user:${client.userId}`).emit('match_found', result);
      if (opponentId) {
        this.server.to(`user:${opponentId}`).emit('match_found', result);
      }
      return result;
    }

    return result;
  }

  @SubscribeMessage('leave_queue')
  async handleLeaveQueue(@ConnectedSocket() client: AuthenticatedSocket) {
    if (!client.userId) throw new WsException('Unauthorized');
    return this.matchmakingService.leaveQueue(client.userId);
  }

  @SubscribeMessage('invite_friend')
  async handleInviteFriend(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: {
      inviteeId: string;
      gameType: 'FREE' | 'PAID';
      stake?: number;
      currency?: string;
      timeMinutes?: number;
      increment?: number;
    },
  ) {
    if (!client.userId) throw new WsException('Unauthorized');
    const result = await this.matchmakingService.inviteFriend(client.userId, data.inviteeId, data as any);

    this.server.to(`user:${data.inviteeId}`).emit('invite_received', {
      inviteId: result.inviteId,
      inviterId: client.userId,
      inviterUsername: result.inviterUsername,
      options: {
        gameType: data.gameType,
        timeMinutes: data.timeMinutes ?? 10,
        increment: data.increment ?? 0,
        stake: data.stake,
      },
    });

    this.server.to(`user:${client.userId}`).emit('invite_sent', { inviteId: result.inviteId });

    setTimeout(async () => {
      const still = await this.matchmakingService.getInvite(result.inviteId);
      if (still) {
        await this.matchmakingService.cancelInvite(result.inviteId);
        this.server.to(`user:${client.userId}`).emit('invite_expired');
        this.server.to(`user:${data.inviteeId}`).emit('invite_cancelled');
      }
    }, 61_000);

    return result;
  }

  @SubscribeMessage('accept_invite')
  async handleAcceptInvite(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { inviteId: string },
  ) {
    if (!client.userId) throw new WsException('Unauthorized');
    const result = await this.matchmakingService.acceptInvite(data.inviteId, client.userId);

    const inviterId = (result as any).inviterId;
    this.server.to(`user:${client.userId}`).emit('match_found', result);
    if (inviterId) {
      this.server.to(`user:${inviterId}`).emit('match_found', result);
    }

    return result;
  }

  @SubscribeMessage('decline_invite')
  async handleDeclineInvite(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { inviteId: string },
  ) {
    if (!client.userId) throw new WsException('Unauthorized');
    const result = await this.matchmakingService.declineInvite(data.inviteId, client.userId);

    if (result.inviterId) {
      this.server.to(`user:${result.inviterId}`).emit('invite_declined', { inviteId: data.inviteId });
    }

    return result;
  }

  @SubscribeMessage('cancel_invite')
  async handleCancelInvite(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { inviteId: string; inviteeId: string },
  ) {
    if (!client.userId) throw new WsException('Unauthorized');
    await this.matchmakingService.cancelInvite(data.inviteId);

    this.server.to(`user:${data.inviteeId}`).emit('invite_cancelled');

    return { status: 'cancelled' };
  }
}
