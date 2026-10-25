import { Process, Processor, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../storage/storage.service';
import { NotificationsGateway } from '../../notifications/notifications.gateway';
import { SearchService } from '../../search/search.service';

export interface TranscodeJobData {
    videoId: string;
    rawStorageKey: string;
    userId: string;
}

@Processor('transcoding')
export class TranscodingProcessor {
    private readonly logger = new Logger(TranscodingProcessor.name);

    constructor(
        private prisma: PrismaService,
        private storage: StorageService,
        private config: ConfigService,
        private notificationsGateway: NotificationsGateway,
        private searchService: SearchService,
    ) { }

    @Process('transcode-video')
    async handleTranscode(job: Job<TranscodeJobData>) {
        const { videoId, rawStorageKey, userId } = job.data;
        this.logger.log(`Starting transcoding for video: ${videoId}`);

        try {
            await this.prisma.video.update({
                where: { id: videoId },
                data: { status: 'TRANSCODING' },
            });
            await job.progress(5);

            // Notify user: transcoding started
            this.notificationsGateway.sendToUser(userId, 'video:transcoding', {
                videoId, progress: 5, stage: 'started',
            });

            // Get download URL from MinIO for the transcoder
            const rawDownloadUrl = await this.storage.getPresignedGetUrl(
                this.config.get('MINIO_RAW_BUCKET'),
                rawStorageKey,
                3600,
            );

            await job.progress(10);

            // Call FastAPI transcoder service
            const transcoderUrl = this.config.get('TRANSCODER_URL', 'http://localhost:8001');

            const transcoderRes = await fetch(`${transcoderUrl}/api/transcode`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Internal-Secret': this.config.get('TRANSCODER_SECRET'),
                },
                body: JSON.stringify({
                    video_id: videoId,
                    source_url: rawDownloadUrl,
                    output_bucket: this.config.get('MINIO_HLS_BUCKET'),
                    qualities: ['1080p', '720p', '480p', '360p'],
                    generate_thumbnails: true,
                    thumbnail_count: 5,
                }),
                signal: AbortSignal.timeout(3600000),
            });

            if (!transcoderRes.ok) {
                throw new Error(`Transcoder returned ${transcoderRes.status}`);
            }

            await job.progress(90);

            const result = await transcoderRes.json() as any;

            // Save quality records
            const qualityCreates = result.qualities.map((q: any) => ({
                videoId,
                quality: q.label,
                resolution: q.resolution,
                bitrate: q.bitrate,
                storageKey: q.hls_key,
                fileSize: BigInt(q.file_size || 0),
                isReady: true,
            }));

            await this.prisma.videoQuality.createMany({ data: qualityCreates });

            // Save thumbnails
            if (result.thumbnails?.length > 0) {
                await this.prisma.thumbnail.createMany({
                    data: result.thumbnails.map((t: any, i: number) => ({
                        videoId,
                        url: t.url,
                        isCustom: false,
                        isActive: i === 0, // First thumbnail is active by default
                    })),
                });
            }

            // Update video record
            await this.prisma.video.update({
                where: { id: videoId },
                data: {
                    status: 'READY',
                    hlsStorageKey: result.hls_master_key,
                    duration: result.duration,
                    width: result.width,
                    height: result.height,
                    fps: result.fps,
                    bitrate: result.bitrate,
                    codec: result.codec,
                    processedAt: new Date(),
                },
            });

            await job.progress(95);

            // Index in Meilisearch for search
            const video = await this.prisma.video.findUnique({
                where: { id: videoId },
                include: { category: true, channel: true },
            });
            await this.searchService.indexVideo(video);

            await job.progress(100);

            // Notify user: ready
            this.notificationsGateway.sendToUser(userId, 'video:ready', {
                videoId,
                progress: 100,
                stage: 'complete',
                hlsKey: result.hls_master_key,
                duration: result.duration,
                qualities: result.qualities.map((q: any) => q.label),
            });

            this.logger.log(`Transcoding complete for video: ${videoId}`);
            return { videoId, status: 'READY' };

        } catch (error) {
            this.logger.error(`Transcoding failed for ${videoId}: ${error.message}`);
            await this.prisma.video.update({
                where: { id: videoId },
                data: { status: 'FAILED', errorMessage: error.message },
            });
            this.notificationsGateway.sendToUser(userId, 'video:failed', {
                videoId, error: error.message,
            });
            throw error;
        }
    }

    @Process('cleanup-video')
    async handleCleanup(job: Job<{ videoId: string }>) {
        const { videoId } = job.data;
        const video = await this.prisma.video.findUnique({ where: { id: videoId } });
        if (!video) return;

        // Delete raw file, HLS segments, thumbnails
        const cleanupJobs = [];
        if (video.rawStorageKey) {
            cleanupJobs.push(
                this.storage.deleteObject(this.config.get('MINIO_RAW_BUCKET'), video.rawStorageKey),
            );
        }
        if (video.hlsStorageKey) {
            cleanupJobs.push(
                this.storage.deleteFolder(this.config.get('MINIO_HLS_BUCKET'), video.hlsStorageKey),
            );
        }

        await Promise.allSettled(cleanupJobs);
        this.logger.log(`Cleaned up storage for deleted video: ${videoId}`);
    }

    @OnQueueActive()
    onActive(job: Job) {
        this.logger.log(`Processing job ${job.id}: ${job.name}`);
    }

    @OnQueueCompleted()
    onCompleted(job: Job, result: any) {
        this.logger.log(`Job ${job.id} completed: ${JSON.stringify(result)}`);
    }

    @OnQueueFailed()
    onFailed(job: Job, error: Error) {
        this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
    }
}
