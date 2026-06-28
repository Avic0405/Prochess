import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { IsBoolean, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class BanUserDto {
  @ApiProperty()
  @IsBoolean()
  ban: boolean;
}

class ResolveDisputeDto {
  @ApiProperty()
  @IsIn(['white_wins', 'black_wins', 'draw'])
  resolution: 'white_wins' | 'black_wins' | 'draw';
}

@ApiTags('admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN' as any)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  getStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  getUsers(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    return this.adminService.getUsers(page, limit, search);
  }

  @Patch('users/:id/ban')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ban or unban user' })
  banUser(@Param('id') userId: string, @Body() dto: BanUserDto) {
    return this.adminService.banUser(userId, dto.ban);
  }

  @Get('games')
  @ApiOperation({ summary: 'List all games' })
  getGames(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('status') status?: string,
  ) {
    return this.adminService.getGames(page, limit, status);
  }

  @Get('payments')
  @ApiOperation({ summary: 'List all transactions' })
  getPayments(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.adminService.getPayments(page, limit);
  }

  @Post('games/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve game dispute' })
  resolveDispute(
    @Param('id') gameId: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.adminService.resolveDispute(gameId, dto.resolution);
  }
}
