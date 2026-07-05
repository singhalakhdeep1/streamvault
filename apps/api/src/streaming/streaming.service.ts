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
  ) {}

  async getSignedManifestUrl(videoId: string, userId?: string) {
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      select: {
        id: true,
        hlsStorageKey: true,
        visibility: true,
        requiresPremium: true,
        status: true,
        channelId: true,
        userId: true,
      },
    });

    if (!video || video.status !== 'READY') {
      return null;
    }

    if (video.visibility === 'PRIVATE') {
      if (!userId || video.userId !== userId) return null;
    }

    if (video.requiresPremium && userId) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user?.isPremium) return { requiresPremium: true };
    }

    void this.trackView(videoId, userId);

    const bucket = this.config.get('MINIO_HLS_BUCKET', 'streamvault-hls');
    const signedUrl = await this.storage.getSignedUrl(
      bucket,
      `${video.hlsStorageKey}/master.m3u8`,
      3600,
    );

    return { url: signedUrl };
  }

  private async trackView(videoId: string, userId?: string) {
    await this.prisma.video.update({
      where: { id: videoId },
      data: { viewCount: { increment: 1 } },
    });

    if (userId) {
      await this.prisma.watchHistory.upsert({
        where: { userId_videoId: { userId, videoId } },
        update: { lastWatchedAt: new Date(), watchCount: { increment: 1 } },
        create: { userId, videoId, watchedSeconds: 0, totalSeconds: 0 },
      });
    }
  }
}
