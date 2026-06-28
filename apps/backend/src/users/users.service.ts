import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FriendRequestStatus } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async getProfile(username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        avatar: true,
        rating: true,
        gamesPlayed: true,
        wins: true,
        losses: true,
        draws: true,
        isOnline: true,
        createdAt: true,
        region: true,
        ratingHistory: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { rating: true, change: true, createdAt: true },
        },
        gamesAsWhite: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          where: { status: 'COMPLETED' },
          select: {
            id: true, type: true, result: true, timeControlType: true,
            blackPlayer: { select: { username: true, avatar: true, rating: true } },
            createdAt: true,
          },
        },
        gamesAsBlack: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          where: { status: 'COMPLETED' },
          select: {
            id: true, type: true, result: true, timeControlType: true,
            whitePlayer: { select: { username: true, avatar: true, rating: true } },
            createdAt: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatar: true,
        rating: true,
        gamesPlayed: true,
        wins: true,
        losses: true,
        draws: true,
        isOnline: true,
        region: true,
        role: true,
        createdAt: true,
        wallet: {
          select: { balance: true, lockedBalance: true, currency: true },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return {
      ...user,
      wallet: user.wallet
        ? {
            ...user.wallet,
            balance: Number(user.wallet.balance),
            lockedBalance: Number(user.wallet.lockedBalance),
          }
        : null,
    };
  }

  async updateAvatar(userId: string, avatarUrl: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatar: true },
    });

    // Delete previous local upload if it exists
    if (user?.avatar?.startsWith('/uploads/')) {
      const oldFile = path.join(process.cwd(), user.avatar);
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { avatar: avatarUrl },
      select: { id: true, username: true, avatar: true, email: true, region: true },
    });
  }

  async updateProfile(
    userId: string,
    data: { username?: string; avatar?: string; region?: string },
  ) {
    if (data.username) {
      const existing = await this.prisma.user.findFirst({
        where: { username: data.username, NOT: { id: userId } },
      });
      if (existing) throw new BadRequestException('Username already taken');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.username && { username: data.username }),
        ...(data.avatar && { avatar: data.avatar }),
        ...(data.region && { region: data.region as any }),
      },
      select: {
        id: true, username: true, avatar: true, region: true, email: true,
      },
    });
  }

  async searchUsers(query: string, currentUserId: string) {
    return this.prisma.user.findMany({
      where: {
        username: { contains: query },
        NOT: { id: currentUserId },
        isBanned: false,
      },
      select: {
        id: true, username: true, avatar: true, rating: true, isOnline: true,
      },
      take: 20,
    });
  }

  async sendFriendRequest(senderId: string, receiverId: string) {
    if (senderId === receiverId)
      throw new BadRequestException("Can't send request to yourself");

    const receiver = await this.prisma.user.findUnique({ where: { id: receiverId } });
    if (!receiver) throw new NotFoundException('User not found');

    const existing = await this.prisma.friendRequest.findFirst({
      where: {
        OR: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      },
    });

    if (existing) {
      throw new BadRequestException(
        existing.status === 'PENDING'
          ? 'Friend request already sent'
          : 'Friend request already processed',
      );
    }

    const alreadyFriends = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { userAId: senderId, userBId: receiverId },
          { userAId: receiverId, userBId: senderId },
        ],
      },
    });
    if (alreadyFriends) throw new BadRequestException('Already friends');

    const request = await this.prisma.friendRequest.create({
      data: { senderId, receiverId },
      include: { sender: { select: { username: true, avatar: true } } },
    });

    await this.notifications.create(receiverId, {
      type: 'FRIEND_REQUEST',
      title: 'New Friend Request',
      body: `${request.sender.username} sent you a friend request`,
      data: { requestId: request.id, senderId },
    });

    return { message: 'Friend request sent', requestId: request.id };
  }

  async respondToFriendRequest(
    requestId: string,
    userId: string,
    action: 'accept' | 'reject',
  ) {
    const request = await this.prisma.friendRequest.findUnique({
      where: { id: requestId },
      include: { sender: { select: { username: true } } },
    });

    if (!request) throw new NotFoundException('Friend request not found');
    if (request.receiverId !== userId) throw new ForbiddenException();
    if (request.status !== 'PENDING')
      throw new BadRequestException('Request already processed');

    if (action === 'accept') {
      await this.prisma.$transaction([
        this.prisma.friendRequest.update({
          where: { id: requestId },
          data: { status: FriendRequestStatus.ACCEPTED },
        }),
        this.prisma.friendship.create({
          data: { userAId: request.senderId, userBId: userId },
        }),
      ]);

      await this.notifications.create(request.senderId, {
        type: 'FRIEND_ACCEPTED',
        title: 'Friend Request Accepted',
        body: `Your friend request was accepted`,
        data: { userId },
      });

      return { message: 'Friend request accepted' };
    } else {
      await this.prisma.friendRequest.update({
        where: { id: requestId },
        data: { status: FriendRequestStatus.REJECTED },
      });
      return { message: 'Friend request rejected' };
    }
  }

  async getFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: { OR: [{ userAId: userId }, { userBId: userId }] },
      include: {
        userA: { select: { id: true, username: true, avatar: true, rating: true, isOnline: true } },
        userB: { select: { id: true, username: true, avatar: true, rating: true, isOnline: true } },
      },
    });

    return friendships.map((f) =>
      f.userAId === userId ? f.userB : f.userA,
    );
  }

  async getPendingRequests(userId: string) {
    return this.prisma.friendRequest.findMany({
      where: { receiverId: userId, status: 'PENDING' },
      include: {
        sender: { select: { id: true, username: true, avatar: true, rating: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setOnlineStatus(userId: string, isOnline: boolean) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        isOnline,
        ...(isOnline ? {} : { lastSeenAt: new Date() }),
      },
    });
  }

  async getLeaderboard(limit = 50) {
    return this.prisma.user.findMany({
      where: { isBanned: false, gamesPlayed: { gt: 0 } },
      orderBy: { rating: 'desc' },
      take: limit,
      select: {
        id: true, username: true, avatar: true, rating: true,
        gamesPlayed: true, wins: true, losses: true, draws: true,
      },
    });
  }
}
