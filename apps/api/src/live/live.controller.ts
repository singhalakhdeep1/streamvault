import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LiveService } from './live.service';

@Controller('live')
export class LiveController {
    constructor(private readonly live: LiveService) {}

    @Post('rtmp/publish')
    @Public()
    onPublish(@Body() body: { name: string; [key: string]: any }) {
        return this.live.onStreamStart(body.name, body);
    }

    @Post('rtmp/done')
    @Public()
    onDone(@Body() body: { name: string }) {
        return this.live.onStreamEnd(body.name);
    }

    @Get('streams')
    @Public()
    getActiveStreams() {
        return this.live.getActiveLivestreams();
    }

    @Get('streams/:streamId')
    @UseGuards(OptionalJwtGuard)
    getStream(@Param('streamId') streamId: string) {
        return this.live.getLivestreamById(streamId);
    }

    @Get('streams/:streamId/chat')
    @Public()
    getChatHistory(@Param('streamId') streamId: string, @Query('limit') limit = '50') {
        return this.live.getChatHistory(streamId, undefined, +limit);
    }

    @Post('streams/:streamId/join')
    @UseGuards(OptionalJwtGuard)
    joinStream(@Param('streamId') streamId: string, @CurrentUser() user: any) {
        return this.live.joinStream(streamId, user?.id);
    }

    @Post('rotate-key')
    @UseGuards(JwtAuthGuard)
    rotateKey(@CurrentUser() user: any) {
        return this.live.rotateStreamKey(user.id);
    }
}
