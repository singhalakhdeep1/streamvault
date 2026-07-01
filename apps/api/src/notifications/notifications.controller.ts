import { Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
    constructor(private readonly notifications: NotificationsService) { }

    @Get()
    getAll(
        @CurrentUser() user: any,
        @Query('page') page = '1',
        @Query('limit') limit = '20',
    ) {
        return this.notifications.getForUser(user.id, +page, +limit);
    }

    @Patch('read-all')
    markAllRead(@CurrentUser() user: any) {
        return this.notifications.markRead(user.id);
    }

    @Patch(':id/read')
    markRead(@CurrentUser() user: any, @Param('id') id: string) {
        return this.notifications.markRead(user.id, id);
    }
}
