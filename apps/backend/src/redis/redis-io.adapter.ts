import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';

/**
 * Attaches the Redis adapter once, on the root Socket.IO server, before any
 * namespaced gateway (/game, /matchmaking, /notifications) attaches to it.
 * Namespace objects (what each @WebSocketGateway({ namespace }) actually
 * receives in afterInit) don't have an .adapter() method — only the root
 * server does — so per-gateway `server.adapter(...)` calls throw at runtime.
 */
export class RedisIoAdapter extends IoAdapter {
  constructor(private readonly redisClient: Redis) {
    super();
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    const pub = this.redisClient.duplicate();
    const sub = this.redisClient.duplicate();
    server.adapter(createAdapter(pub, sub));
    return server;
  }
}
