'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { socket } from '@/lib/socket';
import { formatTimeAgo } from '@/lib/format';
import { Send, Heart, Users } from 'lucide-react';

interface ChatMessage {
    id: string;
    userId: string;
    displayName: string;
    avatarInitial: string;
    text: string;
    timestamp: string;
    type: 'chat' | 'donation' | 'system';
    donationAmount?: number;
}

interface Props {
    streamId: string;
    initialViewerCount?: number;
}

export function LiveChat({ streamId, initialViewerCount = 0 }: Props) {
    const { data: session } = useSession();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [text, setText] = useState('');
    const [viewerCount, setViewerCount] = useState(initialViewerCount);
    const [isConnected, setIsConnected] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [donationAmount, setDonationAmount] = useState('');
    const [showDonation, setShowDonation] = useState(false);

    useEffect(() => {
        socket.connect();

        socket.emit('join-stream', { streamId, token: (session as any)?.accessToken });

        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => setIsConnected(false));

        socket.on('chat-message', (msg: ChatMessage) => {
            setMessages((prev) => [...prev.slice(-199), msg]); // Keep last 200
        });

        socket.on('viewer-count', (count: number) => setViewerCount(count));

        socket.on('stream-ended', () => {
            setMessages((prev) => [
                ...prev,
                {
                    id: 'end',
                    userId: 'system',
                    displayName: 'System',
                    avatarInitial: 'S',
                    text: 'Stream has ended.',
                    timestamp: new Date().toISOString(),
                    type: 'system',
                },
            ]);
        });

        return () => {
            socket.emit('leave-stream', { streamId });
            socket.off('chat-message');
            socket.off('viewer-count');
            socket.off('stream-ended');
            socket.disconnect();
        };
    }, [streamId, session]);

    useEffect(() => {
        if (autoScroll) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, autoScroll]);

    function sendMessage(e: React.FormEvent) {
        e.preventDefault();
        if (!text.trim() || !session) return;
        socket.emit('chat-message', { streamId, text: text.trim() });
        setText('');
    }

    function sendDonation(e: React.FormEvent) {
        e.preventDefault();
        const amount = parseFloat(donationAmount);
        if (!amount || !session) return;
        socket.emit('donation', { streamId, amount, message: text });
        setText('');
        setDonationAmount('');
        setShowDonation(false);
    }

    return (
        <div className="flex flex-col h-full bg-[#0f0f0f] border border-gray-800 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <span className="text-white font-medium text-sm">Live Chat</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                    <Users className="w-4 h-4" />
                    <span>{viewerCount.toLocaleString()}</span>
                </div>
            </div>

            {/* Messages */}
            <div
                className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5"
                onScroll={(e) => {
                    const el = e.currentTarget;
                    setAutoScroll(el.scrollTop + el.clientHeight >= el.scrollHeight - 50);
                }}
            >
                {messages.length === 0 && (
                    <p className="text-center text-gray-600 text-sm mt-8">
                        Chat will appear here once the stream starts
                    </p>
                )}

                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`flex gap-2 items-start text-sm ${msg.type === 'donation'
                                ? 'bg-yellow-500/10 rounded p-1.5 border border-yellow-500/30'
                                : msg.type === 'system'
                                    ? 'justify-center'
                                    : ''
                            }`}
                    >
                        {msg.type === 'system' ? (
                            <span className="text-gray-500 text-xs italic">{msg.text}</span>
                        ) : (
                            <>
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex-shrink-0 flex items-center justify-center text-white text-xs font-bold mt-0.5">
                                    {msg.avatarInitial}
                                </div>
                                <div className="min-w-0">
                                    <span className="font-medium text-blue-400 text-xs mr-1">
                                        {msg.displayName}
                                    </span>
                                    {msg.type === 'donation' && (
                                        <span className="text-yellow-400 text-xs font-bold mr-1">
                                            <Heart className="w-3 h-3 inline" /> ₹{msg.donationAmount}
                                        </span>
                                    )}
                                    <span className="text-gray-200 break-words">{msg.text}</span>
                                </div>
                            </>
                        )}
                    </div>
                ))}

                {!autoScroll && (
                    <button
                        onClick={() => {
                            setAutoScroll(true);
                            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="sticky bottom-0 w-full text-center text-xs text-blue-400 bg-black/80 py-1 rounded"
                    >
                        ↓ New messages
                    </button>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-3 pb-3 pt-2 border-t border-gray-800">
                {showDonation ? (
                    <form onSubmit={sendDonation} className="space-y-2">
                        <input
                            type="number"
                            min="10"
                            value={donationAmount}
                            onChange={(e) => setDonationAmount(e.target.value)}
                            placeholder="Amount (₹)"
                            className="w-full bg-gray-900 text-white text-sm rounded px-3 py-2 outline-none border border-yellow-500/50"
                        />
                        <input
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Message (optional)"
                            className="w-full bg-gray-900 text-white text-sm rounded px-3 py-2 outline-none border border-gray-700"
                        />
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setShowDonation(false)}
                                className="flex-1 text-xs text-gray-400 border border-gray-700 rounded py-1.5"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="flex-1 text-xs bg-yellow-500 text-black font-bold rounded py-1.5"
                            >
                                Send ₹{donationAmount || '0'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <form onSubmit={sendMessage} className="flex gap-2">
                        <input
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder={session ? 'Send a message...' : 'Sign in to chat'}
                            disabled={!session}
                            maxLength={200}
                            className="flex-1 bg-gray-900 text-white text-sm rounded-full px-4 py-2 outline-none border border-gray-700 focus:border-gray-500 disabled:opacity-50"
                        />
                        <button
                            type="button"
                            onClick={() => setShowDonation(true)}
                            title="Send donation"
                            className="w-9 h-9 rounded-full bg-yellow-500/10 text-yellow-400 flex items-center justify-center hover:bg-yellow-500/20 transition-colors"
                        >
                            <Heart className="w-4 h-4" />
                        </button>
                        <button
                            type="submit"
                            disabled={!text.trim() || !session}
                            className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-500 disabled:opacity-40 transition-colors"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
