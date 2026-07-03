import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Currency } from '@prisma/client';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  async getOrCreateWallet(userId: string, currency: Currency = Currency.USD) {
    const existing = await this.prisma.wallet.findFirst({
      where: { userId, currency },
    });
    if (existing) return existing;

    // Count existing wallets — first one created is active
    const count = await this.prisma.wallet.count({ where: { userId } });

    return this.prisma.wallet.create({
      data: { userId, currency, isActive: count === 0 },
    });
  }

  async getActiveWallet(userId: string) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { userId, isActive: true },
    });
    if (!wallet) throw new NotFoundException('No active wallet found');
    return {
      ...wallet,
      balance: Number(wallet.balance),
      lockedBalance: Number(wallet.lockedBalance),
    };
  }

  async getAllWallets(userId: string) {
    const wallets = await this.prisma.wallet.findMany({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
    });
    return wallets.map((w) => ({
      ...w,
      balance: Number(w.balance),
      lockedBalance: Number(w.lockedBalance),
    }));
  }

  async switchActiveWallet(userId: string, currency: Currency) {
    const target = await this.prisma.wallet.findFirst({
      where: { userId, currency },
    });
    if (!target) {
      throw new NotFoundException(
        `You don't have a ${currency} wallet. Create one first.`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.wallet.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.wallet.update({
        where: { id: target.id },
        data: { isActive: true },
      }),
    ]);

    return {
      ...target,
      isActive: true,
      balance: Number(target.balance),
      lockedBalance: Number(target.lockedBalance),
    };
  }

  async createWallet(userId: string, currency: Currency) {
    const existing = await this.prisma.wallet.findFirst({
      where: { userId, currency },
    });
    if (existing) {
      throw new ConflictException(`You already have a ${currency} wallet`);
    }

    return this.prisma.wallet.create({
      data: { userId, currency, isActive: false },
      select: {
        id: true, userId: true, currency: true,
        balance: true, lockedBalance: true, isActive: true,
      },
    });
  }

  async getWalletByCurrency(userId: string, currency: Currency) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { userId, currency },
    });
    return wallet ?? null;
  }

  async getBalance(userId: string) {
    const wallet = await this.prisma.wallet.findFirst({
      where: { userId, isActive: true },
      select: {
        balance: true,
        lockedBalance: true,
        currency: true,
        isActive: true,
        updatedAt: true,
      },
    });

    if (!wallet) throw new NotFoundException('No active wallet found');
    return {
      ...wallet,
      balance: Number(wallet.balance),
      lockedBalance: Number(wallet.lockedBalance),
    };
  }

  async getTransactionHistory(userId: string, page = 1, limit = 20) {
    // Transactions across all wallets belonging to the user
    const wallets = await this.prisma.wallet.findMany({
      where: { userId },
      select: { id: true },
    });
    if (!wallets.length) throw new NotFoundException('No wallets found');

    const walletIds = wallets.map((w) => w.id);
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { walletId: { in: walletIds } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          wallet: { select: { currency: true } },
          game: { select: { id: true, type: true, result: true } },
        },
      }),
      this.prisma.transaction.count({ where: { walletId: { in: walletIds } } }),
    ]);

    return {
      transactions: transactions.map((tx) => ({
        ...tx,
        amount: Number(tx.amount),
        currency: tx.currency ?? tx.wallet.currency,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }
}
