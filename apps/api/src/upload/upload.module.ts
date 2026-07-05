import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { BullModule } from '@nestjs/bull';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DatabaseModule } from '../database/database.module';

@Module({
    imports: [
        MulterModule.register({ dest: '/tmp/uploads' }),
        BullModule.registerQueue({ name: 'transcoding' }),
        DatabaseModule,
        StorageModule,
        NotificationsModule,
    ],
    controllers: [UploadController],
    providers: [UploadService],
    exports: [UploadService],
})
export class UploadModule {}
