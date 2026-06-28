import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Currency } from '@prisma/client';

interface OAuthUserData {
  googleId?: string;
  facebookId?: string;
  email: string;
  username: string;
  avatar?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  // True when SMTP is not configured with real credentials (dev / demo mode)
  private get mailNotConfigured(): boolean {
    const pass = this.configService.get<string>('mail.pass') ?? '';
    const user = this.configService.get<string>('mail.user') ?? '';
    const isDev = this.configService.get<string>('nodeEnv') !== 'production';
    return isDev || pass.startsWith('placeholder') || user.startsWith('placeholder') || !pass || !user;
  }

  async register(dto: RegisterDto) {
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existingEmail) throw new ConflictException('Email already registered');

    const existingUsername = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existingUsername) throw new ConflictException('Username already taken');

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // Skip email verification when SMTP is not configured — auto-verify immediately
    const skipVerification = this.mailNotConfigured;
    const verificationToken = skipVerification ? null : randomBytes(32).toString('hex');
    const verificationTokenExpiry = skipVerification
      ? null
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          username: dto.username,
          passwordHash,
          verificationToken,
          verificationTokenExpiry,
          isVerified: skipVerification,   // auto-verify in dev/when mail not set up
          region: (dto.region as Currency) ?? Currency.USD,
        },
      });

      await tx.wallet.create({
        data: {
          userId: newUser.id,
          currency: (dto.region as Currency) ?? Currency.USD,
        },
      });

      return newUser;
    });

    if (!skipVerification && verificationToken) {
      await this.mailService.sendVerificationEmail(
        user.email,
        user.username,
        verificationToken,
      );
    } else if (skipVerification) {
      const appUrl = this.configService.get<string>('appUrl', 'http://localhost:3000');
      console.log('\n========================================');
      console.log('EMAIL VERIFICATION (dev mode — auto-verified)');
      console.log(`User: ${user.email}`);
      console.log(`Verify URL: ${appUrl}/verify-email?token=(auto-verified, no token needed)`);
      console.log('========================================\n');
    }

    return {
      message: skipVerification
        ? 'Account created! You can now log in.'
        : 'Registration successful. Please check your email to verify your account.',
      userId: user.id,
    };
  }

  async login(dto: LoginDto) {
    // Accept email OR username in the email field
    const isEmail = dto.email.includes('@');
    const user = isEmail
      ? await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } })
      : await this.prisma.user.findUnique({ where: { username: dto.email } });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!isPasswordValid) throw new UnauthorizedException('Invalid credentials');

    // In dev / mail-not-configured mode: auto-verify on first login attempt
    if (!user.isVerified) {
      if (this.mailNotConfigured) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { isVerified: true },
        });
      } else {
        throw new UnauthorizedException(
          'Please verify your email before logging in',
        );
      }
    }

    if (user.isBanned) throw new UnauthorizedException('Account suspended');

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        rating: user.rating,
        role: user.role,
        region: user.region,
      },
      ...tokens,
    };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    });

    return { message: 'Email verified successfully. You can now login.' };
  }

  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Access denied');
    }

    const isValid = await argon2.verify(user.refreshTokenHash, refreshToken);
    if (!isValid) throw new UnauthorizedException('Invalid refresh token');

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: null, isOnline: false },
    });
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success to prevent email enumeration attacks
    if (!user || !user.passwordHash) {
      return { message: 'If that email exists, a reset link has been sent.' };
    }

    const token = randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: token, passwordResetExpiry: expiry },
    });

    if (this.mailNotConfigured) {
      // Dev mode: log token so developer can test without SMTP
      const appUrl = this.configService.get<string>('appUrl', 'http://localhost:3000');
      console.log('\n========================================');
      console.log('PASSWORD RESET (dev mode — no SMTP)');
      console.log(`User: ${user.email}`);
      console.log(`Token: ${token}`);
      console.log(`URL: ${appUrl}/reset-password?token=${token}`);
      console.log('========================================\n');
    } else {
      await this.mailService.sendPasswordResetEmail(user.email, user.username, token);
    }

    return { message: 'If that email exists, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new BadRequestException('Reset link is invalid or has expired.');
    }

    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
        refreshTokenHash: null, // invalidate all sessions
      },
    });

    return { message: 'Password reset successfully. You can now log in.' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });
    if (!user) throw new BadRequestException('User not found');
    if (!user.passwordHash) throw new BadRequestException('Account uses social login — set a password via Forgot Password');

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const hashed = await argon2.hash(newPassword);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hashed } });
    return { message: 'Password changed successfully' };
  }

  async findOrCreateOAuthUser(data: OAuthUserData) {
    const searchQuery = data.googleId
      ? { googleId: data.googleId }
      : { facebookId: data.facebookId };

    let user = await this.prisma.user.findFirst({ where: searchQuery });

    if (!user) {
      user = await this.prisma.user.findUnique({
        where: { email: data.email.toLowerCase() },
      });

      if (user) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            ...(data.googleId && { googleId: data.googleId }),
            ...(data.facebookId && { facebookId: data.facebookId }),
            isVerified: true,
          },
        });
      } else {
        const username = await this.generateUniqueUsername(data.username);
        user = await this.prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              email: data.email.toLowerCase(),
              username,
              avatar: data.avatar,
              isVerified: true,
              ...(data.googleId && { googleId: data.googleId }),
              ...(data.facebookId && { facebookId: data.facebookId }),
            },
          });
          await tx.wallet.create({ data: { userId: newUser.id } });
          return newUser;
        });
      }
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);
    await this.updateRefreshToken(user.id, tokens.refreshToken);

    return { user, ...tokens };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.accessSecret'),
        expiresIn: this.configService.get<string>('jwt.accessExpiresIn', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async updateRefreshToken(userId: string, refreshToken: string) {
    const hash = await argon2.hash(refreshToken, { type: argon2.argon2id });
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash: hash },
    });
  }

  private async generateUniqueUsername(base: string): Promise<string> {
    const cleaned = base.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16) || 'user';
    let username = cleaned;
    let counter = 1;

    while (await this.prisma.user.findUnique({ where: { username } })) {
      username = `${cleaned}${counter++}`;
    }

    return username;
  }
}
