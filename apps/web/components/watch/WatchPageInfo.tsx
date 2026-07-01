'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Share2, Download, Flag, MoreHorizontal, Bell } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { formatViewCount } from '@/lib/format';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import toast from 'react-hot-toast';

interface WatchPageInfoProps {
    video: any;
}

export function WatchPageInfo({ video }: WatchPageInfoProps) {
    const { user } = useAuthStore();
    const [liked, setLiked] = useState(video.userLiked || false);
    const [likeCount, setLikeCount] = useState(video._count?.likes || 0);
    const [subscribed, setSubscribed] = useState(video.channel?.userSubscribed || false);
    const [subCount, setSubCount] = useState(video.channel?._count?.subscribers || 0);
    const [showFullDesc, setShowFullDesc] = useState(false);

    const handleLike = async () => {
        if (!user) { toast.error('Sign in to like videos'); return; }
        try {
            await api.post(`/videos/${video.id}/like`);
            setLiked(true);
            setLikeCount((c: number) => c + 1);
        } catch { }
    };

    const handleDislike = async () => {
        if (!user) { toast.error('Sign in to rate videos'); return; }
        try {
            await api.post(`/videos/${video.id}/dislike`);
            setLiked(false);
            setLikeCount((c: number) => Math.max(0, c - 1));
        } catch { }
    };

    const handleSubscribe = async () => {
        if (!user) { toast.error('Sign in to subscribe'); return; }
        try {
            if (subscribed) {
                await api.delete(`/subscriptions/${video.channel.id}`);
                setSubscribed(false);
                setSubCount((c: number) => Math.max(0, c - 1));
            } else {
                await api.post(`/subscriptions/${video.channel.id}`);
                setSubscribed(true);
                setSubCount((c: number) => c + 1);
                toast.success(`Subscribed to ${video.channel.name}`);
            }
        } catch { }
    };

    const handleShare = async () => {
        const url = window.location.href;
        try {
            await navigator.clipboard.writeText(url);
            toast.success('Link copied!');
        } catch {
            // Fallback for no clipboard API
            prompt('Copy this link:', url);
        }
    };

    return (
        <div className="space-y-4">
            {/* Title */}
            <h1 className="text-xl font-bold text-zinc-100 leading-snug">{video.title}</h1>

            {/* Meta + actions row */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Channel info */}
                <div className="flex items-center gap-3">
                    <Link href={`/channel/${video.channel?.handle?.replace('@', '')}`}>
                        <div className="w-10 h-10 rounded-full bg-zinc-700 overflow-hidden">
                            {video.channel?.avatarUrl && (
                                <Image src={video.channel.avatarUrl} alt={video.channel.name} width={40} height={40} className="object-cover" />
                            )}
                        </div>
                    </Link>
                    <div>
                        <Link href={`/channel/${video.channel?.handle?.replace('@', '')}`} className="font-semibold text-zinc-100 hover:text-red-400 transition-colors text-sm">
                            {video.channel?.name}
                        </Link>
                        <p className="text-xs text-zinc-500">{formatViewCount(subCount)} subscribers</p>
                    </div>
                    <button
                        onClick={handleSubscribe}
                        className={`ml-2 px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${subscribed
                                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                                : 'bg-white hover:bg-zinc-100 text-black'
                            }`}
                    >
                        {subscribed ? (
                            <span className="flex items-center gap-1.5"><Bell className="w-3.5 h-3.5" />Subscribed</span>
                        ) : (
                            'Subscribe'
                        )}
                    </button>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-zinc-800 rounded-full overflow-hidden">
                        <button
                            onClick={handleLike}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium hover:bg-zinc-700 transition-colors ${liked ? 'text-red-400' : 'text-zinc-300'}`}
                        >
                            <ThumbsUp className="w-4 h-4" />
                            {formatViewCount(likeCount)}
                        </button>
                        <div className="w-px h-5 bg-zinc-700" />
                        <button onClick={handleDislike} className="px-3 py-2 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors">
                            <ThumbsDown className="w-4 h-4" />
                        </button>
                    </div>

                    <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-full text-sm font-medium text-zinc-300 transition-colors">
                        <Share2 className="w-4 h-4" /> Share
                    </button>

                    <button className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-full text-zinc-400 transition-colors">
                        <MoreHorizontal className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Description */}
            <div className="bg-zinc-900 rounded-xl p-4">
                <div className="flex items-center gap-3 text-sm text-zinc-400 mb-3">
                    <span className="font-semibold text-zinc-300">{formatViewCount(video.viewCount)} views</span>
                    <span>{formatDistanceToNow(new Date(video.publishedAt || Date.now()), { addSuffix: true })}</span>
                    {video.tags?.map((tag: string) => (
                        <Link key={tag} href={`/search?q=${tag}`} className="text-blue-400 hover:text-blue-300">
                            #{tag}
                        </Link>
                    ))}
                </div>

                <div className={`text-sm text-zinc-300 whitespace-pre-wrap ${!showFullDesc ? 'line-clamp-3' : ''}`}>
                    {video.description || 'No description provided.'}
                </div>

                {video.description?.length > 200 && (
                    <button
                        onClick={() => setShowFullDesc(!showFullDesc)}
                        className="text-sm text-zinc-400 hover:text-zinc-200 mt-2 font-medium"
                    >
                        {showFullDesc ? 'Show less' : 'Show more'}
                    </button>
                )}
            </div>
        </div>
    );
}
