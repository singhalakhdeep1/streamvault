import {
    WebSocketGateway, WebSocketServer, SubscribeMessage,
    OnGatewayConnection, OnGatewayDisconnect
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ namespace: '/notifications', cors: { origin: '*' } })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server!: Server;
    private readonly logger = new Logger(NotificationsGateway.name);
    private userSockets = new Map<string, Set<string>>();

    constructor(private readonly jwtService: JwtService) { }

    async handleConnection(client: Socket) {
        try {
            const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];
            if (!token) { client.disconnect(); return; }

            const payload = this.jwtService.verify(token);
            client.data.userId = payload.sub;

            if (!this.userSockets.has(payload.sub)) {
                this.userSockets.set(payload.sub, new Set());
            }
            this.userSockets.get(payload.sub)!.add(client.id);
            client.join(`user:${payload.sub}`);
            this.logger.debug(`User ${payload.sub} connected`);
        } catch {
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        const userId = client.data.userId;
        if (userId) {
            this.userSockets.get(userId)?.delete(client.id);
        }
    }

    pushToUser(userId: string, event: string, data: any) {
        this.server.to(`user:${userId}`).emit(event, data);
    }

    @SubscribeMessage('mark-read')
    handleMarkRead(client: Socket, notificationId: string) {
        this.logger.debug(`Mark read ${notificationId} for ${client.data.userId}`);
    }
}
