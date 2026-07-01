import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { VideoCard } from '@/components/feed/VideoCard';
import { VideoGrid } from '@/components/feed/VideoGrid';
import { Bell } from 'lucide-react';

async function getSubscriptionFeed(token: string, page = 1) {
    try {
        const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/subscriptions/feed?page=${page}&limit=24`,
            {
                headers: { Authorization: `Bearer ${token}` },
                cache: 'no-store',
            },
        );
        if (!res.ok) return { videos: [], total: 0 };
        const data = await res.json();
        return data.data || { videos: [], total: 0 };
    } catch { return { videos: [], total: 0 }; }
}

export default async function SubscriptionsPage() {
    const session = await getServerSession();
    if (!session) redirect('/login');

    const feed = await getSubscriptionFeed((session as any)?.accessToken || '');

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center gap-3 mb-8">
                <Bell className="w-6 h-6 text-white" />
                <h1 className="text-xl font-bold text-white">Subscriptions</h1>
            </div>

            {feed.videos.length === 0 ? (
                <div className="text-center py-24">
                    <Bell className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                    <h2 className="text-white text-xl font-semibold mb-2">No new videos</h2>
                    <p className="text-gray-500 text-sm max-w-sm mx-auto">
                        Subscribe to channels to see their latest videos here.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {feed.videos.map((video: any) => (
                        <VideoCard key={video.id} video={video} />
                    ))}
                </div>
            )}
        </div>
    );
}
