import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { LiveChat } from '@/components/live/LiveChat';
import { Eye, Radio } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

async function getStream(streamId: string) {
    try {
        const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/live/streams/${streamId}`,
            { cache: 'no-store' },
        );
        if (!res.ok) return null;
        const data = await res.json();
        return data.data;
    } catch {
        return null;
    }
}

export async function generateMetadata({ params }: { params: { streamId: string } }) {
    const stream = await getStream(params.streamId);
    return {
        title: stream ? `🔴 ${stream.title} — StreamVault Live` : 'Live Stream',
    };
}

export default async function LivePage({ params }: { params: { streamId: string } }) {
    const stream = await getStream(params.streamId);

    if (!stream) notFound();

    const hlsUrl = stream.hlsPlaylistUrl || '';

    return (
        <div className="max-w-[1800px] mx-auto px-4 py-6">
            <div className="flex gap-6 flex-col xl:flex-row">
                {/* Main content */}
                <div className="flex-1 min-w-0">
                    {/* Live Player */}
                    <div className="relative">
                        <VideoPlayer src={hlsUrl} autoPlay title={stream.title} />
                        <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-live" />
                            LIVE
                        </div>
                    </div>

                    {/* Stream info */}
                    <div className="mt-4">
                        <h1 className="text-xl font-bold text-white">{stream.title}</h1>

                        <div className="flex items-center gap-4 mt-3 flex-wrap">
                            <Link
                                href={`/channel/${stream.channel?.handle}`}
                                className="flex items-center gap-2.5 group"
                            >
                                {stream.channel?.avatarUrl ? (
                                    <Image
                                        src={stream.channel.avatarUrl}
                                        alt={stream.channel.name}
                                        width={40} height={40}
                                        className="rounded-full"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center text-white font-bold">
                                        {stream.channel?.name?.[0]}
                                    </div>
                                )}
                                <div>
                                    <p className="text-white font-medium group-hover:text-red-400 text-sm">
                                        {stream.channel?.name}
                                    </p>
                                    <p className="text-gray-500 text-xs">
                                        {stream.channel?.subscriberCount?.toLocaleString()} subscribers
                                    </p>
                                </div>
                            </Link>

                            <button className="ml-auto bg-red-600 hover:bg-red-500 text-white text-sm px-5 py-2 rounded-full font-medium transition-colors">
                                Subscribe
                            </button>

                            <div className="flex items-center gap-1.5 text-gray-400 text-sm">
                                <Eye className="w-4 h-4" />
                                <span>{stream.viewerCount?.toLocaleString() || 0} watching</span>
                            </div>
                        </div>

                        {stream.description && (
                            <p className="mt-4 text-gray-400 text-sm whitespace-pre-wrap border-t border-gray-800 pt-4">
                                {stream.description}
                            </p>
                        )}
                    </div>
                </div>

                {/* Live chat sidebar */}
                <div className="w-full xl:w-[360px] xl:h-[calc(100vh-120px)] flex-shrink-0">
                    <LiveChat streamId={params.streamId} initialViewerCount={stream.viewerCount} />
                </div>
            </div>
        </div>
    );
}
