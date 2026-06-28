import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = client.handshake.auth?.token;
      if (!token) { client.disconnect(true); return; }

      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.accessSecret'),
      });

      client.userId = payload.sub;
      client.join(`notifications:${payload.sub}`);

      // Mark user online whenever they load any authenticated page
      await this.prisma.user.update({
        where: { id: payload.sub },
        data: { isOnline: true },
      });
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    this.logger.debug(`Notifications client disconnected: ${client.id}`);
    if (client.userId) {
      await this.prisma.user.update({
        where: { id: client.userId },
        data: { isOnline: false, lastSeenAt: new Date() },
      }).catch(() => {});
    }
  }

  sendToUser(userId: string, notification: unknown) {
    this.server?.to(`notifications:${userId}`).emit('notification', notification);
  }
}
