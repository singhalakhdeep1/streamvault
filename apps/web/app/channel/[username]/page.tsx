import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { VideoCard } from '@/components/feed/VideoCard';
import { Users, Video, CheckCircle } from 'lucide-react';

async function getChannel(username: string) {
    try {
        const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/channels/${username}`,
            { next: { revalidate: 60 } },
        );
        if (!res.ok) return null;
        const data = await res.json();
        return data.data;
    } catch { return null; }
}

async function getChannelVideos(handle: string, page = 1) {
    try {
        const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/channels/${handle}/videos?page=${page}&limit=24`,
            { next: { revalidate: 120 } },
        );
        if (!res.ok) return { videos: [], total: 0 };
        const data = await res.json();
        return data.data || { videos: [], total: 0 };
    } catch { return { videos: [], total: 0 }; }
}

export async function generateMetadata({ params }: { params: { username: string } }) {
    const channel = await getChannel(params.username);
    return {
        title: channel ? `${channel.name} — StreamVault` : 'Channel',
        description: channel?.description,
    };
}

export default async function ChannelPage({ params }: { params: { username: string } }) {
    const [channel, videosData] = await Promise.all([
        getChannel(params.username),
        getChannelVideos(params.username),
    ]);

    if (!channel) notFound();

    const formatCount = (n: number) =>
        n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` :
            n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n);

    return (
        <div className="max-w-6xl mx-auto">
            {/* Banner */}
            <div className="relative w-full h-36 md:h-52 bg-gradient-to-r from-gray-900 to-gray-800 rounded-b-xl overflow-hidden">
                {channel.bannerUrl && (
                    <Image src={channel.bannerUrl} alt="Channel banner" fill className="object-cover" />
                )}
            </div>

            {/* Channel header */}
            <div className="px-4 md:px-6 -mt-10 mb-6">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
                    <div className="relative w-24 h-24 rounded-full border-4 border-[#0f0f0f] overflow-hidden flex-shrink-0">
                        {channel.avatarUrl ? (
                            <Image src={channel.avatarUrl} alt={channel.name} fill className="object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center text-white text-3xl font-bold">
                                {channel.name[0]}
                            </div>
                        )}
                    </div>

                    <div className="flex-1 mt-2 sm:mt-0">
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-white">{channel.name}</h1>
                            {channel.user?.isVerified && (
                                <CheckCircle className="w-5 h-5 text-blue-400 fill-blue-400" />
                            )}
                        </div>
                        <p className="text-gray-400 text-sm mt-1">@{channel.handle}</p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                            <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {formatCount(channel.subscriberCount || 0)} subscribers
                            </span>
                            <span className="flex items-center gap-1">
                                <Video className="w-4 h-4" />
                                {channel._count?.videos || 0} videos
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-3 mt-2 sm:mt-0">
                        <button className="bg-white text-black hover:bg-gray-200 text-sm px-5 py-2 rounded-full font-medium transition-colors">
                            Subscribe
                        </button>
                    </div>
                </div>

                {channel.description && (
                    <p className="mt-4 text-gray-400 text-sm max-w-2xl line-clamp-3">
                        {channel.description}
                    </p>
                )}
            </div>

            {/* Videos grid */}
            <div className="px-4 md:px-6">
                <h2 className="text-white font-semibold mb-4">Videos</h2>
                {videosData.videos.length === 0 ? (
                    <div className="text-center py-20 text-gray-600">
                        <Video className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>No videos yet</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {videosData.videos.map((video: any) => (
                            <VideoCard
                                key={video.id}
                                video={{ ...video, channel }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
