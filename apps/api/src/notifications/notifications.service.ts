import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export type NotificationType = 'NEW_VIDEO' | 'NEW_COMMENT' | 'COMMENT_REPLY' | 'SUBSCRIPTION' | 'LIVE_STARTED' | 'SYSTEM';

@Injectable()
export class NotificationsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(data: {
        userId: string;
        type: NotificationType;
        title: string;
        body: string;
        imageUrl?: string;
        actionUrl?: string;
        actorId?: string;
    }) {
        return this.prisma.notification.create({ data });
    }

    async notify(
        userIds: string[],
        type: NotificationType,
        title: string,
        body: string,
        extra?: { imageUrl?: string; actionUrl?: string; actorId?: string },
    ) {
        const data = userIds.map((userId) => ({
            userId,
            type,
            title,
            body,
            ...extra,
        }));
        return this.prisma.notification.createMany({ data });
    }

    async getForUser(userId: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [items, total, unreadCount] = await Promise.all([
            this.prisma.notification.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.notification.count({ where: { userId } }),
            this.prisma.notification.count({ where: { userId, isRead: false } }),
        ]);
        return { items, total, unreadCount, page, limit };
    }

    async markRead(userId: string, notificationId?: string) {
        if (notificationId) {
            return this.prisma.notification.updateMany({
                where: { id: notificationId, userId },
                data: { isRead: true },
            });
        }
        return this.prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true },
        });
    }

    async notifyNewVideo(video: {
        id: string;
        title: string;
        channelId: string;
        thumbnailUrl?: string;
    }) {
        const subs = await this.prisma.subscription.findMany({
            where: {
                channelId: video.channelId,
                notificationPreference: { in: ['ALL', 'PERSONALIZED'] },
            },
            select: { subscriberId: true },
        });

        const channel = await this.prisma.channel.findUnique({
            where: { id: video.channelId },
            select: { name: true },
        });

        const userIds = subs.map((s) => s.subscriberId);
        if (userIds.length === 0) return;

        await this.notify(userIds, 'NEW_VIDEO', channel!.name, `New video: ${video.title}`, {
            imageUrl: video.thumbnailUrl,
            actionUrl: `/watch/${video.id}`,
        });
    }
}
