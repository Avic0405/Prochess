import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  Next,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response, NextFunction } from 'express';
import * as passport from 'passport';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
import { ConfigService } from '@nestjs/config';

@ApiTags('auth')
@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered' })
  @ApiResponse({ status: 409, description: 'Email or username taken' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify OTP and create account' })
  @ApiResponse({ status: 200, description: 'Account created, tokens returned' })
  @ApiResponse({ status: 400, description: 'Invalid or expired OTP' })
  @ApiResponse({ status: 429, description: 'Too many attempts' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend OTP verification email' })
  @ApiResponse({ status: 200, description: 'New OTP sent' })
  @ApiResponse({ status: 429, description: 'Too many requests or cooldown active' })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Get('verify/:token')
  @ApiOperation({ summary: 'Verify email address' })
  verifyEmail(@Param('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request a password reset email' })
  forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password using token from email' })
  resetPassword(@Body() body: { token: string; password: string }) {
    return this.authService.resetPassword(body.token, body.password);
  }

  @Public()
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(
    @CurrentUser() user: { sub: string; refreshToken: string },
    @Body() _dto: RefreshTokenDto,
  ) {
    return this.authService.refreshTokens(user.sub, user.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Logout user' })
  logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
  }

  // ─── Google OAuth ──────────────────────────────────────────────────────────

  @Public()
  @Get('google')
  @ApiOperation({ summary: 'Initiate Google OAuth' })
  googleAuth(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    const clientId = this.configService.get<string>('oauth.google.clientId') ?? '';
    if (!clientId || clientId.startsWith('placeholder')) {
      const appUrl = this.configService.get<string>('appUrl', 'http://localhost:3000');
      return res.redirect(
        `${appUrl}/login?error=${encodeURIComponent('Google OAuth is not configured. Add a real GOOGLE_CLIENT_ID to the backend .env file.')}`,
      );
    }
    return passport.authenticate('google', { scope: ['email', 'profile'] })(req, res, next);
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Google OAuth callback' })
  googleCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as { accessToken: string; refreshToken: string };
    const appUrl = this.configService.get<string>('appUrl', 'http://localhost:3000');
    const params = new URLSearchParams({ token: user.accessToken, refreshToken: user.refreshToken ?? '', provider: 'google' });
    res.redirect(`${appUrl}/oauth-success?${params.toString()}`);
  }

  // ─── Facebook OAuth ────────────────────────────────────────────────────────

  @Public()
  @Get('facebook')
  @ApiOperation({ summary: 'Initiate Facebook OAuth' })
  facebookAuth(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    const appId = this.configService.get<string>('oauth.facebook.appId') ?? '';
    if (!appId || appId.startsWith('placeholder')) {
      const appUrl = this.configService.get<string>('appUrl', 'http://localhost:3000');
      return res.redirect(
        `${appUrl}/login?error=${encodeURIComponent('Facebook OAuth is not configured. Add a real FACEBOOK_APP_ID to the backend .env file.')}`,
      );
    }
    return passport.authenticate('facebook', { scope: ['email'] })(req, res, next);
  }

  @Public()
  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  @ApiOperation({ summary: 'Facebook OAuth callback' })
  facebookCallback(@Req() req: Request, @Res() res: Response) {
    const user = req.user as { accessToken: string; refreshToken: string };
    const appUrl = this.configService.get<string>('appUrl', 'http://localhost:3000');
    const params = new URLSearchParams({ token: user.accessToken, refreshToken: user.refreshToken ?? '', provider: 'facebook' });
    res.redirect(`${appUrl}/oauth-success?${params.toString()}`);
  }

  @Get('me')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current user' })
  getMe(@CurrentUser() user: unknown) {
    return user;
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Change password for authenticated user' })
  changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto.currentPassword, dto.newPassword);
  }
}
