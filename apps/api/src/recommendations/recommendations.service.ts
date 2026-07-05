import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RecommendationsService {
    constructor(private readonly prisma: PrismaService) { }

    async getHomeFeed(userId?: string, page = 1, limit = 24) {
        const skip = (page - 1) * limit;

        if (!userId) {
            // Anonymous: return trending videos
            return this.getTrending(limit);
        }

        // Get user's watch history tags for personalization
        const history = await this.prisma.watchHistory.findMany({
            where: { userId },
            orderBy: { lastWatchedAt: 'desc' },
            take: 50,
            include: { video: { select: { categoryId: true } } },
        });

        const categoryIds = [...new Set(history.map((h) => h.video.categoryId).filter(Boolean))];

        // Mix: 60% personalized + 40% trending
        const [personalized, trending] = await Promise.all([
            categoryIds.length > 0
                ? this.prisma.video.findMany({
                    where: {
                        categoryId: { in: categoryIds as string[] },
                        status: 'READY',
                        visibility: 'PUBLIC',
                        NOT: { id: { in: history.map((h) => h.videoId) } },
                    },
                    orderBy: { viewCount: 'desc' },
                    take: Math.ceil(limit * 0.6),
                    include: {
                        thumbnails: { take: 1 },
                        channel: { select: { name: true, handle: true, avatarUrl: true } },
                    },
                })
                : [],
            this.prisma.video.findMany({
                where: { status: 'READY', visibility: 'PUBLIC' },
                orderBy: [{ viewCount: 'desc' }, { publishedAt: 'desc' }],
                take: Math.ceil(limit * 0.4),
                include: {
                    thumbnails: { take: 1 },
                    channel: { select: { name: true, handle: true, avatarUrl: true } },
                },
            }),
        ]);

        // Merge and deduplicate
        const seen = new Set<string>();
        const merged = [...personalized, ...trending].filter((v) => {
            if (seen.has(v.id)) return false;
            seen.add(v.id);
            return true;
        });

        return { videos: merged.slice(skip, skip + limit), total: merged.length, page, limit };
    }

    async getTrending(limit = 24) {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const videos = await this.prisma.video.findMany({
            where: {
                status: 'READY',
                visibility: 'PUBLIC',
                publishedAt: { gte: sevenDaysAgo },
            },
            orderBy: { viewCount: 'desc' },
            take: limit,
            include: {
                thumbnails: { take: 1 },
                channel: { select: { name: true, handle: true, avatarUrl: true } },
            },
        });
        return { videos, total: videos.length };
    }

    async getRelated(videoId: string, limit = 12) {
        const video = await this.prisma.video.findUnique({
            where: { id: videoId },
            select: { categoryId: true, channelId: true, tags: true },
        });

        if (!video) return [];

        // Prioritize: same category → same channel → popular
        return this.prisma.video.findMany({
            where: {
                id: { not: videoId },
                status: 'READY',
                visibility: 'PUBLIC',
                OR: [
                    { categoryId: video.categoryId },
                    { channelId: video.channelId },
                ],
            },
            orderBy: { viewCount: 'desc' },
            take: limit,
            include: {
                thumbnails: { take: 1 },
                channel: { select: { name: true, handle: true, avatarUrl: true } },
            },
        });
    }
}
