import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StreamingService } from './streaming.service';

@Controller('streaming')
export class StreamingController {
    constructor(private readonly streaming: StreamingService) { }

    @Get(':videoId/manifest')
    @UseGuards(OptionalJwtGuard)
    getManifest(@Param('videoId') videoId: string, @CurrentUser() user: any) {
        return this.streaming.getSignedManifestUrl(videoId, user?.id);
    }
}
