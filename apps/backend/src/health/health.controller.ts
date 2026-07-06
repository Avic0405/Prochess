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
    const checks = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.ping(),
    ]);

    const db = checks[0].status === 'fulfilled' ? 'ok' : 'error';
    const cache = checks[1].status === 'fulfilled' ? 'ok' : 'error';
    const email = this.mailService.verifyConnection();

    const healthy = db === 'ok' && cache === 'ok';

    return {
      status: healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: db,
        cache,
        email: email.status,
      },
    };
  }

  @Get('email')
  @ApiOperation({ summary: 'Email provider health check' })
  checkEmail() {
    return this.mailService.verifyConnection();
  }
}
