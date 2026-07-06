import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import Redis from 'ioredis';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.accessSecret'),
    });
  }

  async validate(payload: JwtPayload) {
    const cacheKey = `jwt:user:${payload.sub}`;

    // Cache hit — skip Postgres
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const user = JSON.parse(cached);
      if (user.isBanned) throw new UnauthorizedException('Account suspended');
      return user;
    }

    // Cache miss — hit Postgres, cache result for 5 minutes
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, username: true, role: true, isBanned: true, isVerified: true },
    });

    if (!user) throw new UnauthorizedException('User not found');
    if (user.isBanned) throw new UnauthorizedException('Account suspended');

    await this.redis.setex(cacheKey, 300, JSON.stringify(user));
    return user;
  }
}
