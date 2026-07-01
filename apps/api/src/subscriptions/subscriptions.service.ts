import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SubscriptionsService {
    constructor(private readonly prisma: PrismaService) { }

    async toggle(subscriberId: string, channelId: string) {
        const existing = await this.prisma.subscription.findUnique({
            where: { subscriberId_channelId: { subscriberId, channelId } },
        });

        if (existing) {
            await this.prisma.subscription.delete({
                where: { subscriberId_channelId: { subscriberId, channelId } },
            });
            await this.prisma.channel.update({
                where: { id: channelId },
                data: { subscriberCount: { decrement: 1 } },
            });
            return { subscribed: false };
        }

        await this.prisma.subscription.create({ data: { subscriberId, channelId } });
        await this.prisma.channel.update({
            where: { id: channelId },
            data: { subscriberCount: { increment: 1 } },
        });
        return { subscribed: true };
    }

    async getFeed(userId: string, page = 1, limit = 20) {
        const subscriptions = await this.prisma.subscription.findMany({
            where: { subscriberId: userId },
            select: { channelId: true },
        });
        const channelIds = subscriptions.map((s) => s.channelId);

        const skip = (page - 1) * limit;
        const [videos, total] = await Promise.all([
            this.prisma.video.findMany({
                where: {
                    channelId: { in: channelIds },
                    status: 'READY',
                    visibility: 'PUBLIC',
                },
                orderBy: { publishedAt: 'desc' },
                skip,
                take: limit,
                include: {
                    thumbnails: { take: 1 },
                    channel: {
                        select: { name: true, handle: true, avatarUrl: true },
                    },
                },
            }),
            this.prisma.video.count({
                where: {
                    channelId: { in: channelIds },
                    status: 'READY',
                    visibility: 'PUBLIC',
                },
            }),
        ]);

        return { videos, total, page, limit };
    }

    async getMySubscriptions(userId: string) {
        return this.prisma.subscription.findMany({
            where: { subscriberId: userId },
            orderBy: { subscribedAt: 'desc' },
            include: {
                channel: {
                    select: {
                        id: true,
                        name: true,
                        handle: true,
                        avatarUrl: true,
                        subscriberCount: true,
                        _count: { select: { videos: true } },
                    },
                },
            },
        });
    }

    async updateNotificationPreference(subscriberId: string, channelId: string, type: string) {
        return this.prisma.subscription.update({
            where: { subscriberId_channelId: { subscriberId, channelId } },
            data: { notificationPreference: type as any },
        });
    }
}
