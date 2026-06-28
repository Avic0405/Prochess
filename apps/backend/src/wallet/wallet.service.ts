import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  async getOrCreateWallet(userId: string) {
    const existing = await this.prisma.wallet.findUnique({ where: { userId } });
    if (existing) return existing;

    return this.prisma.wallet.create({ data: { userId } });
  }

  async getBalance(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: {
        balance: true,
        lockedBalance: true,
        currency: true,
        updatedAt: true,
      },
    });

    if (!wallet) throw new NotFoundException('Wallet not found');
    return {
      ...wallet,
      balance: Number(wallet.balance),
      lockedBalance: Number(wallet.lockedBalance),
    };
  }

  async getTransactionHistory(userId: string, page = 1, limit = 20) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const skip = (page - 1) * limit;
    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          game: {
            select: { id: true, type: true, result: true },
          },
        },
      }),
      this.prisma.transaction.count({ where: { walletId: wallet.id } }),
    ]);

    return {
      transactions: transactions.map((tx) => ({ ...tx, amount: Number(tx.amount) })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }
}
