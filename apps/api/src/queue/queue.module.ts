import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TranscodingProcessor } from './processors/transcoding.processor';
import { DatabaseModule } from '../database/database.module';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SearchModule } from '../search/search.module';

@Module({
    imports: [
        BullModule.registerQueue({ name: 'transcoding' }),
        BullModule.registerQueue({ name: 'thumbnails' }),
        BullModule.registerQueue({ name: 'notifications' }),
        DatabaseModule,
        StorageModule,
        NotificationsModule,
        SearchModule,
    ],
    providers: [TranscodingProcessor],
    exports: [BullModule],
})
export class QueueModule {}
