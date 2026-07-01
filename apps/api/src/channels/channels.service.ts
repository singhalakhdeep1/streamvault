import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ChannelsService {
    constructor(private readonly prisma: PrismaService) { }

    async findByHandle(handle: string, requesterId?: string) {
        const channel = await this.prisma.channel.findUnique({
            where: { handle },
            include: {
                user: {
                    select: {
                        id: true,
                        displayName: true,
                        avatarUrl: true,
                        isVerified: true,
                        createdAt: true,
                    },
                },
                videos: {
                    where: { status: 'READY', visibility: 'PUBLIC' },
                    orderBy: { publishedAt: 'desc' },
                    take: 12,
                    select: {
                        id: true,
                        title: true,
                        duration: true,
                        viewCount: true,
                        likeCount: true,
                        publishedAt: true,
                        thumbnails: { take: 1 },
                    },
                },
                _count: { select: { videos: true } },
            },
        });

        if (!channel) throw new NotFoundException('Channel not found');

        let isSubscribed = false;
        if (requesterId) {
            const sub = await this.prisma.subscription.findUnique({
                where: { subscriberId_channelId: { subscriberId: requesterId, channelId: channel.id } },
            });
            isSubscribed = !!sub;
        }

        return { ...channel, isSubscribed };
    }

    async create(userId: string, data: { name: string; handle: string; description?: string }) {
        const existing = await this.prisma.channel.findFirst({
            where: { OR: [{ userId }, { handle: data.handle }] },
        });
        if (existing?.userId === userId) {
            throw new ConflictException('You already have a channel');
        }
        if (existing?.handle === data.handle) {
            throw new ConflictException('Handle already taken');
        }

        const channel = await this.prisma.channel.create({
            data: { userId, ...data },
        });

        await this.prisma.user.update({
            where: { id: userId },
            data: { role: 'CREATOR' },
        });

        return channel;
    }

    async update(userId: string, data: {
        name?: string;
        description?: string;
        avatarUrl?: string;
        bannerUrl?: string;
    }) {
        const channel = await this.prisma.channel.findUnique({ where: { userId } });
        if (!channel) throw new NotFoundException('Channel not found');

        return this.prisma.channel.update({
            where: { userId },
            data,
        });
    }

    async getVideos(handle: string, page = 1, limit = 20, sort = 'newest') {
        const channel = await this.prisma.channel.findUnique({ where: { handle } });
        if (!channel) throw new NotFoundException('Channel not found');

        const orderBy: any =
            sort === 'popular' ? { viewCount: 'desc' } :
                sort === 'oldest' ? { publishedAt: 'asc' } :
                    { publishedAt: 'desc' };

        const skip = (page - 1) * limit;
        const [videos, total] = await Promise.all([
            this.prisma.video.findMany({
                where: { channelId: channel.id, status: 'READY', visibility: 'PUBLIC' },
                orderBy,
                skip,
                take: limit,
                select: {
                    id: true,
                    title: true,
                    description: true,
                    duration: true,
                    viewCount: true,
                    likeCount: true,
                    publishedAt: true,
                    thumbnails: { take: 1 },
                },
            }),
            this.prisma.video.count({
                where: { channelId: channel.id, status: 'READY', visibility: 'PUBLIC' },
            }),
        ]);

        return { videos, total, page, limit };
    }
}
