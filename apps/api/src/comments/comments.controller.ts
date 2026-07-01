import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CommentsService } from './comments.service';

@Controller('comments')
export class CommentsController {
    constructor(private readonly comments: CommentsService) { }

    @Get('video/:videoId')
    @Public()
    getVideoComments(
        @Param('videoId') videoId: string,
        @Query('page') page = '1',
        @Query('limit') limit = '20',
        @Query('sort') sort = 'top',
    ) {
        return this.comments.getVideoComments(videoId, +page, +limit, sort);
    }

    @Get(':commentId/replies')
    @Public()
    getReplies(@Param('commentId') commentId: string) {
        return this.comments.getReplies(commentId);
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    create(
        @CurrentUser() user: any,
        @Body() body: { videoId: string; text: string; parentId?: string },
    ) {
        return this.comments.create(user.id, body);
    }

    @Put(':commentId')
    @UseGuards(JwtAuthGuard)
    update(
        @CurrentUser() user: any,
        @Param('commentId') commentId: string,
        @Body() body: { text: string },
    ) {
        return this.comments.update(user.id, commentId, body.text);
    }

    @Delete(':commentId')
    @UseGuards(JwtAuthGuard)
    delete(@CurrentUser() user: any, @Param('commentId') commentId: string) {
        return this.comments.delete(user.id, commentId, user.role);
    }

    @Post(':commentId/like')
    @UseGuards(JwtAuthGuard)
    toggleLike(@CurrentUser() user: any, @Param('commentId') commentId: string) {
        return this.comments.toggleLike(user.id, commentId);
    }
}
