import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) { }

    async findById(id: string) {
        return this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                bannerUrl: true,
                bio: true,
                isVerified: true,
                isPremium: true,
                role: true,
                createdAt: true,
                channel: {
                    select: {
                        id: true,
                        name: true,
                        handle: true,
                        subscriberCount: true,
                    },
                },
            },
        });
    }

    async findByEmail(email: string) {
        return this.prisma.user.findUnique({ where: { email } });
    }

    async findByUsername(username: string) {
        return this.prisma.user.findUnique({ where: { username } });
    }

    async create(data: {
        email: string;
        username: string;
        displayName: string;
        passwordHash?: string;
    }) {
        const existing = await this.prisma.user.findFirst({
            where: { OR: [{ email: data.email }, { username: data.username }] },
        });
        if (existing) {
            throw new ConflictException(
                existing.email === data.email ? 'Email already in use' : 'Username already taken',
            );
        }

        return this.prisma.user.create({ data });
    }

    async findOrCreateOAuth(data: {
        provider: string;
        providerId: string;
        email: string;
        displayName: string;
        avatarUrl?: string;
    }) {
        const existing = await this.prisma.oAuthAccount.findUnique({
            where: {
                provider_providerUserId: {
                    provider: data.provider as any,
                    providerUserId: data.providerId,
                },
            },
            include: { user: true },
        });

        if (existing) return existing.user;

        // Check if email already exists
        let user = await this.prisma.user.findUnique({ where: { email: data.email } });

        if (!user) {
            const username = data.email.split('@')[0].replace(/[^a-z0-9]/gi, '') +
                Math.floor(Math.random() * 1000);
            user = await this.prisma.user.create({
                data: {
                    email: data.email,
                    username,
                    displayName: data.displayName,
                    avatarUrl: data.avatarUrl,
                },
            });
        }

        await this.prisma.oAuthAccount.create({
            data: {
                userId: user.id,
                provider: data.provider as any,
                providerUserId: data.providerId,
            },
        });

        return user;
    }

    async updateProfile(
        userId: string,
        data: { displayName?: string; bio?: string; avatarUrl?: string; bannerUrl?: string },
    ) {
        return this.prisma.user.update({
            where: { id: userId },
            data,
            select: {
                id: true,
                username: true,
                displayName: true,
                bio: true,
                avatarUrl: true,
                bannerUrl: true,
            },
        });
    }

  async getWatchHistory(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.watchHistory.findMany({
        where: { userId },
        orderBy: { lastWatchedAt: 'desc' },
        skip,
        take: limit,
        include: {
          video: {
            select: {
              id: true,
              title: true,
              duration: true,
              viewCount: true,
              thumbnails: { take: 1 },
              channel: { select: { name: true, handle: true, avatarUrl: true } },
            },
          },
        },
      }),
      this.prisma.watchHistory.count({ where: { userId } }),
    ]);
    return { items, total, page, limit };
  }

  async getWatchLater(userId: string) {
    return this.prisma.watchLater.findMany({
      where: { userId },
      orderBy: { addedAt: 'desc' },
            include: {
                video: {
                    select: {
                        id: true,
                        title: true,
                        duration: true,
                        viewCount: true,
                        thumbnails: { take: 1 },
                        channel: { select: { name: true, handle: true, avatarUrl: true } },
                    },
                },
            },
        });
    }

    async toggleWatchLater(userId: string, videoId: string) {
        const existing = await this.prisma.watchLater.findUnique({
            where: { userId_videoId: { userId, videoId } },
        });
        if (existing) {
            await this.prisma.watchLater.delete({ where: { userId_videoId: { userId, videoId } } });
            return { saved: false };
        }
        await this.prisma.watchLater.create({ data: { userId, videoId } });
        return { saved: true };
    }

  async upsertWatchProgress(userId: string, videoId: string, position: number, duration: number) {
    const completionRate = duration > 0 ? Math.min(1, position / duration) : 0;
    return this.prisma.watchHistory.upsert({
      where: { userId_videoId: { userId, videoId } },
      update: {
        watchedSeconds: position,
        totalSeconds: duration,
        completionRate,
        lastWatchedAt: new Date(),
      },
      create: {
        userId,
        videoId,
        watchedSeconds: position,
        totalSeconds: duration,
        completionRate,
      },
    });
  }
}
