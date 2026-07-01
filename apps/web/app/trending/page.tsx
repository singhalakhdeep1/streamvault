import { VideoCard } from '@/components/feed/VideoCard';
import { Flame } from 'lucide-react';

async function getTrending() {
    try {
        const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/recommendations/trending?limit=48`,
            { next: { revalidate: 300 } },
        );
        if (!res.ok) return [];
        const data = await res.json();
        return data.data || [];
    } catch { return []; }
}

export default async function TrendingPage() {
    const videos = await getTrending();

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center gap-3 mb-8">
                <Flame className="w-6 h-6 text-red-500" />
                <h1 className="text-xl font-bold text-white">Trending</h1>
            </div>

            {videos.length === 0 ? (
                <p className="text-gray-500 text-center py-16">No trending videos right now.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {videos.map((video: any) => (
                        <VideoCard key={video.id} video={video} />
                    ))}
                </div>
            )}
        </div>
    );
}
