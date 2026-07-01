import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { VideoPlayer } from '@/components/player/VideoPlayer';
import { CommentSection } from '@/components/comments/CommentSection';
import { VideoCard } from '@/components/feed/VideoCard';
import { WatchPageInfo } from '@/components/watch/WatchPageInfo';

async function getVideo(id: string) {
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/videos/${id}`,
        { next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.data;
}

async function getRelated(id: string) {
    const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/videos?exclude=${id}&limit=12`,
        { next: { revalidate: 300 } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.data?.videos || [];
}

export async function generateMetadata({ params }: { params: { videoId: string } }) {
    const video = await getVideo(params.videoId);
    if (!video) return { title: 'Video not found' };

    return {
        title: video.title,
        description: video.description?.slice(0, 160),
        openGraph: {
            title: video.title,
            description: video.description?.slice(0, 160),
            images: video.thumbnails?.[0]?.url ? [video.thumbnails[0].url] : [],
            type: 'video.other',
        },
    };
}

export default async function WatchPage({ params }: { params: { videoId: string } }) {
    const video = await getVideo(params.videoId);

    if (!video || video.status !== 'READY') {
        notFound();
    }

    const [related] = await Promise.all([getRelated(params.videoId)]);

    // Build HLS master URL
    const hlsUrl = video.hlsMasterKey
        ? `${process.env.NEXT_PUBLIC_MINIO_URL || 'http://localhost:9000'}/streamvault-hls/${video.hlsMasterKey}`
        : '';

    return (
        <div className="max-w-[1800px] mx-auto px-4 py-6">
            <div className="flex gap-6">
                {/* Main content */}
                <div className="flex-1 min-w-0 space-y-4">
                    {/* Player */}
                    <VideoPlayer
                        videoId={video.id}
                        hlsUrl={hlsUrl}
                        posterUrl={video.thumbnails?.[0]?.url}
                        chapters={video.chapters}
                        subtitles={video.subtitles}
                    />

                    {/* Video info (title, channel, actions) */}
                    <WatchPageInfo video={video} />

                    {/* Comments */}
                    <Suspense fallback={<div className="h-40 animate-pulse bg-zinc-800 rounded-xl" />}>
                        <CommentSection videoId={params.videoId} commentCount={video._count?.comments || 0} />
                    </Suspense>
                </div>

                {/* Related videos sidebar */}
                <aside className="hidden xl:flex flex-col gap-3 w-[360px] flex-shrink-0">
                    <h3 className="font-semibold text-zinc-200">Up next</h3>
                    {related.map((v: any) => (
                        <VideoCard key={v.id} video={v} variant="list" />
                    ))}
                </aside>
            </div>
        </div>
    );
}
