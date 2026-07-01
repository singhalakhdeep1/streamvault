import { Module, forwardRef } from '@nestjs/common';
import { LiveService } from './live.service';
import { LiveGateway } from './live.gateway';
import { LiveController } from './live.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
    imports: [forwardRef(() => NotificationsModule)],
    controllers: [LiveController],
    providers: [LiveService, LiveGateway],
    exports: [LiveService],
})
export class LiveModule { }
