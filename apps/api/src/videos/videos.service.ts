import {
    Injectable, BadRequestException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SearchService } from '../search/search.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { VideoQueryDto } from './dto/video-query.dto';

@Injectable()
export class VideosService {
    constructor(
        private prisma: PrismaService,
        private storage: StorageService,
        private notifications: NotificationsService,
        private search: SearchService,
        private config: ConfigService,
        @InjectQueue('transcoding') private transcodingQueue: Queue,
    ) { }

    // ─── Create video record (called after upload) ───────────────────────
    async createVideoRecord(userId: string, dto: CreateVideoDto) {
        const channel = await this.prisma.channel.findUnique({ where: { userId } });
        if (!channel) throw new BadRequestException('No channel found for user');

        const video = await this.prisma.video.create({
            data: {
                userId,
                channelId: channel.id,
                title: dto.title,
                description: dto.description,
                tags: dto.tags || [],
                categoryId: dto.categoryId,
                visibility: dto.visibility || 'PRIVATE',
                status: 'UPLOADING',
                rawStorageKey: dto.rawStorageKey,
            },
            include: { channel: true, category: true },
        });

        return video;
    }

    // ─── Trigger transcoding job ─────────────────────────────────────────
    async triggerTranscoding(videoId: string) {
        const video = await this.prisma.video.findUniqueOrThrow({
            where: { id: videoId },
        });

        await this.prisma.video.update({
            where: { id: videoId },
            data: { status: 'PROCESSING' },
        });

        const job = await this.transcodingQueue.add(
            'transcode-video',
            { videoId, rawStorageKey: video.rawStorageKey },
            { priority: 1, delay: 0 },
        );

        await this.prisma.video.update({
            where: { id: videoId },
            data: { processingJobId: String(job.id) },
        });

        return { jobId: job.id, videoId };
    }

    // ─── Get video by ID ──────────────────────────────────────────────────
    async findById(videoId: string, currentUserId?: string) {
        const video = await this.prisma.video.findUnique({
            where: { id: videoId },
            include: {
                channel: { select: { id: true, handle: true, name: true, avatarUrl: true, subscriberCount: true } },
                category: true,
                qualities: { where: { isReady: true }, orderBy: { quality: 'desc' } },
                chapters: { orderBy: { startTime: 'asc' } },
                subtitles: true,
                thumbnails: { where: { isActive: true } },
            },
        });

        if (!video) throw new NotFoundException('Video not found');

        // Enforce visibility rules
        if (video.visibility === 'PRIVATE' && video.userId !== currentUserId) {
            throw new ForbiddenException('This video is private');
        }

        // Get user's like status
        let userLiked: boolean | null = null;
        if (currentUserId) {
            const like = await this.prisma.like.findUnique({
                where: { userId_videoId: { userId: currentUserId, videoId } },
            });
            userLiked = like ? like.isLike : null;
        }

        // Generate signed HLS URLs
        const hlsUrl = video.hlsStorageKey
            ? this.storage.getSignedUrl(this.config.get('MINIO_HLS_BUCKET'), `${video.hlsStorageKey}/master.m3u8`, 3600)
            : null;

        return { ...video, hlsUrl, userLiked };
    }

    // ─── Increment view count (Redis debounced, batch-write to DB) ────────
    async recordView(videoId: string, sessionId: string, userId?: string) {
        // This is handled by AnalyticsService, just return confirmation
        return { recorded: true };
    }

    // ─── Get feed (home page) ─────────────────────────────────────────────
    async getFeed(currentUserId?: string, query: VideoQueryDto = {}) {
        const { page = 1, limit = 20, category, sort = 'trending' } = query;

        const where: any = {
            status: 'READY',
            visibility: 'PUBLIC',
            ...(category && { category: { slug: category } }),
        };

        const orderBy = {
            trending: { viewCount: 'desc' as const },
            latest: { publishedAt: 'desc' as const },
            oldest: { publishedAt: 'asc' as const },
        }[sort] || { viewCount: 'desc' as const };

        const [videos, total] = await Promise.all([
            this.prisma.video.findMany({
                where,
                orderBy,
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    channel: { select: { handle: true, name: true, avatarUrl: true } },
                    thumbnails: { where: { isActive: true }, take: 1 },
                    category: { select: { name: true, slug: true } },
                },
            }),
            this.prisma.video.count({ where }),
        ]);

