import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
    constructor(private readonly analytics: AnalyticsService) {}

    @Get('dashboard')
    @UseGuards(JwtAuthGuard)
    getDashboard(@CurrentUser() user: any, @Query('days') days = '30') {
        return this.analytics.getCreatorDashboard(user.id, +days);
    }

    @Get('overview')
    @UseGuards(JwtAuthGuard)
    getOverview(@CurrentUser() user: any, @Query('days') days = '30') {
        return this.analytics.getCreatorDashboard(user.id, +days);
    }

    @Get('videos/:videoId')
    @UseGuards(JwtAuthGuard)
    getVideoAnalytics(@CurrentUser() user: any, @Param('videoId') videoId: string) {
        return this.analytics.getVideoAnalytics(videoId, user.id);
    }

    @Post('view/:videoId')
    @UseGuards(OptionalJwtGuard)
    recordView(
        @Param('videoId') videoId: string,
        @CurrentUser() user: any,
        @Body() body: { sessionId: string },
    ) {
        return this.analytics.recordView(videoId, body.sessionId, user?.id);
    }

    @Post('watch-time/:videoId')
    @UseGuards(JwtAuthGuard)
    recordWatchTime(
        @CurrentUser() user: any,
        @Param('videoId') videoId: string,
        @Body() body: { watchedSeconds: number; totalSeconds: number },
    ) {
        return this.analytics.recordWatchTime(videoId, user.id, body.watchedSeconds, body.totalSeconds);
    }
}
