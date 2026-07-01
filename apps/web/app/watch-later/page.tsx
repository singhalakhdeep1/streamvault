import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { VideoCard } from '@/components/feed/VideoCard';
import { Clock } from 'lucide-react';

async function getWatchLater(token: string) {
    try {
        const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/users/me/watch-later?limit=48`,
            { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
        );
        if (!res.ok) return [];
        const data = await res.json();
        return data.data || [];
    } catch { return []; }
}

export default async function WatchLaterPage() {
    const session = await getServerSession();
    if (!session) redirect('/login');

    const videos = await getWatchLater((session as any)?.accessToken || '');

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center gap-3 mb-8">
                <Clock className="w-6 h-6 text-white" />
                <h1 className="text-xl font-bold text-white">Watch Later</h1>
            </div>

            {videos.length === 0 ? (
                <div className="text-center py-16">
                    <Clock className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                    <p className="text-gray-500">Your Watch Later list is empty.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {videos.map((item: any) => (
                        <VideoCard key={item.video?.id || item.id} video={item.video || item} />
                    ))}
                </div>
            )}
        </div>
    );
}
