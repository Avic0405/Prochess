import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Chess } from 'chess.js';
import { GameResult, GameStatus, Currency } from '@prisma/client';

const ELO_K_FACTOR = 32;

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
    private configService: ConfigService,
  ) {}

  private serializeGame<T extends Record<string, any>>(game: T): T {
    return { ...game, stake: game.stake != null ? Number(game.stake) : null };
  }

  async createFreeGame(
    whitePlayerId: string,
    blackPlayerId: string,
    options: { timeMinutes?: number; increment?: number },
  ) {
    const timeMinutes = options.timeMinutes ?? 10;
    const increment = options.increment ?? 0;
    const timeSeconds = timeMinutes * 60;

    const game = await this.prisma.game.create({
      data: {
        whitePlayerId,
        blackPlayerId,
        type: 'FREE',
        timeMinutes,
        increment,
        whiteTimeLeft: timeSeconds,
        blackTimeLeft: timeSeconds,
        status: 'ACTIVE',
        startedAt: new Date(),
        whiteAccepted: true,
        blackAccepted: true,
      },
      include: {
        whitePlayer: { select: { id: true, username: true, avatar: true, rating: true } },
        blackPlayer: { select: { id: true, username: true, avatar: true, rating: true } },
      },
    });
    return this.serializeGame(game);
  }

  async createPaidGame(
    whitePlayerId: string,
    blackPlayerId: string,
    options: {
      timeMinutes?: number;
      increment?: number;
      stake: number;
      currency: Currency;
    },
  ) {
    const timeMinutes = options.timeMinutes ?? 10;
    const increment = options.increment ?? 0;
    const timeSeconds = timeMinutes * 60;

    // Validate both players have a wallet for the game currency with sufficient balance
    const [whiteWallet, blackWallet] = await Promise.all([
      this.prisma.wallet.findFirst({ where: { userId: whitePlayerId, currency: options.currency } }),
      this.prisma.wallet.findFirst({ where: { userId: blackPlayerId, currency: options.currency } }),
    ]);

    if (!whiteWallet) {
      throw new BadRequestException(
        `White player does not have a ${options.currency} wallet`,
      );
    }
    if (!blackWallet) {
      throw new BadRequestException(
        `Black player does not have a ${options.currency} wallet`,
      );
    }
    if (Number(whiteWallet.balance) < options.stake) {
      throw new BadRequestException('White player has insufficient balance');
    }
    if (Number(blackWallet.balance) < options.stake) {
      throw new BadRequestException('Black player has insufficient balance');
    }

    // Create game and lock escrow in a transaction
    const game = await this.prisma.$transaction(async (tx) => {
      const newGame = await tx.game.create({
        data: {
          whitePlayerId,
          blackPlayerId,
          type: 'PAID',
          timeMinutes,
          increment,
          stake: options.stake,
          currency: options.currency,
          whiteTimeLeft: timeSeconds,
          blackTimeLeft: timeSeconds,
          status: 'ACTIVE',
          startedAt: new Date(),
          whiteAccepted: true,
          blackAccepted: true,
          whitePaid: true,
          blackPaid: true,
          escrowHeld: true,
        },
        include: {
          whitePlayer: { select: { id: true, username: true, avatar: true, rating: true } },
          blackPlayer: { select: { id: true, username: true, avatar: true, rating: true } },
        },
      });

      // Lock funds for both players (by wallet ID, not userId)
      await tx.wallet.update({
        where: { id: whiteWallet.id },
        data: {
          balance: { decrement: options.stake },
          lockedBalance: { increment: options.stake },
        },
      });
      await tx.wallet.update({
        where: { id: blackWallet.id },
        data: {
          balance: { decrement: options.stake },
          lockedBalance: { increment: options.stake },
        },
      });

      // Record escrow transactions
      await tx.transaction.createMany({
        data: [
          {
            walletId: whiteWallet.id,
            gameId: newGame.id,
            amount: options.stake,
            currency: options.currency,
            type: 'GAME_STAKE',
            status: 'COMPLETED',
            description: `Escrow for paid game`,
          },
          {
            walletId: blackWallet.id,
            gameId: newGame.id,
            amount: options.stake,
            currency: options.currency,
            type: 'GAME_STAKE',
            status: 'COMPLETED',
            description: `Escrow for paid game`,
          },
        ],
      });

      return newGame;
    });

    return this.serializeGame(game);
  }

  async getGame(gameId: string) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        whitePlayer: { select: { id: true, username: true, avatar: true, rating: true } },
        blackPlayer: { select: { id: true, username: true, avatar: true, rating: true } },
        moves: { orderBy: { moveNum: 'asc' } },
        chatMessages: {
          include: { sender: { select: { username: true, avatar: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!game) throw new NotFoundException('Game not found');
    return this.serializeGame(game);
  }

  async getActiveGame(userId: string) {
    const game = await this.prisma.game.findFirst({
      where: {
        OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }],
        status: GameStatus.ACTIVE,
      },
      include: {
        whitePlayer: { select: { id: true, username: true, avatar: true, rating: true } },
        blackPlayer: { select: { id: true, username: true, avatar: true, rating: true } },
        moves: { orderBy: { moveNum: 'asc' } },
        chatMessages: {
          include: { sender: { select: { username: true, avatar: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { startedAt: 'desc' },
    });
    return game ? this.serializeGame(game) : null;
  }

  async makeMove(
    gameId: string,
    userId: string,
    move: { from: string; to: string; promotion?: string },
  ) {
    const game = await this.prisma.game.findUnique({
      where: { id: gameId },
      include: {
        whitePlayer: { select: { id: true, username: true } },
        blackPlayer: { select: { id: true, username: true } },
      },
    });

    if (!game) throw new NotFoundException('Game not found');
    if (game.status !== 'ACTIVE') throw new BadRequestException('Game is not active');

    const isWhite = game.whitePlayerId === userId;
    const isBlack = game.blackPlayerId === userId;
    if (!isWhite && !isBlack) throw new ForbiddenException('Not a player in this game');

    const isPlayerTurn =
      (game.currentTurn === 'w' && isWhite) ||
      (game.currentTurn === 'b' && isBlack);
    if (!isPlayerTurn) throw new BadRequestException("Not your turn");

    const chess = new Chess(game.fen ?? undefined);
    let result;
    try {
      result = chess.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion as 'q' | 'r' | 'b' | 'n' | undefined,
      });
    } catch {
      throw new BadRequestException('Invalid move');
    }

    if (!result) throw new BadRequestException('Illegal move');

    const newFen = chess.fen();
    const newTurn = chess.turn();
    const moveNum = game.moveCount + 1;

    let status: GameStatus = 'ACTIVE';
    let gameResult: GameResult | null = null;
    let winnerId: string | null = null;

    if (chess.isCheckmate()) {
      status = 'COMPLETED';
      gameResult = isWhite ? 'WHITE_WINS' : 'BLACK_WINS';
      winnerId = isWhite ? game.whitePlayerId : game.blackPlayerId;
    } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition()) {
      status = 'COMPLETED';
      gameResult = 'DRAW';
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.move.create({
        data: { gameId, moveNum, san: result!.san, uci: `${move.from}${move.to}${move.promotion ?? ''}`, fen: newFen },
      });

      await tx.game.update({
        where: { id: gameId },
        data: {
          fen: newFen,
          currentTurn: newTurn,
          moveCount: moveNum,
          pgn: chess.pgn(),
          lastMoveAt: new Date(),
          ...(status === 'COMPLETED' && { status, result: gameResult, winnerId, endedAt: new Date() }),
        },
      });
    });

    if (status === 'COMPLETED') {
      await this.handleGameCompletion(gameId, gameResult!, game);
    }

    return {
      move: result,
      fen: newFen,
      pgn: chess.pgn(),
      status,
      result: gameResult,
      isCheck: chess.isCheck(),
      isCheckmate: chess.isCheckmate(),
      isDraw: chess.isDraw(),
    };
  }

  async resignGame(gameId: string, userId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    if (game.status !== 'ACTIVE') throw new BadRequestException('Game not active');

    const isWhite = game.whitePlayerId === userId;
    const isBlack = game.blackPlayerId === userId;
    if (!isWhite && !isBlack) throw new ForbiddenException();

    const gameResult: GameResult = isWhite ? 'BLACK_WINS' : 'WHITE_WINS';
    const winnerId = isWhite ? game.blackPlayerId : game.whitePlayerId;

    await this.prisma.game.update({
      where: { id: gameId },
      data: { status: 'COMPLETED', result: gameResult, winnerId, endedAt: new Date() },
    });

    await this.handleGameCompletion(gameId, gameResult, { ...game, winnerId });
    return { result: gameResult, winnerId };
  }

  async offerDraw(gameId: string, userId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException('Game not found');
    if (game.status !== 'ACTIVE') throw new BadRequestException('Game not active');
    if (game.whitePlayerId !== userId && game.blackPlayerId !== userId) throw new ForbiddenException();
    return { gameId, offeredBy: userId };
  }

  async acceptDraw(gameId: string, userId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game) throw new NotFoundException();
    if (game.status !== 'ACTIVE') throw new BadRequestException('Game not active');

    await this.prisma.game.update({
      where: { id: gameId },
      data: { status: 'COMPLETED', result: 'DRAW', endedAt: new Date() },
    });

    await this.handleGameCompletion(gameId, 'DRAW', game);
    return { result: 'DRAW' };
  }

  async handleTimeout(gameId: string, timedOutUserId: string) {
    const game = await this.prisma.game.findUnique({ where: { id: gameId } });
    if (!game || game.status !== 'ACTIVE') return null;

    const isWhite = game.whitePlayerId === timedOutUserId;
    const gameResult: GameResult = isWhite ? 'BLACK_WINS' : 'WHITE_WINS';
    const winnerId = isWhite ? game.blackPlayerId : game.whitePlayerId;

    await this.prisma.game.update({
      where: { id: gameId },
      data: { status: 'COMPLETED', result: gameResult, winnerId, endedAt: new Date() },
    });

    await this.handleGameCompletion(gameId, gameResult, { ...game, winnerId });
    return { result: gameResult, winnerId };
  }

  private async handleGameCompletion(
    gameId: string,
    result: GameResult,
    game: { whitePlayerId: string; blackPlayerId: string; winnerId?: string | null; type?: string; stake?: any; currency?: Currency | null },
  ) {
    const [white, black] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: game.whitePlayerId } }),
      this.prisma.user.findUnique({ where: { id: game.blackPlayerId } }),
    ]);
    if (!white || !black) return;

    const { newWhiteRating, newBlackRating } = this.calculateElo(white.rating, black.rating, result);
    const whiteChange = newWhiteRating - white.rating;
    const blackChange = newBlackRating - black.rating;

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: game.whitePlayerId },
        data: {
          rating: newWhiteRating,
          gamesPlayed: { increment: 1 },
          ...(result === 'WHITE_WINS' && { wins: { increment: 1 } }),
          ...(result === 'BLACK_WINS' && { losses: { increment: 1 } }),
          ...(result === 'DRAW' && { draws: { increment: 1 } }),
        },
      }),
      this.prisma.user.update({
        where: { id: game.blackPlayerId },
        data: {
          rating: newBlackRating,
          gamesPlayed: { increment: 1 },
          ...(result === 'BLACK_WINS' && { wins: { increment: 1 } }),
          ...(result === 'WHITE_WINS' && { losses: { increment: 1 } }),
          ...(result === 'DRAW' && { draws: { increment: 1 } }),
        },
      }),
      this.prisma.ratingHistory.create({
        data: { userId: game.whitePlayerId, rating: newWhiteRating, change: whiteChange, gameId },
      }),
      this.prisma.ratingHistory.create({
        data: { userId: game.blackPlayerId, rating: newBlackRating, change: blackChange, gameId },
      }),
    ]);

    // Release escrow for paid games
    if (game.type === 'PAID' && game.stake) {
      await this.releaseEscrow(
        gameId,
        game.winnerId ?? null,
        game.whitePlayerId,
        game.blackPlayerId,
        Number(game.stake),
        game.currency ?? Currency.USD,
      );
    }

    const winnerId = game.winnerId;
    const resultText = result === 'DRAW' ? 'Draw' : winnerId === game.whitePlayerId ? 'You won!' : 'You lost';

    await Promise.all([
      this.notifications.create(game.whitePlayerId, {
        type: 'GAME_RESULT',
        title: 'Game Over',
        body: `${resultText} (${whiteChange >= 0 ? '+' : ''}${whiteChange} ELO)`,
        data: { gameId, result, ratingChange: whiteChange },
      }),
      this.notifications.create(game.blackPlayerId, {
        type: 'GAME_RESULT',
        title: 'Game Over',
        body: `${resultText} (${blackChange >= 0 ? '+' : ''}${blackChange} ELO)`,
        data: { gameId, result, ratingChange: blackChange },
      }),
    ]);
  }

  private async releaseEscrow(
    gameId: string,
    winnerId: string | null,
    whitePlayerId: string,
    blackPlayerId: string,
    stake: number,
    currency: Currency,
  ) {
    const commission = this.configService.get<number>('platform.commission', 0.1);

    if (winnerId) {
      const loserId = winnerId === whitePlayerId ? blackPlayerId : whitePlayerId;
      const winnerAmount = stake * 2 * (1 - commission);

      const [winnerWallet, loserWallet] = await Promise.all([
        this.prisma.wallet.findFirst({ where: { userId: winnerId, currency } }),
        this.prisma.wallet.findFirst({ where: { userId: loserId, currency } }),
      ]);

      if (!winnerWallet || !loserWallet) return;

      await this.prisma.$transaction([
        this.prisma.wallet.update({
          where: { id: loserWallet.id },
          data: { lockedBalance: { decrement: stake } },
        }),
        this.prisma.wallet.update({
          where: { id: winnerWallet.id },
          data: { lockedBalance: { decrement: stake }, balance: { increment: winnerAmount } },
        }),
        this.prisma.transaction.create({
          data: {
            walletId: winnerWallet.id,
            gameId,
            amount: winnerAmount,
            type: 'GAME_WIN',
            status: 'COMPLETED',
            description: `Won game (${commission * 100}% platform fee deducted)`,
          },
        }),
      ]);
    } else {
      // Draw: refund both minus 2% fee
      const refund = stake * 0.98;
      const [whiteWallet, blackWallet] = await Promise.all([
        this.prisma.wallet.findFirst({ where: { userId: whitePlayerId, currency } }),
        this.prisma.wallet.findFirst({ where: { userId: blackPlayerId, currency } }),
      ]);
      if (!whiteWallet || !blackWallet) return;

      await this.prisma.$transaction([
        this.prisma.wallet.update({
          where: { id: whiteWallet.id },
          data: { lockedBalance: { decrement: stake }, balance: { increment: refund } },
        }),
        this.prisma.wallet.update({
          where: { id: blackWallet.id },
          data: { lockedBalance: { decrement: stake }, balance: { increment: refund } },
        }),
        this.prisma.transaction.createMany({
          data: [
            {
              walletId: whiteWallet.id,
              gameId,
              amount: refund,
              type: 'GAME_REFUND',
              status: 'COMPLETED',
              description: 'Draw refund',
            },
            {
              walletId: blackWallet.id,
              gameId,
              amount: refund,
              type: 'GAME_REFUND',
              status: 'COMPLETED',
              description: 'Draw refund',
            },
          ],
        }),
      ]);
    }
  }

  private calculateElo(whiteRating: number, blackRating: number, result: GameResult) {
    const expectedWhite = 1 / (1 + Math.pow(10, (blackRating - whiteRating) / 400));
    const actualWhite = result === 'WHITE_WINS' ? 1 : result === 'BLACK_WINS' ? 0 : 0.5;

    return {
      newWhiteRating: Math.max(100, Math.round(whiteRating + ELO_K_FACTOR * (actualWhite - expectedWhite))),
      newBlackRating: Math.max(100, Math.round(blackRating + ELO_K_FACTOR * ((1 - actualWhite) - (1 - expectedWhite)))),
    };
  }

  async getGameHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
    filters: { result?: string; gameType?: string; timeMinutes?: number } = {},
  ) {
    const skip = (Number(page) - 1) * Number(limit);

    const resultFilter: import('@prisma/client').Prisma.GameWhereInput =
      filters.result === 'win'
        ? { OR: [{ whitePlayerId: userId, result: GameResult.WHITE_WINS }, { blackPlayerId: userId, result: GameResult.BLACK_WINS }] }
        : filters.result === 'loss'
        ? { OR: [{ whitePlayerId: userId, result: GameResult.BLACK_WINS }, { blackPlayerId: userId, result: GameResult.WHITE_WINS }] }
        : filters.result === 'draw'
        ? { result: GameResult.DRAW }
        : {};

    const where: import('@prisma/client').Prisma.GameWhereInput = {
      AND: [
        { OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }] },
        { status: GameStatus.COMPLETED },
        ...(filters.gameType ? [{ type: filters.gameType as import('@prisma/client').GameType }] : []),
        ...(filters.timeMinutes ? [{ timeMinutes: Number(filters.timeMinutes) }] : []),
        ...(filters.result ? [resultFilter] : []),
      ],
    };

    const [games, total] = await Promise.all([
      this.prisma.game.findMany({
        where,
        include: {
          whitePlayer: { select: { id: true, username: true, avatar: true, rating: true } },
          blackPlayer: { select: { id: true, username: true, avatar: true, rating: true } },
        },
        orderBy: { endedAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      this.prisma.game.count({ where }),
    ]);

    return { games, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) };
  }
}
