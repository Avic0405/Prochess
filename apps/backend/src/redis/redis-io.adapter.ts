import { INestApplication } from '@nestjs/common';
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
 *
 * `super(app)` is required, not cosmetic: none of our gateways set a `port`
 * option, so Nest's WebSocketsController always calls createIOServer(0, ...).
 * The base IoAdapter only reuses the app's real HTTP server when BOTH
 * `this.httpServer` is set AND port === 0 — `this.httpServer` only gets set
 * from the `app` passed to `super()`. Without it, createIOServer falls
 * through to `new Server(0, options)`, which spins up its own standalone
 * http.Server and listens on a random OS-assigned port — completely
 * disconnected from the app's real port. Every client WebSocket handshake
 * then 404s against the real server, which has no such route.
 */
export class RedisIoAdapter extends IoAdapter {
  constructor(app: INestApplication, private readonly redisClient: Redis) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const server = super.createIOServer(port, options);
    const pub = this.redisClient.duplicate();
    const sub = this.redisClient.duplicate();
    server.adapter(createAdapter(pub, sub));
    return server;
  }
}
