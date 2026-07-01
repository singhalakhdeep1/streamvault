import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
    const app = await NestFactory.create(AppModule, {
        logger: ['log', 'warn', 'error', 'debug'],
    });

    const logger = new Logger('Bootstrap');

    // WebSocket adapter
    app.useWebSocketAdapter(new IoAdapter(app));

    // Global prefix
    app.setGlobalPrefix('api/v1');

    // CORS
    app.enableCors({
        origin: [
            process.env.FRONTEND_URL || 'http://localhost:3000',
            'http://localhost:3000',
        ],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Upload-Token'],
    });

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        }),
    );

    // Global filters & interceptors
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());

    // Swagger API docs
    const swaggerConfig = new DocumentBuilder()
        .setTitle('StreamVault API')
        .setDescription('Production-grade OTT video streaming platform API')
        .setVersion('1.0')
        .addBearerAuth()
        .addTag('auth', 'Authentication endpoints')
        .addTag('videos', 'Video management')
        .addTag('upload', 'File upload (TUS protocol)')
        .addTag('streaming', 'HLS streaming endpoints')
        .addTag('live', 'Live streaming management')
        .addTag('channels', 'Creator channels')
        .addTag('comments', 'Video comments')
        .addTag('subscriptions', 'Channel subscriptions')
        .addTag('search', 'Full-text search')
        .addTag('analytics', 'Video analytics')
        .addTag('payments', 'Stripe payments')
        .addTag('recommendations', 'Personalized recommendations')
        .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
        swaggerOptions: { persistAuthorization: true },
    });

    const port = process.env.PORT || 8000;
    await app.listen(port);
    logger.log(`🚀 StreamVault API running on http://localhost:${port}`);
    logger.log(`📖 Swagger docs at http://localhost:${port}/api/docs`);
}

bootstrap();
