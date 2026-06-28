import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsString, IsOptional, MinLength, MaxLength, Matches, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class UpdateProfileDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/)
  username?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  avatar?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsIn(['USD', 'INR'])
  region?: string;
}

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my profile' })
  getMyProfile(@CurrentUser('id') userId: string) {
    return this.usersService.getMyProfile(userId);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update my profile' })
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Post('me/avatar')
  @ApiOperation({ summary: 'Upload profile avatar' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: diskStorage({
        destination: (_req: any, _file: any, cb: (e: any, d: string) => void) => {
          const dir = path.join(process.cwd(), 'uploads', 'avatars');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req: any, file: any, cb: (e: any, d: string) => void) => {
          const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
          cb(null, `${req.user.id}_${Date.now()}${ext}`);
        },
      }),
      fileFilter: (_req: any, file: any, cb: (e: any, accept: boolean) => void) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: any,
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.usersService.updateAvatar(userId, `/uploads/avatars/${file.filename}`);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search users by username' })
  @ApiQuery({ name: 'q', required: true })
  searchUsers(
    @Query('q') query: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.usersService.searchUsers(query, userId);
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get ELO leaderboard' })
  getLeaderboard(
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
  ) {
    return this.usersService.getLeaderboard(limit);
  }

  @Get('friends')
  @ApiOperation({ summary: 'Get my friends list' })
  getFriends(@CurrentUser('id') userId: string) {
    return this.usersService.getFriends(userId);
  }

  @Get('friends/requests')
  @ApiOperation({ summary: 'Get pending friend requests' })
  getPendingRequests(@CurrentUser('id') userId: string) {
    return this.usersService.getPendingRequests(userId);
  }

  @Post('friends/request/:userId')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Send friend request' })
  @ApiParam({ name: 'userId', description: 'Target user ID' })
  sendFriendRequest(
    @CurrentUser('id') senderId: string,
    @Param('userId') receiverId: string,
  ) {
    return this.usersService.sendFriendRequest(senderId, receiverId);
  }

  @Post('friends/request/:requestId/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept friend request' })
  acceptRequest(
    @CurrentUser('id') userId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.usersService.respondToFriendRequest(requestId, userId, 'accept');
  }

  @Post('friends/request/:requestId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject friend request' })
  rejectRequest(
    @CurrentUser('id') userId: string,
    @Param('requestId') requestId: string,
  ) {
    return this.usersService.respondToFriendRequest(requestId, userId, 'reject');
  }

  @Get(':username')
  @ApiOperation({ summary: 'Get user public profile' })
  @ApiParam({ name: 'username' })
  getProfile(@Param('username') username: string) {
    return this.usersService.getProfile(username);
  }
}
