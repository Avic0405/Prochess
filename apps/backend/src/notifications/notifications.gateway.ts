import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

const WS_ORIGINS = (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3001')
  .split(',').map((s: string) => s.trim()).filter(Boolean);

@WebSocketGateway({
  cors: { origin: WS_ORIGINS, credentials: true },
  namespace: '/notifications',
  transports: ['websocket'],
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  afterInit() {
    this.logger.log('✓ Notifications WS Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) { client.disconnect(true); return; }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });

      client.userId = payload.sub;
      client.join(`notifications:${payload.sub}`);

      // Dedup: collapse concurrent online-status writes (same user connecting to multiple namespaces)
      const lock = `online:write:${payload.sub}:1`;
      const acquired = await this.redis.set(lock, '1', 'EX', 2, 'NX');
      if (acquired) {
        await this.prisma.user.update({ where: { id: payload.sub }, data: { isOnline: true } });
      }
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    this.logger.debug(`Notifications client disconnected: ${client.id}`);
    if (client.userId) {
      const lock = `online:write:${client.userId}:0`;
      const acquired = await this.redis.set(lock, '1', 'EX', 2, 'NX');
      if (acquired) {
        await this.prisma.user.update({
          where: { id: client.userId },
          data: { isOnline: false, lastSeenAt: new Date() },
        }).catch(() => {});
      }
    }
  }

  sendToUser(userId: string, notification: unknown) {
    this.server?.to(`notifications:${userId}`).emit('notification', notification);
  }
}
