import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { Eye, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatViewCount, formatDuration } from '@/lib/format';

interface VideoCardProps {
    video: {
        id: string;
        title: string;
        duration?: number;
        viewCount: number;
        publishedAt: string;
        thumbnails?: Array<{ url: string }>;
        channel: {
            handle: string;
            name: string;
            avatarUrl?: string;
        };
    };
    variant?: 'grid' | 'list' | 'compact';
}

export function VideoCard({ video, variant = 'grid' }: VideoCardProps) {
    const thumbnail = video.thumbnails?.[0]?.url;
    const isGrid = variant === 'grid';

    if (variant === 'list') {
        return (
            <Link href={`/watch/${video.id}`} className="flex gap-3 group">
                {/* Thumbnail */}
                <div className="relative flex-shrink-0 w-40 aspect-video rounded-lg overflow-hidden bg-zinc-800">
                    {thumbnail ? (
                        <Image src={thumbnail} alt={video.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                            <Eye className="w-6 h-6 text-zinc-600" />
                        </div>
                    )}
                    {video.duration && (
                        <span className="absolute bottom-1 right-1 bg-black/90 text-white text-xs px-1 rounded">
                            {formatDuration(video.duration)}
                        </span>
                    )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 py-1">
                    <h3 className="font-medium text-zinc-100 line-clamp-2 group-hover:text-red-400 transition-colors">
                        {video.title}
                    </h3>
                    <Link
                        href={`/channel/${video.channel.handle.replace('@', '')}`}
                        className="text-sm text-zinc-400 hover:text-zinc-200 mt-1 block"
                        onClick={e => e.stopPropagation()}
                    >
                        {video.channel.name}
                    </Link>
                    <div className="flex items-center gap-1 text-xs text-zinc-500 mt-1">
                        <span>{formatViewCount(video.viewCount)} views</span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true })}</span>
                    </div>
                </div>
            </Link>
        );
    }

    return (
        <article className="group cursor-pointer">
            <Link href={`/watch/${video.id}`}>
                {/* Thumbnail */}
                <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-800 mb-3">
                    {thumbnail ? (
                        <Image
                            src={thumbnail}
                            alt={video.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                    ) : (
                        <div className="w-full h-full bg-zinc-800" />
                    )}
                    {video.duration && (
                        <span className="absolute bottom-2 right-2 bg-black/90 text-white text-xs font-medium px-1.5 py-0.5 rounded">
                            {formatDuration(video.duration)}
                        </span>
                    )}
                </div>

                {/* Info row */}
                <div className="flex gap-3">
                    {/* Channel avatar */}
                    <Link href={`/channel/${video.channel.handle.replace('@', '')}`} onClick={e => e.stopPropagation()}>
                        <div className="w-9 h-9 rounded-full bg-zinc-700 flex-shrink-0 overflow-hidden">
                            {video.channel.avatarUrl && (
                                <Image src={video.channel.avatarUrl} alt={video.channel.name} width={36} height={36} className="object-cover" />
                            )}
                        </div>
                    </Link>

                    <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-zinc-100 line-clamp-2 text-sm leading-snug group-hover:text-red-400 transition-colors">
                            {video.title}
                        </h3>
                        <Link
                            href={`/channel/${video.channel.handle.replace('@', '')}`}
                            className="text-xs text-zinc-400 hover:text-zinc-200 mt-0.5 block"
                            onClick={e => e.stopPropagation()}
                        >
                            {video.channel.name}
                        </Link>
                        <div className="flex items-center gap-1 text-xs text-zinc-500 mt-0.5">
                            <span>{formatViewCount(video.viewCount)} views</span>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(video.publishedAt), { addSuffix: true })}</span>
                        </div>
                    </div>
                </div>
            </Link>
        </article>
    );
}
