import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class StreamingService {
    constructor(
        private readonly config: ConfigService,
        private readonly prisma: PrismaService,
        private readonly storage: StorageService,
    ) { }

    async getSignedManifestUrl(videoId: string, userId?: string) {
        const video = await this.prisma.video.findUnique({
            where: { id: videoId },
            select: {
                id: true,
                hlsMasterKey: true,
                visibility: true,
                isPremium: true,
                status: true,
                channelId: true,
            },
        });

        if (!video || video.status !== 'READY') {
            return null;
        }

        if (video.visibility === 'PRIVATE') {
            const channel = await this.prisma.channel.findUnique({ where: { id: video.channelId } });
            if (!userId || channel?.userId !== userId) return null;
        }

        if (video.isPremium && userId) {
            const user = await this.prisma.user.findUnique({ where: { id: userId } });
            if (!user?.isPremium) return { requiresPremium: true };
        }

        // Increment view count (debounced: one per user per video per hour)
        this.trackView(videoId, userId).catch(() => { });

        const signedUrl = await this.storage.getSignedUrl(
            `streamvault-hls`,
            video.hlsMasterKey!,
            3600, // 1 hour expiry
        );

        return { url: signedUrl };
    }

    private async trackView(videoId: string, userId?: string) {
        // Simple increment — in production use Redis with TTL per user/video
        await this.prisma.video.update({
            where: { id: videoId },
            data: { viewCount: { increment: 1 } },
        });

        if (userId) {
            await this.prisma.watchHistory.upsert({
                where: { userId_videoId: { userId, videoId } },
                update: { watchedAt: new Date() },
                create: { userId, videoId, position: 0, duration: 0 },
            });
        }
    }
}
