import { Controller, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
    constructor(private readonly users: UsersService) { }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    getMe(@CurrentUser() user: any) {
        return this.users.findById(user.id);
    }

    @Get('me/history')
    @UseGuards(JwtAuthGuard)
    getHistory(
        @CurrentUser() user: any,
        @Query('page') page = '1',
        @Query('limit') limit = '20',
    ) {
        return this.users.getWatchHistory(user.id, +page, +limit);
    }

    @Get('me/watch-later')
    @UseGuards(JwtAuthGuard)
    getWatchLater(@CurrentUser() user: any) {
        return this.users.getWatchLater(user.id);
    }

    @Patch('me/watch-later/:videoId')
    @UseGuards(JwtAuthGuard)
    toggleWatchLater(@CurrentUser() user: any, @Param('videoId') videoId: string) {
        return this.users.toggleWatchLater(user.id, videoId);
    }

    @Patch('me/progress/:videoId')
    @UseGuards(JwtAuthGuard)
    saveProgress(
        @CurrentUser() user: any,
        @Param('videoId') videoId: string,
        @Body() body: { position: number; duration: number },
    ) {
        return this.users.upsertWatchProgress(user.id, videoId, body.position, body.duration);
    }

    @Patch('me')
    @UseGuards(JwtAuthGuard)
    updateProfile(
        @CurrentUser() user: any,
        @Body() body: { displayName?: string; bio?: string },
    ) {
        return this.users.updateProfile(user.id, body);
    }

    @Get(':username')
    getProfile(@Param('username') username: string) {
        return this.users.findByUsername(username);
    }
}
