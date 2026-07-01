import {
    WebSocketGateway, WebSocketServer, SubscribeMessage,
    ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger } from '@nestjs/common';
import { LiveService } from './live.service';

@WebSocketGateway({
    namespace: '/live',
    cors: { origin: '*', credentials: true },
    transports: ['websocket', 'polling'],
})
export class LiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer() server: Server;
    private readonly logger = new Logger(LiveGateway.name);

    // Track: socketId → { livestreamId, userId }
    private viewers = new Map<string, { livestreamId: string; userId?: string }>();

    constructor(private liveService: LiveService) { }

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);
    }

    async handleDisconnect(client: Socket) {
        const session = this.viewers.get(client.id);
        if (session) {
            await this.liveService.leaveStream(session.livestreamId, session.userId);
            client.leave(`stream:${session.livestreamId}`);
            this.viewers.delete(client.id);
        }
    }

    @SubscribeMessage('join-stream')
    async handleJoinStream(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { livestreamId: string; userId?: string },
    ) {
        const { livestreamId, userId } = data;

        // Leave any previous stream
        const prev = this.viewers.get(client.id);
        if (prev) {
            await this.liveService.leaveStream(prev.livestreamId, prev.userId);
            client.leave(`stream:${prev.livestreamId}`);
        }

        // Join stream room
        client.join(`stream:${livestreamId}`);
        this.viewers.set(client.id, { livestreamId, userId });

        const result = await this.liveService.joinStream(livestreamId, userId);

        // Send stream info + chat history back to joining client
        const [streamInfo, chatHistory] = await Promise.all([
            this.liveService.getLivestreamById(livestreamId).catch(() => null),
            this.liveService.getChatHistory(livestreamId),
        ]);

        client.emit('stream-info', streamInfo);
        client.emit('chat-history', chatHistory.reverse());

        return { joined: true, viewerCount: result.viewerCount };
    }

    @SubscribeMessage('leave-stream')
    async handleLeaveStream(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { livestreamId: string },
    ) {
        const session = this.viewers.get(client.id);
        if (!session || session.livestreamId !== data.livestreamId) return;

        await this.liveService.leaveStream(data.livestreamId, session.userId);
        client.leave(`stream:${data.livestreamId}`);
        this.viewers.delete(client.id);

        return { left: true };
    }

    @SubscribeMessage('send-chat')
    async handleChatMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { livestreamId: string; message: string; userId: string },
    ) {
        try {
            const chatMsg = await this.liveService.sendChatMessage(
                data.livestreamId,
                data.userId,
                data.message,
            );

            // Broadcast to all viewers in the stream room
            this.server.to(`stream:${data.livestreamId}`).emit('chat-message', chatMsg);
            return { sent: true };
        } catch (error) {
            client.emit('error', { message: error.message });
        }
    }

    // ─── Called by LiveService to broadcast events ────────────────────────
    broadcastViewerCount(livestreamId: string, count: number) {
        this.server.to(`stream:${livestreamId}`).emit('viewer-count', { count });
    }

    broadcastLiveStarted(stream: any) {
        this.server.emit('stream-started', {
            id: stream.id,
            channelId: stream.channelId,
            title: stream.title,
        });
    }

    broadcastLiveEnded(livestreamId: string) {
        this.server.to(`stream:${livestreamId}`).emit('stream-ended', { livestreamId });
    }
}
