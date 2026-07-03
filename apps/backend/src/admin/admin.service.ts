import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const [
      totalUsers,
      activeGames,
      totalGames,
      totalTransactions,
      revenue,
      newUsersToday,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.game.count({ where: { status: 'ACTIVE' } }),
      this.prisma.game.count(),
      this.prisma.transaction.count({ where: { status: 'COMPLETED' } }),
      this.prisma.transaction.aggregate({
        where: { type: 'COMMISSION', status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      this.prisma.user.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ]);

    return {
      totalUsers,
      activeGames,
      totalGames,
      totalTransactions,
      totalRevenue: revenue._sum.amount ?? 0,
      newUsersToday,
    };
  }

  async getUsers(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { username: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, email: true, username: true, rating: true,
          isVerified: true, isBanned: true, role: true,
          gamesPlayed: true, createdAt: true,
          wallets: { select: { balance: true, currency: true, isActive: true }, orderBy: { isActive: 'desc' } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, page, limit };
  }

  async banUser(userId: string, ban: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id: userId },
      data: { isBanned: ban },
    });

    return { message: `User ${ban ? 'banned' : 'unbanned'} successfully` };
  }

  async getGames(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : {};

    const [games, total] = await Promise.all([
      this.prisma.game.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          whitePlayer: { select: { username: true } },
          blackPlayer: { select: { username: true } },
        },
      }),
      this.prisma.game.count({ where }),
    ]);

    return { games, total, page, limit };
  }

  async getPayments(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      this.prisma.transaction.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          wallet: { select: { user: { select: { username: true } } } },
        },
      }),
      this.prisma.transaction.count(),
    ]);

    return { transactions, total, page, limit };
  }

  async resolveDispute(gameId: string, resolution: 'white_wins' | 'black_wins' | 'draw') {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: { whitePlayer: true, blackPlayer: true },
    });

    if (!game) throw new NotFoundException('Game not found');

    const resultMap = {
      white_wins: 'WHITE_WINS',
      black_wins: 'BLACK_WINS',
      draw: 'DRAW',
    } as const;

    await this.prisma.game.update({
      where: { id: gameId },
      data: {
        status: 'COMPLETED',
        result: resultMap[resolution],
        endedAt: new Date(),
      },
    });

    return { message: `Dispute resolved: ${resolution}` };
  }
}
