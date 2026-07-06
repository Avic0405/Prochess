import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';
import { GamesGateway } from './games.gateway';
import { GameStateService } from './game-state.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [JwtModule.register({}), NotificationsModule, UsersModule],
  controllers: [GamesController],
  providers: [GamesService, GamesGateway, GameStateService],
  exports: [GamesService, GamesGateway, GameStateService],
})
export class GamesModule {}
