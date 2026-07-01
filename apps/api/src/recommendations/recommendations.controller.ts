import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { RecommendationsService } from './recommendations.service';

@Controller('recommendations')
export class RecommendationsController {
    constructor(private readonly recommendations: RecommendationsService) { }

    @Get('feed')
    @UseGuards(OptionalJwtGuard)
    getFeed(
        @CurrentUser() user: any,
        @Query('page') page = '1',
        @Query('limit') limit = '24',
    ) {
        return this.recommendations.getHomeFeed(user?.id, +page, +limit);
    }

    @Get('trending')
    @Public()
    getTrending(@Query('limit') limit = '24') {
        return this.recommendations.getTrending(+limit);
    }

    @Get('related/:videoId')
    @Public()
    getRelated(@Param('videoId') videoId: string, @Query('limit') limit = '12') {
        return this.recommendations.getRelated(videoId, +limit);
    }
}