        return {
            videos,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    // ─── Update video ─────────────────────────────────────────────────────
    async update(videoId: string, userId: string, dto: UpdateVideoDto) {
        const video = await this.prisma.video.findUnique({ where: { id: videoId } });
        if (!video) throw new NotFoundException('Video not found');
        if (video.userId !== userId) throw new ForbiddenException('Not your video');

        const updated = await this.prisma.video.update({
            where: { id: videoId },
            data: {
                ...dto,
                ...(dto.visibility === 'PUBLIC' && !video.publishedAt && { publishedAt: new Date() }),
            },
        });

        // Update search index
        await this.search.indexVideo(updated);

        // Notify subscribers if publishing for first time
        if (dto.visibility === 'PUBLIC' && !video.publishedAt) {
            await this.notifications.notifyNewVideo({
                id: updated.id,
                title: updated.title,
                channelId: updated.channelId,
                thumbnailUrl: updated.thumbnailUrl,
            });
        }

        return updated;
    }

    // ─── Delete video ─────────────────────────────────────────────────────
    async delete(videoId: string, userId: string) {
        const video = await this.prisma.video.findUnique({ where: { id: videoId } });
        if (!video) throw new NotFoundException('Video not found');
        if (video.userId !== userId) throw new ForbiddenException('Not your video');

        // Soft delete (mark as DELETED, clean up storage async)
        await this.prisma.video.update({
            where: { id: videoId },
            data: { status: 'DELETED' },
        });

        // Queue storage cleanup
        await this.transcodingQueue.add('cleanup-video', { videoId }, { delay: 60000 });

        // Remove from search index
        await this.search.removeVideo(videoId);

        return { message: 'Video deleted' };
    }

    // ─── Toggle like/dislike ──────────────────────────────────────────────
    async toggleLike(videoId: string, userId: string, isLike: boolean) {
        const existing = await this.prisma.like.findUnique({
            where: { userId_videoId: { userId, videoId } },
        });

        if (existing && existing.isLike === isLike) {
            // Remove reaction
            await this.prisma.like.delete({ where: { userId_videoId: { userId, videoId } } });
            await this.prisma.video.update({
                where: { id: videoId },
                data: { [isLike ? 'likeCount' : 'dislikeCount']: { decrement: 1 } },
            });
            return { action: 'removed' };
        }

        // Upsert reaction
        await this.prisma.like.upsert({
            where: { userId_videoId: { userId, videoId } },
            create: { userId, videoId, isLike },
            update: { isLike },
        });

        if (existing) {
            // Switched from like to dislike or vice versa
            await this.prisma.video.update({
                where: { id: videoId },
                data: {
                    [isLike ? 'likeCount' : 'dislikeCount']: { increment: 1 },
                    [isLike ? 'dislikeCount' : 'likeCount']: { decrement: 1 },
                },
            });
        } else {
            await this.prisma.video.update({
                where: { id: videoId },
                data: { [isLike ? 'likeCount' : 'dislikeCount']: { increment: 1 } },
            });
        }

        return { action: isLike ? 'liked' : 'disliked' };
    }

    // ─── Get channel videos ───────────────────────────────────────────────
    async getChannelVideos(channelId: string, currentUserId?: string, query: VideoQueryDto = {}) {
        const { page = 1, limit = 20 } = query;
        const isOwner = !!(currentUserId && await this.prisma.channel.findFirst({
            where: { id: channelId, userId: currentUserId },
        }));

        const where: any = {
            channelId,
            status: 'READY',
            ...(isOwner ? {} : { visibility: 'PUBLIC' }),
        };

        const [videos, total] = await Promise.all([
            this.prisma.video.findMany({
                where,
                orderBy: { publishedAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: { thumbnails: { where: { isActive: true }, take: 1 } },
            }),
            this.prisma.video.count({ where }),
        ]);

        return {
            videos,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }

    async getMine(userId: string, query: VideoQueryDto = {}) {
        const { page = 1, limit = 20 } = query;
        const channel = await this.prisma.channel.findUnique({ where: { userId } });
        if (!channel) return { videos: [], meta: { page, limit, total: 0, totalPages: 0 } };

        const where = { channelId: channel.id, status: { not: 'DELETED' as const } };
        const [videos, total] = await Promise.all([
            this.prisma.video.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    thumbnails: { where: { isActive: true }, take: 1 },
                    category: { select: { name: true, slug: true } },
                },
            }),
            this.prisma.video.count({ where }),
        ]);

        return { videos, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }

    async getLiked(userId: string, page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [likes, total] = await Promise.all([
            this.prisma.like.findMany({
                where: { userId, isLike: true },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                include: {
                    video: {
                        include: {
                            thumbnails: { where: { isActive: true }, take: 1 },
                            channel: { select: { name: true, handle: true, avatarUrl: true } },
                        },
                    },
                },
            }),
            this.prisma.like.count({ where: { userId, isLike: true } }),
        ]);

        return {
            videos: likes.map((l) => l.video).filter(Boolean),
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    }
}
