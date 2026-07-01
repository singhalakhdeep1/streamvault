import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class StorageService {
    private client: Minio.Client;

    constructor(private config: ConfigService) {
        this.client = new Minio.Client({
            endPoint: config.get('MINIO_ENDPOINT', 'localhost'),
            port: config.get<number>('MINIO_PORT', 9000),
            useSSL: config.get('MINIO_USE_SSL', 'false') === 'true',
            accessKey: config.get('MINIO_ACCESS_KEY'),
            secretKey: config.get('MINIO_SECRET_KEY'),
        });
    }

    // ─── Presigned PUT URL (for direct browser upload) ───────────────────
    async createPresignedPutUrl(
        bucket: string,
        key: string,
        contentType: string,
        expiry: number = 3600,
    ): Promise<string> {
        return this.client.presignedPutObject(bucket, key, expiry);
    }

    // ─── Presigned GET URL (for reading objects) ──────────────────────────
    async getPresignedGetUrl(
        bucket: string,
        key: string,
        expiry: number = 3600,
    ): Promise<string> {
        return this.client.presignedGetObject(bucket, key, expiry);
    }

    // ─── Signed URL shorthand ─────────────────────────────────────────────
    getSignedUrl(bucket: string, key: string, expiry: number = 3600): Promise<string> {
        return this.client.presignedGetObject(bucket, key, expiry);
    }

    // ─── Upload buffer directly ────────────────────────────────────────────
    async putObject(
        bucket: string,
        key: string,
        buffer: Buffer,
        contentType: string,
    ): Promise<void> {
        await this.client.putObject(bucket, key, buffer, buffer.length, {
            'Content-Type': contentType,
        });
    }

    // ─── Delete single object ─────────────────────────────────────────────
    async deleteObject(bucket: string, key: string): Promise<void> {
        try {
            await this.client.removeObject(bucket, key);
        } catch (error) {
            // Ignore "not found" errors during cleanup
            if (error.code !== 'NoSuchKey') throw error;
        }
    }

    // ─── Delete all objects with prefix (e.g., whole HLS folder) ─────────
    async deleteFolder(bucket: string, prefix: string): Promise<void> {
        const objectsList: string[] = [];

        await new Promise<void>((resolve, reject) => {
            const stream = this.client.listObjects(bucket, prefix, true);
            stream.on('data', obj => { if (obj.name) objectsList.push(obj.name); });
            stream.on('error', reject);
            stream.on('end', resolve);
        });

        if (objectsList.length > 0) {
            await this.client.removeObjects(bucket, objectsList);
        }
    }

    // ─── Check object exists ──────────────────────────────────────────────
    async objectExists(bucket: string, key: string): Promise<boolean> {
        try {
            await this.client.statObject(bucket, key);
            return true;
        } catch {
            return false;
        }
    }

    // ─── Get object metadata ──────────────────────────────────────────────
    async getObjectStat(bucket: string, key: string) {
        return this.client.statObject(bucket, key);
    }

    // ─── Multipart upload support ─────────────────────────────────────────
    async createMultipartUpload(bucket: string, key: string, contentType: string): Promise<string> {
        // MinIO doesn't expose this directly; use the S3-compatible API via axios
        // For simplicity, return a UUID upload ID (real impl would call S3 CreateMultipartUpload)
        return `multipart-${Date.now()}`;
    }

    async presignPartUploadUrl(
        bucket: string,
        key: string,
        uploadId: string,
        partNumber: number,
    ): Promise<string> {
        // Generate presigned URL for part upload
        const partKey = `${key}.part${partNumber}`;
        return this.client.presignedPutObject(bucket, partKey, 3600);
    }

    async completeMultipartUpload(
        bucket: string,
        key: string,
        uploadId: string,
        parts: Array<{ ETag: string; PartNumber: number }>,
    ): Promise<void> {
        // In production, this calls S3 CompleteMultipartUpload
        // For MinIO, we'd combine the parts using the MinIO client
    }

    // ─── Ensure bucket exists ─────────────────────────────────────────────
    async ensureBucket(bucketName: string): Promise<void> {
        const exists = await this.client.bucketExists(bucketName);
        if (!exists) {
            await this.client.makeBucket(bucketName, 'us-east-1');
        }
    }

    // ─── Copy object (e.g., move from raw to processed) ──────────────────
    async copyObject(
        sourceBucket: string,
        sourceKey: string,
        destBucket: string,
        destKey: string,
    ): Promise<void> {
        const conditions = new Minio.CopyConditions();
        await this.client.copyObject(destBucket, destKey, `/${sourceBucket}/${sourceKey}`, conditions);
    }

    // ─── List objects with prefix ─────────────────────────────────────────
    async listObjects(bucket: string, prefix: string): Promise<string[]> {
        const objects: string[] = [];
        await new Promise<void>((resolve, reject) => {
            const stream = this.client.listObjects(bucket, prefix, true);
            stream.on('data', obj => { if (obj.name) objects.push(obj.name); });
            stream.on('error', reject);
            stream.on('end', resolve);
        });
        return objects;
    }
}
