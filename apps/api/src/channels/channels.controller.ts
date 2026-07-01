import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { ChannelsService } from './channels.service';

@Controller('channels')
export class ChannelsController {
    constructor(private readonly channels: ChannelsService) { }

    @Post()
    @UseGuards(JwtAuthGuard)
    create(
        @CurrentUser() user: any,
        @Body() body: { name: string; handle: string; description?: string },
    ) {
        return this.channels.create(user.id, body);
    }

    @Patch('me')
    @UseGuards(JwtAuthGuard)
    update(
        @CurrentUser() user: any,
        @Body() body: { name?: string; description?: string; avatarUrl?: string; bannerUrl?: string },
    ) {
        return this.channels.update(user.id, body);
    }

    @Get(':handle')
    @UseGuards(OptionalJwtGuard)
    getChannel(@Param('handle') handle: string, @CurrentUser() user: any) {
        return this.channels.findByHandle(handle, user?.id);
    }

    @Get(':handle/videos')
    @Public()
    getVideos(
        @Param('handle') handle: string,
        @Query('page') page = '1',
        @Query('limit') limit = '20',
        @Query('sort') sort = 'newest',
    ) {
        return this.channels.getVideos(handle, +page, +limit, sort);
    }
}
