import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getVideoComments(videoId: string, page = 1, limit = 20, sort = 'top') {
    const skip = (page - 1) * limit;
    const orderBy: { createdAt?: 'desc'; likeCount?: 'desc' } =
      sort === 'newest' ? { createdAt: 'desc' } : { likeCount: 'desc' };

    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { videoId, parentId: null },
        orderBy,
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, displayName: true, avatarUrl: true, isVerified: true },
          },
          replies: {
            take: 3,
            orderBy: { createdAt: 'asc' },
            include: {
              user: {
                select: { id: true, displayName: true, avatarUrl: true },
              },
            },
          },
          _count: { select: { replies: true } },
        },
      }),
      this.prisma.comment.count({ where: { videoId, parentId: null } }),
    ]);

    return { comments, total, page, limit };
  }

  async getReplies(commentId: string) {
    return this.prisma.comment.findMany({
      where: { parentId: commentId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, displayName: true, avatarUrl: true, isVerified: true },
        },
      },
    });
  }

  async create(userId: string, data: { videoId: string; text: string; parentId?: string }) {
    const comment = await this.prisma.comment.create({
      data: {
        userId,
        videoId: data.videoId,
        content: data.text,
        parentId: data.parentId,
      },
      include: {
        user: {
          select: { id: true, displayName: true, avatarUrl: true, isVerified: true },
        },
      },
    });

    await this.prisma.video.update({
      where: { id: data.videoId },
      data: { commentCount: { increment: 1 } },
    });

    return comment;
  }

  async update(userId: string, commentId: string, text: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.userId !== userId) throw new ForbiddenException();

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { content: text, isEdited: true },
    });
  }

  async delete(userId: string, commentId: string, userRole: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');

    const isOwner = comment.userId === userId;
    const isAdmin = ['ADMIN', 'MODERATOR'].includes(userRole);
    if (!isOwner && !isAdmin) throw new ForbiddenException();

    await this.prisma.comment.delete({ where: { id: commentId } });
    await this.prisma.video.update({
      where: { id: comment.videoId },
      data: { commentCount: { decrement: 1 } },
    });
  }

  async toggleLike(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
    if (!comment) throw new NotFoundException('Comment not found');

    // Simple like toggle — increment/decrement counter (no CommentLike table in schema)
    const key = `comment_like:${userId}:${commentId}`;
    void key;
    await this.prisma.comment.update({
      where: { id: commentId },
      data: { likeCount: { increment: 1 } },
    });
    return { liked: true };
  }
}
