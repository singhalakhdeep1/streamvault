import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Ioredis from 'ioredis';
import { PrismaService } from '../database/prisma.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class AnalyticsService {
    private readonly redis: Ioredis.Redis;
    private readonly logger = new Logger(AnalyticsService.name);
    private readonly VIEW_DEBOUNCE_TTL = 300; // 5 minutes - same session won't re-count

    constructor(
        private prisma: PrismaService,
        private config: ConfigService,
        private notificationsGateway: NotificationsGateway,
    ) {
        this.redis = new Ioredis.Redis({
            host: config.get('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
        });
    }

    // ─── Record a view (Redis debounced) ──────────────────────────────────
    async recordView(videoId: string, sessionId: string, userId?: string) {
        const dedupeKey = `view:dedup:${videoId}:${sessionId}`;
        const isNew = await this.redis.set(dedupeKey, '1', 'EX', this.VIEW_DEBOUNCE_TTL, 'NX');

        if (!isNew) return { counted: false }; // Already counted in this session

        // Increment Redis counter (batch-written to DB every minute)
        await this.redis.incr(`video:views:${videoId}`);
        await this.redis.expire(`video:views:${videoId}`, 86400);

        // Queue for DB write (batch flush every 60 seconds via cron)
        await this.redis.rpush(
            'analytics:view:queue',
            JSON.stringify({
                videoId,
                sessionId,
                userId: userId || null,
                timestamp: Date.now(),
            }),
        );

        return { counted: true };
    }

    // ─── Record watch time (progress update) ─────────────────────────────
    async recordWatchTime(
        videoId: string,
        userId: string,
        watchedSeconds: number,
        totalSeconds: number,
    ) {
        const completionRate = totalSeconds > 0 ? watchedSeconds / totalSeconds : 0;

        await this.prisma.watchHistory.upsert({
            where: { userId_videoId: { userId, videoId } },
            create: {
                userId,
                videoId,
                watchedSeconds,
                totalSeconds,
                completionRate,
            },
            update: {
                watchedSeconds: { set: Math.max(watchedSeconds, 0) },
                completionRate,
                lastWatchedAt: new Date(),
                watchCount: { increment: 1 },
            },
        });

        // Fire analytics event
        await this.prisma.analyticsEvent.create({
            data: {
                videoId,
                userId,
                sessionId: `${userId}-${videoId}`,
                eventType: 'WATCH_TIME',
                value: watchedSeconds,
            },
        });

        return { recorded: true };
    }

    // ─── Get creator analytics dashboard ─────────────────────────────────
    async getCreatorDashboard(userId: string, days = 30) {
        const since = new Date(Date.now() - days * 24 * 3600 * 1000);

        const channel = await this.prisma.channel.findUnique({ where: { userId } });
        if (!channel) return null;

        const [
            totalViews,
            totalWatchTime,
            totalVideos,
            topVideos,
            viewsByDay,
            recentSubscribers,
        ] = await Promise.all([
            // Total views
            this.prisma.analyticsEvent.count({
                where: { video: { channelId: channel.id }, eventType: 'VIEW', timestamp: { gte: since } },
            }),

            // Total watch time (seconds)
            this.prisma.analyticsEvent.aggregate({
                where: { video: { channelId: channel.id }, eventType: 'WATCH_TIME', timestamp: { gte: since } },
                _sum: { value: true },
            }),

            // Video count
            this.prisma.video.count({ where: { channelId: channel.id, status: 'READY' } }),

            // Top 5 videos by views
            this.prisma.video.findMany({
                where: { channelId: channel.id, status: 'READY' },
                orderBy: { viewCount: 'desc' },
                take: 5,
                select: {
                    id: true, title: true, viewCount: true, likeCount: true,
                    duration: true, publishedAt: true,
                    thumbnails: { where: { isActive: true }, take: 1, select: { url: true } },
                },
            }),

            // Views by day (last 30 days)
            this.prisma.$queryRaw`
        SELECT 
          DATE(timestamp) as date,
          COUNT(*) as views
        FROM analytics_events ae
        JOIN videos v ON ae.video_id = v.id
        WHERE v.channel_id = ${channel.id}
          AND ae.event_type = 'VIEW'
          AND ae.timestamp >= ${since}
        GROUP BY DATE(timestamp)
        ORDER BY date ASC
      `,

            // Recent subscriber gain
            this.prisma.subscription.count({
                where: { channelUserId: userId, subscribedAt: { gte: since } },
            }),
        ]);

        return {
            overview: {
                totalViews,
                totalWatchTimeHours: Math.round((totalWatchTime._sum.value || 0) / 3600),
                totalVideos,
                subscriberCount: channel.subscriberCount,
                recentSubscribers,
            },
            topVideos,
            viewsByDay,
        };
    }

    // ─── Get video analytics ──────────────────────────────────────────────
    async getVideoAnalytics(videoId: string, userId: string) {
        const video = await this.prisma.video.findUnique({
            where: { id: videoId, userId },
            select: { id: true, title: true, viewCount: true, likeCount: true, duration: true, publishedAt: true },
        });
        if (!video) return null;

        const [watchTimeData, audienceRetention, trafficSources] = await Promise.all([
            // Average watch percentage
            this.prisma.watchHistory.aggregate({
                where: { videoId },
                _avg: { completionRate: true, watchedSeconds: true },
                _count: true,
            }),

            // Simplified retention (% watched at each 10% interval)
            this.prisma.$queryRaw`
        SELECT 
          FLOOR(watched_seconds::float / NULLIF(total_seconds, 0) * 10) * 10 as bucket,
          COUNT(*) as count
        FROM watch_history
        WHERE video_id = ${videoId} AND total_seconds > 0
        GROUP BY bucket
        ORDER BY bucket
      `,

            // Traffic sources (simplified)
            this.prisma.analyticsEvent.groupBy({
                by: ['eventType'],
                where: { videoId },
                _count: true,
            }),
        ]);

        return {
            video,
            engagement: {
                avgCompletionRate: watchTimeData._avg.completionRate || 0,
                avgWatchSeconds: watchTimeData._avg.watchedSeconds || 0,
                uniqueViewers: watchTimeData._count,
            },
            audienceRetention,
            trafficSources,
        };
    }

    // ─── Flush view queue to DB (called by cron every 60s) ───────────────
    async flushViewQueue() {
        const batchSize = 100;
        const items = await this.redis.lrange('analytics:view:queue', 0, batchSize - 1);
        if (items.length === 0) return;

        await this.redis.ltrim('analytics:view:queue', items.length, -1);

        const events = items.map(item => {
            const data = JSON.parse(item);
            return {
                videoId: data.videoId,
                userId: data.userId,
                sessionId: data.sessionId,
                eventType: 'VIEW' as any,
                timestamp: new Date(data.timestamp),
            };
        });

        await this.prisma.analyticsEvent.createMany({ data: events, skipDuplicates: true });

        // Flush Redis view counters to DB
        const videoIds = [...new Set(events.map(e => e.videoId))];
        for (const videoId of videoIds) {
            const count = await this.redis.getdel(`video:views:${videoId}`);
            if (count && parseInt(count) > 0) {
                await this.prisma.video.update({
                    where: { id: videoId },
                    data: { viewCount: { increment: parseInt(count) } },
                });
            }
        }

        this.logger.log(`Flushed ${events.length} view events to DB`);
    }
}
