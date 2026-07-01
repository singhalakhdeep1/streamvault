import {
    Controller, Post, Body, Param, Get, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('upload')
@Controller('upload')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UploadController {
    constructor(private readonly uploadService: UploadService) { }

    @Post('init')
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Initialize upload — returns presigned URL and video ID' })
    initUpload(@CurrentUser('id') userId: string, @Body() dto: any) {
        return this.uploadService.initUpload(userId, dto);
    }

    @Post(':videoId/complete')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Signal upload complete — triggers transcoding queue' })
    completeUpload(
        @Param('videoId') videoId: string,
        @CurrentUser('id') userId: string,
        @Body() body: { checksum?: string },
    ) {
        return this.uploadService.completeUpload(videoId, userId, body);
    }

    @Get(':videoId/progress')
    @ApiOperation({ summary: 'Get transcoding job progress' })
    getProgress(@Param('videoId') videoId: string, @CurrentUser('id') userId: string) {
        return this.uploadService.getUploadProgress(videoId, userId);
    }

    @Post('multipart/init')
    @ApiOperation({ summary: 'Initialize multipart upload for large files' })
    initMultipart(
        @CurrentUser('id') userId: string,
        @Body() body: { fileName: string; mimeType: string },
    ) {
        return this.uploadService.initMultipartUpload(userId, body.fileName, body.mimeType);
    }

    @Post('multipart/part-url')
    @ApiOperation({ summary: 'Get presigned URL for a specific part' })
    getPartUrl(@Body() body: { key: string; multipartUploadId: string; partNumber: number }) {
        return this.uploadService.getPartUploadUrl(body.key, body.multipartUploadId, body.partNumber);
    }

    @Post('multipart/complete')
    @ApiOperation({ summary: 'Complete multipart upload' })
    completeMultipart(
        @Body() body: {
            key: string;
            multipartUploadId: string;
            parts: Array<{ ETag: string; PartNumber: number }>;
        },
    ) {
        return this.uploadService.completeMultipartUpload(body.key, body.multipartUploadId, body.parts);
    }
}
