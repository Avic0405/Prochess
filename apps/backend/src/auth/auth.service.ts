import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
  Inject,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import * as argon2 from 'argon2';
import { randomBytes, createHash, randomInt, createCipheriv, createDecipheriv } from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Currency } from '@prisma/client';
import { REDIS_CLIENT } from '../redis/redis.module';

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
    @Inject(REDIS_CLIENT) private redis: any,
  ) {}

  // True when SMTP is not configured with real credentials (dev / demo mode)
  private get mailNotConfigured(): boolean {
    const pass = this.configService.get<string>('mail.pass') ?? '';
    const user = this.configService.get<string>('mail.user') ?? '';
    const isDev = this.configService.get<string>('nodeEnv') !== 'production';
    return isDev || pass.startsWith('placeholder') || user.startsWith('placeholder') || !pass || !user;
  }

  async register(dto: RegisterDto) {
    // Rate limit: max 5 OTP sends per email per hour
    const rateKey = `otp:count:${dto.email.toLowerCase()}`;
    const currentCount = await this.redis.get(rateKey);
    if (currentCount && parseInt(currentCount) >= 5) {
      throw new HttpException(
        'Too many verification requests. Please try again in an hour.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Check email uniqueness in confirmed users
    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existingEmail) throw new ConflictException('Email already registered');

    // Check username uniqueness in confirmed users
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existingUsername) throw new ConflictException('Username already taken');

    // Check username uniqueness in pending registrations (different email)
    const pendingWithSameUsername = await this.prisma.pendingRegistration.findFirst({
      where: { username: dto.username, email: { not: dto.email.toLowerCase() } },
    });
    if (pendingWithSameUsername) throw new ConflictException('Username already taken');

    // Encrypt password for temporary storage — the real argon2 hash runs in verifyOtp()
    // when the account is actually created. AES is microseconds vs 5-20s for argon2 on
    // a low-resource server, keeping this endpoint responsive.
    const passwordHash = this.encryptPass(dto.password);

    // Generate 6-digit cryptographically secure OTP
    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const otpHash = createHash('sha256').update(`${otp}:${dto.email.toLowerCase()}`).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Upsert pending registration (handles re-registration attempt)
    await this.prisma.pendingRegistration.upsert({
      where: { email: dto.email.toLowerCase() },
      create: {
        email: dto.email.toLowerCase(),
        username: dto.username,
        passwordHash,
        region: dto.region ?? 'USD',
        otpHash,
        expiresAt,
        attempts: 0,
      },
      update: {
        username: dto.username,
        passwordHash,
        region: dto.region ?? 'USD',
        otpHash,
        expiresAt,
        attempts: 0,
      },
    });

    // Increment rate limit counter and set resend cooldown
    const newCount = currentCount ? parseInt(currentCount) + 1 : 1;
    await Promise.all([
      this.redis.set(rateKey, String(newCount), 'EX', 3600),
      this.redis.set(`otp:cooldown:${dto.email.toLowerCase()}`, '1', 'EX', 60),
    ]);

    // Fire-and-forget — email delivery takes 1-3s but the user doesn't need to wait
    // for it; the OTP is already saved in PendingRegistration. If sending fails, the
    // user can click "Resend" after 60 seconds.
    this.mailService.sendOtpEmail(dto.email, dto.username, otp).catch((err: Error) => {
      console.warn(`[auth] OTP email failed for ${dto.email}: ${err?.message}`);
    });

    // Log to console in dev mode for easy testing without email setup
    if (this.configService.get<string>('nodeEnv') !== 'production') {
      console.log('\n========================================');
      console.log('EMAIL OTP (dev mode)');
      console.log(`Email: ${dto.email}`);
      console.log(`OTP: ${otp}`);
      console.log(`Expires: ${expiresAt.toISOString()}`);
      console.log('========================================\n');
    }

    return {
      message: 'Verification code sent to your email. Please check your inbox.',
      email: dto.email.toLowerCase(),
    };
  }

  async verifyOtp(dto: { email: string; otp: string }) {
    const email = dto.email.toLowerCase();

    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { email },
    });

    if (!pending) {
      throw new BadRequestException(
        'No pending verification found for this email. Please register again.',
      );
    }

    if (pending.expiresAt < new Date()) {
      await this.prisma.pendingRegistration.delete({ where: { email } }).catch(() => {});
      throw new BadRequestException(
        'Verification code has expired. Please register again.',
      );
    }

    if (pending.attempts >= 10) {
      throw new HttpException(
        'Too many failed attempts. Please request a new verification code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Compute expected hash
    const expectedHash = createHash('sha256')
      .update(`${dto.otp}:${email}`)
      .digest('hex');

    if (expectedHash !== pending.otpHash) {
      // Increment attempts
      await this.prisma.pendingRegistration.update({
        where: { email },
        data: { attempts: pending.attempts + 1 },
      });
      throw new UnauthorizedException('Invalid verification code');
    }

    // OTP is valid — decrypt the temporarily-stored password and hash it properly now
    const plainPass = this.decryptPass(pending.passwordHash);
    if (!plainPass) {
      throw new BadRequestException(
        'Registration session is invalid or was created with an old format. Please register again.',
      );
    }

    // Full-strength argon2id hash runs here, not at register time, so the register
    // endpoint stays fast. The user is on the verify-otp page, so the ~5s wait is fine.
    const passwordHash = await argon2.hash(plainPass, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    // Create the account
    const user = await this.prisma.$transaction(async (tx) => {
      // Final uniqueness check (race condition protection)
      const [emailTaken, usernameTaken] = await Promise.all([
        tx.user.findUnique({ where: { email } }),
        tx.user.findUnique({ where: { username: pending.username } }),
      ]);
      if (emailTaken) throw new ConflictException('Email already registered');
      if (usernameTaken) throw new ConflictException('Username already taken');

      const newUser = await tx.user.create({
        data: {
          email,
          username: pending.username,
          passwordHash,
          isVerified: true,
          region: pending.region as any,
        },
      });

      await tx.wallet.create({
        data: {
          userId: newUser.id,
          currency: pending.region as any,
        },
      });

      return newUser;
    });

    // Clean up pending registration and rate limit key
    await Promise.all([
      this.prisma.pendingRegistration.delete({ where: { email } }).catch(() => {}),
      this.redis.del(`otp:count:${email}`),
      this.redis.del(`otp:cooldown:${email}`),
    ]);

    // Generate tokens for auto-login
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

  async resendOtp(dto: { email: string }) {
    const email = dto.email.toLowerCase();

    // Check 60-second resend cooldown
    const cooldownKey = `otp:cooldown:${email}`;
    const onCooldown = await this.redis.get(cooldownKey);
    if (onCooldown) {
      throw new HttpException(
        'Please wait 60 seconds before requesting a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Check hourly rate limit (max 5 total)
    const rateKey = `otp:count:${email}`;
    const currentCount = await this.redis.get(rateKey);
    if (currentCount && parseInt(currentCount) >= 5) {
      throw new HttpException(
        'Too many verification requests. Please try again in an hour.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const pending = await this.prisma.pendingRegistration.findUnique({
      where: { email },
    });

    if (!pending) {
      throw new BadRequestException(
        'No pending verification found. Please register again.',
      );
    }

    // Generate new OTP
    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const otpHash = createHash('sha256').update(`${otp}:${email}`).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.prisma.pendingRegistration.update({
      where: { email },
      data: { otpHash, expiresAt, attempts: 0 },
    });

    // Update rate limit and set cooldown
    const newCount = currentCount ? parseInt(currentCount) + 1 : 1;
    await Promise.all([
      this.redis.set(rateKey, String(newCount), 'EX', 3600),
      this.redis.set(cooldownKey, '1', 'EX', 60),
    ]);

    this.mailService.sendOtpEmail(pending.email, pending.username, otp).catch((err: Error) => {
      console.warn(`[auth] OTP resend email failed for ${email}: ${err?.message}`);
    });

    if (this.configService.get<string>('nodeEnv') !== 'production') {
      console.log('\n========================================');
      console.log('EMAIL OTP RESEND (dev mode)');
      console.log(`Email: ${email}`);
      console.log(`OTP: ${otp}`);
      console.log('========================================\n');
    }

    return { message: 'A new verification code has been sent to your email.' };
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

  // Derives a deterministic 32-byte AES key from the JWT access secret.
  private deriveEncKey(): Buffer {
    const secret = this.configService.get<string>('jwt.accessSecret') ?? 'prochess-fallback-enc-key';
    return createHash('sha256').update(secret).digest();
  }

  // AES-256-CBC encrypt — used to store passwords temporarily in PendingRegistration.
  private encryptPass(plaintext: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.deriveEncKey(), iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return `enc:${iv.toString('hex')}:${enc.toString('hex')}`;
  }

  // Returns null on any failure so callers can surface a friendly error.
  private decryptPass(stored: string): string | null {
    try {
      if (!stored.startsWith('enc:')) return null;
      const parts = stored.split(':');
      if (parts.length !== 3) return null;
      const iv = Buffer.from(parts[1], 'hex');
      const data = Buffer.from(parts[2], 'hex');
      const decipher = createDecipheriv('aes-256-cbc', this.deriveEncKey(), iv);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch {
      return null;
    }
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
