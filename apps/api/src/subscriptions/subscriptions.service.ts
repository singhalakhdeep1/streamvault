import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveChannelUserId(channelId: string): Promise<string> {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { userId: true },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    return channel.userId;
  }

  async toggle(subscriberId: string, channelId: string) {
    const channelUserId = await this.resolveChannelUserId(channelId);

    const existing = await this.prisma.subscription.findUnique({
      where: { subscriberId_channelUserId: { subscriberId, channelUserId } },
    });

    if (existing) {
      await this.prisma.subscription.delete({
        where: { subscriberId_channelUserId: { subscriberId, channelUserId } },
      });
      await this.prisma.channel.update({
        where: { id: channelId },
        data: { subscriberCount: { decrement: 1 } },
      });
      return { subscribed: false };
    }

    await this.prisma.subscription.create({ data: { subscriberId, channelUserId } });
    await this.prisma.channel.update({
      where: { id: channelId },
      data: { subscriberCount: { increment: 1 } },
    });
    return { subscribed: true };
  }

  async getFeed(userId: string, page = 1, limit = 20) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { subscriberId: userId },
      select: { channelUserId: true },
    });

    const channelUserIds = subscriptions.map((s) => s.channelUserId);
    const channels = await this.prisma.channel.findMany({
      where: { userId: { in: channelUserIds } },
      select: { id: true },
    });
    const channelIds = channels.map((c) => c.id);

    const skip = (page - 1) * limit;
    const [videos, total] = await Promise.all([
      this.prisma.video.findMany({
        where: {
          channelId: { in: channelIds },
          status: 'READY',
          visibility: 'PUBLIC',
        },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
        include: {
          thumbnails: { take: 1 },
          channel: { select: { name: true, handle: true, avatarUrl: true } },
        },
      }),
      this.prisma.video.count({
        where: {
          channelId: { in: channelIds },
          status: 'READY',
          visibility: 'PUBLIC',
        },
      }),
    ]);

    return { videos, total, page, limit };
  }

  async getMySubscriptions(userId: string) {
    return this.prisma.subscription.findMany({
      where: { subscriberId: userId },
      orderBy: { subscribedAt: 'desc' },
      include: {
        channelUser: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatarUrl: true,
            channel: {
              select: {
                id: true,
                name: true,
                handle: true,
                subscriberCount: true,
                videoCount: true,
              },
            },
          },
        },
      },
    });
  }

  async updateNotificationPreference(
    subscriberId: string,
    channelId: string,
    type: 'upload' | 'live' | 'all' | 'none',
  ) {
    const channelUserId = await this.resolveChannelUserId(channelId);
    return this.prisma.subscription.update({
      where: { subscriberId_channelUserId: { subscriberId, channelUserId } },
      data: {
        notifyOnUpload: type === 'all' || type === 'upload',
        notifyOnLive: type === 'all' || type === 'live',
      },
    });
  }
}
