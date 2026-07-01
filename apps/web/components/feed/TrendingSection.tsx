'use client';

import { useQuery } from '@tanstack/react-query';
import { VideoCard } from './VideoCard';
import { api } from '@/lib/api';

export function TrendingSection() {
    const { data } = useQuery({
        queryKey: ['videos', 'trending'],
        queryFn: () =>
            api.get('/videos', { params: { sort: 'trending', limit: 6 } }).then(r => r.data.data),
        staleTime: 5 * 60_000,
    });

    if (!data?.videos?.length) return null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {data.videos.slice(0, 6).map((video: any) => (
                <VideoCard key={video.id} video={video} variant="grid" />
            ))}
        </div>
    );
}
