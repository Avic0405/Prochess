import {
  Injectable,
  OnModuleInit,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EndBotGameDto } from './dto/end-bot-game.dto';

interface LevelSeed {
  level: number;
  name: string;
  elo: number;
  description: string;
}

const LEVEL_SEEDS: LevelSeed[] = [
  { level: 1, name: 'Beginner', elo: 400, description: 'Perfect for new players' },
  { level: 2, name: 'Easy', elo: 800, description: 'Defeat Beginner to unlock' },
  { level: 3, name: 'Novice', elo: 1200, description: 'Defeat Easy to unlock' },
  { level: 4, name: 'Intermediate', elo: 1600, description: 'Defeat Novice to unlock' },
  { level: 5, name: 'Advanced', elo: 2000, description: 'Defeat Intermediate to unlock' },
  { level: 6, name: 'Expert', elo: 2400, description: 'Defeat Advanced to unlock' },
  { level: 7, name: 'Master', elo: 2800, description: 'Defeat Expert to unlock' },
  { level: 8, name: 'Grandmaster', elo: 3200, description: 'Defeat Master to unlock' },
];

@Injectable()
export class BotService implements OnModuleInit {
  constructor(private prisma: PrismaService) {}

  // Idempotent — safe to run on every boot, no separate seed script needed in production.
  async onModuleInit() {
    for (const seed of LEVEL_SEEDS) {
      await this.prisma.botLevel.upsert({
        where: { level: seed.level },
        update: { name: seed.name, elo: seed.elo, description: seed.description },
        create: seed,
      });
    }
  }

  async getLevels(userId: string) {
    const levels = await this.prisma.botLevel.findMany({ orderBy: { level: 'asc' } });
    const progress = await this.prisma.userBotProgress.findMany({ where: { userId } });
    const progressByLevelId = new Map(progress.map((p) => [p.botLevelId, p]));

    return levels.map((lvl) => {
      const p = progressByLevelId.get(lvl.id);
      return {
        id: lvl.id,
        level: lvl.level,
        name: lvl.name,
        elo: lvl.elo,
        description: lvl.description,
        isUnlocked: lvl.level === 1 ? true : (p?.isUnlocked ?? false),
        wins: p?.wins ?? 0,
        losses: p?.losses ?? 0,
        draws: p?.draws ?? 0,
        attempts: p?.attempts ?? 0,
        completedAt: p?.completedAt ?? null,
      };
    });
  }

  private async getOrCreateProgress(userId: string, botLevelId: string, level: number) {
    const existing = await this.prisma.userBotProgress.findUnique({
      where: { userId_botLevelId: { userId, botLevelId } },
    });
    if (existing) return existing;
    return this.prisma.userBotProgress.create({
      data: { userId, botLevelId, isUnlocked: level === 1 },
    });
  }

  async startGame(userId: string, levelId: string) {
    const level = await this.prisma.botLevel.findUnique({ where: { id: levelId } });
    if (!level) throw new NotFoundException('Bot level not found');

    const progress = await this.getOrCreateProgress(userId, levelId, level.level);
    if (!progress.isUnlocked && level.level !== 1) {
      throw new ForbiddenException('This level is locked — defeat the previous level first');
    }

    await this.prisma.userBotProgress.update({
      where: { id: progress.id },
      data: { attempts: { increment: 1 } },
    });

    return { level: level.level, name: level.name, elo: level.elo };
  }

  async endGame(userId: string, dto: EndBotGameDto) {
    const level = await this.prisma.botLevel.findUnique({ where: { id: dto.levelId } });
    if (!level) throw new NotFoundException('Bot level not found');

    await this.prisma.botGameHistory.create({
      data: {
        userId,
        botLevelId: dto.levelId,
        result: dto.result,
        pgn: dto.pgn,
        fen: dto.fen,
        moveCount: dto.moveCount ?? 0,
      },
    });

    const progress = await this.getOrCreateProgress(userId, dto.levelId, level.level);

    const updateData: {
      wins?: { increment: number };
      losses?: { increment: number };
      draws?: { increment: number };
      completedAt?: Date;
    } = {};
    if (dto.result === 'WIN') updateData.wins = { increment: 1 };
    else if (dto.result === 'LOSS') updateData.losses = { increment: 1 };
    else if (dto.result === 'DRAW') updateData.draws = { increment: 1 };

    if (dto.result === 'WIN' && !progress.completedAt) {
      updateData.completedAt = new Date();
    }

    await this.prisma.userBotProgress.update({
      where: { id: progress.id },
      data: updateData,
    });

    if (dto.result === 'WIN') {
      const nextLevel = await this.prisma.botLevel.findUnique({
        where: { level: level.level + 1 },
      });
      if (nextLevel) {
        await this.prisma.userBotProgress.upsert({
          where: { userId_botLevelId: { userId, botLevelId: nextLevel.id } },
          update: { isUnlocked: true },
          create: { userId, botLevelId: nextLevel.id, isUnlocked: true },
        });
      }
    }

    return { success: true };
  }

  async getHistory(userId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [history, total] = await Promise.all([
      this.prisma.botGameHistory.findMany({
        where: { userId },
        include: { botLevel: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.botGameHistory.count({ where: { userId } }),
    ]);

    return { history, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
