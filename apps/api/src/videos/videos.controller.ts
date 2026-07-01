import {
    Controller, Get, Post, Put, Delete, Patch, Param, Body,
    Query, UseGuards, HttpCode, HttpStatus, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { VideosService } from './videos.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { VideoQueryDto } from './dto/video-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtGuard } from '../common/guards/optional-jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('videos')
@Controller('videos')
export class VideosController {
    constructor(private readonly videosService: VideosService) { }

    @Get()
    @UseGuards(OptionalJwtGuard)
    @ApiOperation({ summary: 'Get video feed (home page)' })
    getFeed(@Query() query: VideoQueryDto, @CurrentUser('id') userId?: string) {
        return this.videosService.getFeed(userId, query);
    }

    @Get(':id')
    @UseGuards(OptionalJwtGuard)
    @ApiOperation({ summary: 'Get video by ID with HLS URLs and metadata' })
    findOne(@Param('id') id: string, @CurrentUser('id') userId?: string) {
        return this.videosService.findById(id, userId);
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create video record after upload' })
    create(@CurrentUser('id') userId: string, @Body() dto: CreateVideoDto) {
        return this.videosService.createVideoRecord(userId, dto);
    }

    @Post(':id/transcode')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Trigger transcoding job for a video' })
    triggerTranscode(@Param('id') id: string, @CurrentUser('id') userId: string) {
        return this.videosService.triggerTranscoding(id);
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update video metadata' })
    update(
        @Param('id') id: string,
        @CurrentUser('id') userId: string,
        @Body() dto: UpdateVideoDto,
    ) {
        return this.videosService.update(id, userId, dto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Delete video' })
    remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
        return this.videosService.delete(id, userId);
    }

    @Post(':id/like')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Like a video' })
    like(@Param('id') id: string, @CurrentUser('id') userId: string) {
        return this.videosService.toggleLike(id, userId, true);
    }

    @Post(':id/dislike')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Dislike a video' })
    dislike(@Param('id') id: string, @CurrentUser('id') userId: string) {
        return this.videosService.toggleLike(id, userId, false);
    }

    @Get('channel/:channelId')
    @UseGuards(OptionalJwtGuard)
    @ApiOperation({ summary: 'Get all videos for a channel' })
    getChannelVideos(
        @Param('channelId') channelId: string,
        @Query() query: VideoQueryDto,
        @CurrentUser('id') userId?: string,
    ) {
        return this.videosService.getChannelVideos(channelId, userId, query);
    }

    @Post(':id/view')
    @UseGuards(OptionalJwtGuard)
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Record a video view' })
    recordView(
        @Param('id') id: string,
        @Body('sessionId') sessionId: string,
        @CurrentUser('id') userId?: string,
    ) {
        return this.videosService.recordView(id, sessionId, userId);
    }
}
