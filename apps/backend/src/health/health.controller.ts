import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Full system health check' })
  async check() {
    const t0 = Date.now();

    const [dbResult, redisResult] = await Promise.allSettled([
      this.timedQuery(() => this.prisma.$queryRaw`SELECT 1`),
      this.timedPing(),
    ]);

    const db = dbResult.status === 'fulfilled'
      ? { status: 'ok', latencyMs: dbResult.value }
      : { status: 'error', error: (dbResult.reason as Error)?.message };

    const cache = redisResult.status === 'fulfilled'
      ? { status: 'ok', latencyMs: redisResult.value }
      : { status: 'error', error: (redisResult.reason as Error)?.message };

    const email = this.mailService.verifyConnection();

    const mem = process.memoryUsage();
    const onlineUsers = await this.redis.scard('online:users').catch(() => 0);

    const healthy = db.status === 'ok' && cache.status === 'ok';

    return {
      status: healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      version: process.env.npm_package_version ?? 'unknown',
      responseMs: Date.now() - t0,
      services: {
        database: db,
        cache,
        email: { status: email.status, provider: email.provider },
      },
      realtime: {
        onlineUsers,
      },
      memory: {
        heapUsedMb: Math.round(mem.heapUsed / 1_048_576),
        heapTotalMb: Math.round(mem.heapTotal / 1_048_576),
        rssMb: Math.round(mem.rss / 1_048_576),
      },
    };
  }

  @Get('email')
  @ApiOperation({ summary: 'Email provider health check' })
  checkEmail() {
    return this.mailService.verifyConnection();
  }

  private async timedQuery(fn: () => Promise<unknown>): Promise<number> {
    const t = Date.now();
    await fn();
    return Date.now() - t;
  }

  private async timedPing(): Promise<number> {
    const t = Date.now();
    await this.redis.ping();
    return Date.now() - t;
  }
}
