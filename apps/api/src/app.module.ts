import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { BullModule } from '@nestjs/bull';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { VideosModule } from './videos/videos.module';
import { UploadModule } from './upload/upload.module';
import { StreamingModule } from './streaming/streaming.module';
import { LiveModule } from './live/live.module';
import { ChannelsModule } from './channels/channels.module';
import { CommentsModule } from './comments/comments.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { SearchModule } from './search/search.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { PaymentsModule } from './payments/payments.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StorageModule } from './storage/storage.module';
import { DatabaseModule } from './database/database.module';

@Module({
    imports: [
        // Config
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ['../../.env', '.env'],
        }),

        // Scheduler
        ScheduleModule.forRoot(),

        // Rate limiting
        ThrottlerModule.forRoot([
            { name: 'short', ttl: 60000, limit: 60 },    // 60 req/min
            { name: 'long', ttl: 3600000, limit: 1000 },  // 1000 req/hour
        ]),

        // BullMQ queues
        BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (config: ConfigService) => ({
                redis: {
                    host: config.get('REDIS_HOST', 'localhost'),
                    port: config.get<number>('REDIS_PORT', 6379),
                },
                defaultJobOptions: {
                    removeOnComplete: 100,
                    removeOnFail: 50,
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 5000 },
                },
            }),
        }),

        // App modules
        DatabaseModule,
        StorageModule,
        AuthModule,
        UsersModule,
        VideosModule,
        UploadModule,
        StreamingModule,
        LiveModule,
        ChannelsModule,
        CommentsModule,
        SubscriptionsModule,
        SearchModule,
        AnalyticsModule,
        PaymentsModule,
        RecommendationsModule,
        NotificationsModule,
    ],
    providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
    ],
})
export class AppModule { }
