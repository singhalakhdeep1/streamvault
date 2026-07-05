import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SearchModule } from '../search/search.module';

@Module({
    imports: [
        BullModule.registerQueue({ name: 'transcoding' }),
        StorageModule,
        NotificationsModule,
        SearchModule,
    ],
    controllers: [VideosController],
    providers: [VideosService],
    exports: [VideosService],
})
export class VideosModule {}
