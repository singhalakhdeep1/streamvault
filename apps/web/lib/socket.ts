import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
    if (!socket) {
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
        socket = io(process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8000', {
            auth: { token },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });
    }
    return socket;
}

export function getLiveSocket(streamId: string): Socket {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    return io(`${process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:8000'}/live`, {
        auth: { token },
        query: { streamId },
        transports: ['websocket'],
    });
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
