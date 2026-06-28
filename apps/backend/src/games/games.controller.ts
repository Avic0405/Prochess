import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { GamesService } from './games.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('games')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('games')
export class GamesController {
  constructor(private gamesService: GamesService) {}

  @Get('history')
  @ApiOperation({ summary: 'Get my game history' })
  getHistory(
    @CurrentUser('id') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('result') result?: string,
    @Query('gameType') gameType?: string,
    @Query('timeMinutes', new DefaultValuePipe(0), ParseIntPipe) timeMinutes?: number,
  ) {
    return this.gamesService.getGameHistory(userId, page, limit, {
      result,
      gameType,
      timeMinutes: timeMinutes || undefined,
    });
  }

  @Get('active')
  @ApiOperation({ summary: 'Get my currently active game (if any)' })
  getActiveGame(@CurrentUser('id') userId: string) {
    return this.gamesService.getActiveGame(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get game by ID' })
  getGame(@Param('id') id: string) {
    return this.gamesService.getGame(id);
  }
}
