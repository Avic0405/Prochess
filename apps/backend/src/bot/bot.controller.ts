import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { BotService } from './bot.service';
import { StartBotGameDto } from './dto/start-bot-game.dto';
import { EndBotGameDto } from './dto/end-bot-game.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('bot')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('bot')
export class BotController {
  constructor(private botService: BotService) {}

  @Get('levels')
  @ApiOperation({ summary: 'Get all bot levels with my unlock/progress status' })
  getLevels(@CurrentUser('id') userId: string) {
    return this.botService.getLevels(userId);
  }

  @Post('start')
  @ApiOperation({ summary: 'Start a bot game at the given level' })
  startGame(@CurrentUser('id') userId: string, @Body() dto: StartBotGameDto) {
    return this.botService.startGame(userId, dto.levelId);
  }

  @Post('end')
  @ApiOperation({ summary: 'Record the result of a finished bot game' })
  endGame(@CurrentUser('id') userId: string, @Body() dto: EndBotGameDto) {
    return this.botService.endGame(userId, dto);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get my bot game history' })
  getHistory(
    @CurrentUser('id') userId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.botService.getHistory(userId, page, limit);
  }
}
