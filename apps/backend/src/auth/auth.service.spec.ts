import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { WalletService } from '../wallet/wallet.service';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  wallet: { create: jest.fn() },
  $transaction: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue('token') } },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test-secret') } },
        { provide: MailService, useValue: { sendVerificationEmail: jest.fn() } },
        { provide: WalletService, useValue: { getOrCreateWallet: jest.fn() } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('should throw ConflictException if email exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: '1', email: 'test@test.com' });

      await expect(
        service.register({ email: 'test@test.com', username: 'user', password: 'Test@123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if username taken', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce({ id: '2', username: 'existing' }); // username check

      await expect(
        service.register({ email: 'new@test.com', username: 'existing', password: 'Test@123' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should throw UnauthorizedException for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.login({ email: 'noone@test.com', password: 'Test@123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
