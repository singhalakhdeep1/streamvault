import {
    Injectable, NotFoundException, ForbiddenException, BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';
import * as Ioredis from 'ioredis';
import { PrismaService } from '../database/prisma.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class LiveService {
    private readonly redis: Ioredis.Redis;

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

    // ─── Validate stream key (called by RTMP server on stream start) ──────
    async validateStreamKey(streamKey: string) {
        const channel = await this.prisma.channel.findUnique({
            where: { streamKey },
            include: { user: { select: { id: true, displayName: true } } },
        });
        if (!channel) throw new ForbiddenException('Invalid stream key');
        return { channelId: channel.id, userId: channel.userId, channelHandle: channel.handle };
    }

    // ─── Called when RTMP stream starts ──────────────────────────────────
    async onStreamStart(streamKey: string, metadata: any) {
        const { channelId, userId } = await this.validateStreamKey(streamKey);

        const livestream = await this.prisma.livestream.create({
            data: {
                channelId,
                title: metadata?.title || 'Live Stream',
                description: metadata?.description,
                status: 'LIVE',
                streamKey,
                startedAt: new Date(),
                hlsUrl: `${this.config.get('HLS_BASE_URL', 'http://localhost:8888')}/live/${streamKey}/index.m3u8`,
            },
            include: { channel: true },
        });

        // Update channel live status
        await this.prisma.channel.update({
            where: { id: channelId },
            data: { isLive: true, currentStreamId: livestream.id },
        });

        // Initialize Redis viewer count
        await this.redis.set(`live:viewers:${livestream.id}`, 0, 'EX', 86400);

        // Notify subscribers
        await this.notifySubscribersLiveStarted(channelId, livestream.id);

        this.notificationsGateway.broadcastLiveStarted(livestream.id, livestream);
        return livestream;
    }

    // ─── Called when RTMP stream ends ────────────────────────────────────
    async onStreamEnd(streamKey: string) {
        const channel = await this.prisma.channel.findUnique({ where: { streamKey } });
        if (!channel?.currentStreamId) return;

        const livestreamId = channel.currentStreamId;
        const startedAt = await this.prisma.livestream.findUnique({
            where: { id: livestreamId },
            select: { startedAt: true },
        });

        const duration = startedAt?.startedAt
            ? Math.floor((Date.now() - startedAt.startedAt.getTime()) / 1000)
            : 0;

        const peakViewers = parseInt(
            (await this.redis.get(`live:peak_viewers:${livestreamId}`)) || '0',
        );
        const totalViewers = parseInt(
            (await this.redis.get(`live:total_viewers:${livestreamId}`)) || '0',
        );

        await this.prisma.livestream.update({
            where: { id: livestreamId },
            data: {
                status: 'ENDED',
                endedAt: new Date(),
                duration,
                peakViewers,
                totalViewers,
            },
        });

        await this.prisma.channel.update({
            where: { id: channel.id },
            data: { isLive: false, currentStreamId: null },
        });

        // Clean up Redis keys
        await this.redis.del(
            `live:viewers:${livestreamId}`,
            `live:peak_viewers:${livestreamId}`,
            `live:total_viewers:${livestreamId}`,
        );

        this.notificationsGateway.broadcastLiveEnded(livestreamId, {});
    }

    // ─── Get live stream info ─────────────────────────────────────────────
    async getLivestreamById(livestreamId: string) {
        const stream = await this.prisma.livestream.findUnique({
            where: { id: livestreamId },
            include: {
                channel: {
                    select: { id: true, handle: true, name: true, avatarUrl: true, subscriberCount: true },
                },
            },
        });
        if (!stream) throw new NotFoundException('Livestream not found');

        // Get live viewer count from Redis
        const viewerCount = parseInt(
            (await this.redis.get(`live:viewers:${livestreamId}`)) || '0',
        );

        return { ...stream, viewerCount };
    }

    // ─── Increment/decrement viewer count ────────────────────────────────
    async joinStream(livestreamId: string, userId?: string) {
        const count = await this.redis.incr(`live:viewers:${livestreamId}`);
        const peak = parseInt((await this.redis.get(`live:peak_viewers:${livestreamId}`)) || '0');

        if (count > peak) {
            await this.redis.set(`live:peak_viewers:${livestreamId}`, count);
        }
        await this.redis.incr(`live:total_viewers:${livestreamId}`);
        await this.redis.expire(`live:viewers:${livestreamId}`, 86400);

        // Broadcast updated count
        this.notificationsGateway.broadcastViewerCount(livestreamId, count);
        return { viewerCount: count };
    }

    async leaveStream(livestreamId: string, userId?: string) {
        const count = await this.redis.decr(`live:viewers:${livestreamId}`);
        const safeCount = Math.max(0, count);
        if (count < 0) await this.redis.set(`live:viewers:${livestreamId}`, 0);

        this.notificationsGateway.broadcastViewerCount(livestreamId, safeCount);
        return { viewerCount: safeCount };
    }

    // ─── Live chat ────────────────────────────────────────────────────────
    async sendChatMessage(livestreamId: string, userId: string, message: string) {
        if (!message?.trim()) throw new BadRequestException('Message cannot be empty');
        if (message.length > 500) throw new BadRequestException('Message too long');

        const [user, stream] = await Promise.all([
            this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, displayName: true, avatarUrl: true } }),
            this.prisma.livestream.findUnique({ where: { id: livestreamId }, select: { status: true } }),
        ]);

        if (!stream || stream.status !== 'LIVE') {
            throw new BadRequestException('Stream is not live');
        }

        const chatMsg = await this.prisma.liveChatMessage.create({
            data: { livestreamId, userId, message: message.trim() },
        });

        // Publish to Redis pub/sub for all viewers
        await this.redis.publish(
            `live:chat:${livestreamId}`,
            JSON.stringify({ ...chatMsg, user }),
        );

        return chatMsg;
    }

    // ─── Get chat history ─────────────────────────────────────────────────
    async getChatHistory(livestreamId: string, before?: Date, limit = 50) {
        return this.prisma.liveChatMessage.findMany({
            where: {
                livestreamId,
                isDeleted: false,
                ...(before && { createdAt: { lt: before } }),
            },
            include: {
                livestream: false,
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
        });
    }

    // ─── Get active livestreams ───────────────────────────────────────────
    async getActiveLivestreams() {
        return this.prisma.livestream.findMany({
            where: { status: 'LIVE' },
            include: {
                channel: { select: { handle: true, name: true, avatarUrl: true } },
            },
            orderBy: { startedAt: 'asc' },
        });
    }

    // ─── Rotate stream key ────────────────────────────────────────────────
    async rotateStreamKey(userId: string) {
        const newStreamKey = uuidv4();
        await this.prisma.channel.update({
            where: { userId },
            data: { streamKey: newStreamKey },
        });
        return { streamKey: newStreamKey };
    }

    // ─── Cleanup stale streams (cron: every 10 min) ───────────────────────
    @Cron(CronExpression.EVERY_10_MINUTES)
    async cleanupStaleStreams() {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const staleStreams = await this.prisma.livestream.findMany({
            where: { status: 'LIVE', updatedAt: { lt: tenMinutesAgo } },
        });

        for (const stream of staleStreams) {
            await this.onStreamEnd(stream.streamKey);
        }
    }

    private async notifySubscribersLiveStarted(channelId: string, livestreamId: string) {
        const channel = await this.prisma.channel.findUnique({
            where: { id: channelId },
            include: {
                user: {
                    include: {
                        subscribers: {
                            where: { notifyOnLive: true },
                            select: { subscriberId: true },
                        },
                    },
                },
            },
        });
        if (!channel) return;

        const subscriberIds = channel.user.subscribers.map(s => s.subscriberId);
        if (subscriberIds.length === 0) return;

        await this.prisma.notification.createMany({
            data: subscriberIds.map(subscriberId => ({
                userId: subscriberId,
                type: 'LIVE_STARTED' as any,
                title: `${channel.name} is live!`,
                body: `${channel.name} just started streaming`,
                imageUrl: channel.avatarUrl,
                actionUrl: `/live/${livestreamId}`,
            })),
            skipDuplicates: true,
        });
    }
}
