import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { GamesGateway } from './games.gateway';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [JwtModule.register({}), NotificationsModule, UsersModule],
  controllers: [GamesController],
  providers: [GamesService, GamesGateway],
  exports: [GamesService, GamesGateway],
})
export class GamesModule {}
