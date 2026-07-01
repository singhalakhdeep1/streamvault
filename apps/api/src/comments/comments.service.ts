import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class CommentsService {
    constructor(private readonly prisma: PrismaService) { }

    async getVideoComments(videoId: string, page = 1, limit = 20, sort = 'top') {
        const skip = (page - 1) * limit;
        const orderBy: any = sort === 'newest' ? { createdAt: 'desc' } : { likeCount: 'desc' };

        const [comments, total] = await Promise.all([
            this.prisma.comment.findMany({
                where: { videoId, parentId: null },
                orderBy,
                skip,
                take: limit,
                include: {
                    author: {
                        select: { id: true, displayName: true, avatarUrl: true, isVerified: true },
                    },
                    replies: {
                        take: 3,
                        orderBy: { createdAt: 'asc' },
                        include: {
                            author: {
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
                author: {
                    select: { id: true, displayName: true, avatarUrl: true, isVerified: true },
                },
            },
        });
    }

    async create(userId: string, data: { videoId: string; text: string; parentId?: string }) {
        const comment = await this.prisma.comment.create({
            data: { authorId: userId, ...data },
            include: {
                author: {
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
        if (comment.authorId !== userId) throw new ForbiddenException();

        return this.prisma.comment.update({
            where: { id: commentId },
            data: { text, isEdited: true },
        });
    }

    async delete(userId: string, commentId: string, userRole: string) {
        const comment = await this.prisma.comment.findUnique({ where: { id: commentId } });
        if (!comment) throw new NotFoundException('Comment not found');

        const isOwner = comment.authorId === userId;
        const isAdmin = ['ADMIN', 'MODERATOR'].includes(userRole);
        if (!isOwner && !isAdmin) throw new ForbiddenException();

        await this.prisma.comment.delete({ where: { id: commentId } });
        await this.prisma.video.update({
            where: { id: comment.videoId },
            data: { commentCount: { decrement: 1 } },
        });
    }

    async toggleLike(userId: string, commentId: string) {
        const existing = await this.prisma.commentLike.findUnique({
            where: { userId_commentId: { userId, commentId } },
        });

        if (existing) {
            await this.prisma.commentLike.delete({ where: { userId_commentId: { userId, commentId } } });
            await this.prisma.comment.update({ where: { id: commentId }, data: { likeCount: { decrement: 1 } } });
            return { liked: false };
        }

        await this.prisma.commentLike.create({ data: { userId, commentId } });
        await this.prisma.comment.update({ where: { id: commentId }, data: { likeCount: { increment: 1 } } });
        return { liked: true };
    }
}
