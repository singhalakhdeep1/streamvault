import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TranscodingProcessor } from './processors/transcoding.processor';

@Module({
    imports: [
        BullModule.registerQueue({ name: 'transcoding' }),
        BullModule.registerQueue({ name: 'thumbnails' }),
        BullModule.registerQueue({ name: 'notifications' }),
    ],
    providers: [TranscodingProcessor],
    exports: [BullModule],
})
export class QueueModule { }
