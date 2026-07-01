'use client';

import { useQuery } from '@tanstack/react-query';
import { VideoCard } from './VideoCard';
import { api } from '@/lib/api';

interface VideoGridProps {
    category?: string;
    sort?: string;
    channelId?: string;
    searchQuery?: string;
}

export function VideoGrid({ category, sort, channelId, searchQuery }: VideoGridProps) {
    const { data, isLoading, error } = useQuery({
        queryKey: ['videos', { category, sort, channelId, searchQuery }],
        queryFn: () =>
            api.get('/videos', {
                params: { category, sort: sort || 'latest', channelId, search: searchQuery, limit: 24 },
            }).then(r => r.data.data),
        staleTime: 60_000,
    });

    if (isLoading) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                        <div className="bg-zinc-800 aspect-video rounded-xl mb-3" />
                        <div className="flex gap-3">
                            <div className="w-9 h-9 bg-zinc-800 rounded-full" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-zinc-800 rounded" />
                                <div className="h-3 bg-zinc-800 rounded w-2/3" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center py-16 text-zinc-500">
                Failed to load videos. Please try again.
            </div>
        );
    }

    if (!data?.videos?.length) {
        return (
            <div className="text-center py-16 text-zinc-500">
                No videos found.
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {data.videos.map((video: any) => (
                <VideoCard key={video.id} video={video} />
            ))}
        </div>
    );
}
