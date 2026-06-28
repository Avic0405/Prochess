import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MatchmakingService } from './matchmaking.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsString, IsNumber, IsOptional, IsIn, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class JoinQueueDto {
  @ApiProperty()
  @IsIn(['FREE', 'PAID'])
  gameType: 'FREE' | 'PAID';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  stake?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsIn(['USD', 'INR'])
  currency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  timeMinutes?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  increment?: number;
}

class InviteFriendDto {
  @ApiProperty()
  @IsString()
  inviteeId: string;

  @ApiProperty()
  @IsIn(['FREE', 'PAID'])
  gameType: 'FREE' | 'PAID';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  stake?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsIn(['USD', 'INR'])
  currency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  timeMinutes?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  increment?: number;
}

@ApiTags('matchmaking')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('matchmaking')
export class MatchmakingController {
  constructor(private matchmakingService: MatchmakingService) {}

  @Post('queue/join')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Join matchmaking queue (REST fallback)' })
  joinQueue(@CurrentUser('id') userId: string, @Body() dto: JoinQueueDto) {
    return this.matchmakingService.joinQueue(userId, dto);
  }

  @Delete('queue/leave')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Leave matchmaking queue' })
  leaveQueue(@CurrentUser('id') userId: string) {
    return this.matchmakingService.leaveQueue(userId);
  }

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite friend to game' })
  invite(@CurrentUser('id') userId: string, @Body() dto: InviteFriendDto) {
    return this.matchmakingService.inviteFriend(userId, dto.inviteeId, dto);
  }

  @Post('invite/:inviteId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept game invite' })
  acceptInvite(
    @CurrentUser('id') userId: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.matchmakingService.acceptInvite(inviteId, userId);
  }
}
