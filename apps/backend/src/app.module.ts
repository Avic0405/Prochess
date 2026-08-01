import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GamesModule } from './games/games.module';
import { BotModule } from './bot/bot.module';
import { MatchmakingModule } from './matchmaking/matchmaking.module';
import { PaymentsModule } from './payments/payments.module';
import { WalletModule } from './wallet/wallet.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AdminModule } from './admin/admin.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 100 }],
    }),
    PrismaModule,
    RedisModule,
    MailModule,
    HealthModule,
    AuthModule,
    UsersModule,
    GamesModule,
    BotModule,
    MatchmakingModule,
    PaymentsModule,
    WalletModule,
    NotificationsModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
