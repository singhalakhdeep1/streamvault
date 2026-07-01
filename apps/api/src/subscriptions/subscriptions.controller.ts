import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
    constructor(private readonly subscriptions: SubscriptionsService) { }

    @Post(':channelId')
    toggle(@CurrentUser() user: any, @Param('channelId') channelId: string) {
        return this.subscriptions.toggle(user.id, channelId);
    }

    @Get('feed')
    getFeed(
        @CurrentUser() user: any,
        @Query('page') page = '1',
        @Query('limit') limit = '20',
    ) {
        return this.subscriptions.getFeed(user.id, +page, +limit);
    }

    @Get('mine')
    getMine(@CurrentUser() user: any) {
        return this.subscriptions.getMySubscriptions(user.id);
    }

    @Patch(':channelId/notifications')
    setNotifications(
        @CurrentUser() user: any,
        @Param('channelId') channelId: string,
        @Body() body: { type: string },
    ) {
        return this.subscriptions.updateNotificationPreference(user.id, channelId, body.type);
    }
}
