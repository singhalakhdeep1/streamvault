import {
    Injectable, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

export interface UploadInitDto {
    fileName: string;
    fileSize: number;
    mimeType: string;
    title: string;
    description?: string;
    tags?: string[];
    categoryId?: string;
    visibility?: string;
}

@Injectable()
export class UploadService {
    constructor(
        private prisma: PrismaService,
        private storage: StorageService,
        private config: ConfigService,
        private notificationsGateway: NotificationsGateway,
        @InjectQueue('transcoding') private transcodingQueue: Queue,
    ) { }

    // ─── Initialize TUS upload (create video record + get upload URL) ─────
    async initUpload(userId: string, dto: UploadInitDto) {
        // Validate file type
        const allowedTypes = ['video/mp4', 'video/webm', 'video/mov', 'video/avi', 'video/mkv'];
        if (!allowedTypes.includes(dto.mimeType)) {
            throw new BadRequestException(`Unsupported file type: ${dto.mimeType}`);
        }

        // Validate file size (max 10GB)
        const maxSize = 10 * 1024 * 1024 * 1024;
        if (dto.fileSize > maxSize) {
            throw new BadRequestException('File too large. Maximum size is 10GB');
        }

        const uploadId = uuidv4();
        const rawStorageKey = `raw/${userId}/${uploadId}/${dto.fileName}`;

        // Create video record in UPLOADING state
        const channel = await this.prisma.channel.findUnique({ where: { userId } });
        if (!channel) throw new BadRequestException('No channel found');

        const video = await this.prisma.video.create({
            data: {
                userId,
                channelId: channel.id,
                title: dto.title,
                description: dto.description,
                tags: dto.tags || [],
                categoryId: dto.categoryId,
                visibility: (dto.visibility as any) || 'PRIVATE',
                status: 'UPLOADING',
                rawStorageKey,
                fileSize: BigInt(dto.fileSize),
            },
        });

        // Generate presigned upload URL (multipart for large files)
        const uploadUrl = await this.storage.createPresignedPutUrl(
            this.config.get('MINIO_RAW_BUCKET', 'streamvault-raw'),
            rawStorageKey,
            dto.mimeType,
            3600, // 1 hour to complete upload
        );

        return {
            videoId: video.id,
            uploadId,
            uploadUrl,
            rawStorageKey,
            expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
        };
    }

    // ─── Called when client signals upload complete ───────────────────────
    async completeUpload(videoId: string, userId: string, uploadData: { checksum?: string }) {
        const video = await this.prisma.video.findUnique({
            where: { id: videoId, userId },
        });
        if (!video) throw new NotFoundException('Video not found');
        if (video.status !== 'UPLOADING') {
            throw new BadRequestException('Video is not in uploading state');
        }

        // Update status to PROCESSING
        await this.prisma.video.update({
            where: { id: videoId },
            data: { status: 'PROCESSING' },
        });

        // Enqueue transcoding job
        const job = await this.transcodingQueue.add(
            'transcode-video',
            {
                videoId,
                rawStorageKey: video.rawStorageKey,
                userId,
            },
            {
                priority: 1,
                attempts: 3,
                backoff: { type: 'exponential', delay: 10000 },
            },
        );

        await this.prisma.video.update({
            where: { id: videoId },
            data: { processingJobId: String(job.id) },
        });

        // Notify user that processing has started
        this.notificationsGateway.sendToUser(userId, 'upload:processing', {
            videoId,
            jobId: job.id,
            message: 'Your video is being processed',
        });

        return { videoId, jobId: job.id, status: 'PROCESSING' };
    }

    // ─── Get upload progress (job status) ────────────────────────────────
    async getUploadProgress(videoId: string, userId: string) {
        const video = await this.prisma.video.findUnique({
            where: { id: videoId, userId },
            select: {
                id: true, status: true, processingJobId: true, errorMessage: true,
                qualities: { where: { isReady: true }, select: { quality: true } },
            },
        });
        if (!video) throw new NotFoundException('Video not found');

        let jobProgress = 0;
        if (video.processingJobId) {
            const job = await this.transcodingQueue.getJob(video.processingJobId);
            jobProgress = job ? (job.progress() as number) : 0;
        }

        return {
            videoId,
            status: video.status,
            progress: jobProgress,
            readyQualities: video.qualities.map(q => q.quality),
            error: video.errorMessage,
        };
    }

    // ─── Generate multipart upload (chunked, for large files) ────────────
    async initMultipartUpload(userId: string, fileName: string, mimeType: string) {
        const uploadId = uuidv4();
        const key = `raw/${userId}/${uploadId}/${fileName}`;

        const multipartUploadId = await this.storage.createMultipartUpload(
            this.config.get('MINIO_RAW_BUCKET'),
            key,
            mimeType,
        );

        return { uploadId, key, multipartUploadId };
    }

    async getPartUploadUrl(key: string, multipartUploadId: string, partNumber: number) {
        const url = await this.storage.presignPartUploadUrl(
            this.config.get('MINIO_RAW_BUCKET'),
            key,
            multipartUploadId,
            partNumber,
        );
        return { url, partNumber };
    }

    async completeMultipartUpload(
        key: string,
        multipartUploadId: string,
        parts: Array<{ ETag: string; PartNumber: number }>,
    ) {
        await this.storage.completeMultipartUpload(
            this.config.get('MINIO_RAW_BUCKET'),
            key,
            multipartUploadId,
            parts,
        );
        return { key, status: 'uploaded' };
    }
}
