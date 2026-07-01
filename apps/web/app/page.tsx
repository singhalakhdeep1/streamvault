import { Suspense } from 'react';
import { VideoGrid } from '@/components/feed/VideoGrid';
import { TrendingSection } from '@/components/feed/TrendingSection';
import { CategoryFilter } from '@/components/feed/CategoryFilter';
import { LiveBanner } from '@/components/live/LiveBanner';

export const dynamic = 'force-dynamic';

export default async function HomePage({
    searchParams,
}: {
    searchParams: { category?: string; sort?: string };
}) {
    return (
        <div className="px-4 py-6 space-y-8 max-w-[1800px] mx-auto">
            {/* Live now banner */}
            <Suspense fallback={null}>
                <LiveBanner />
            </Suspense>

            {/* Category filter tabs */}
            <CategoryFilter activeCategory={searchParams.category} />

            {/* Trending section */}
            {!searchParams.category && (
                <section>
                    <h2 className="text-lg font-semibold mb-4 text-zinc-100">🔥 Trending</h2>
                    <Suspense fallback={<VideoGridSkeleton count={4} />}>
                        <TrendingSection />
                    </Suspense>
                </section>
            )}

            {/* Main video feed */}
            <section>
                <h2 className="text-lg font-semibold mb-4 text-zinc-100">
                    {searchParams.category ? 'Videos' : 'Recommended'}
                </h2>
                <Suspense fallback={<VideoGridSkeleton count={12} />}>
                    <VideoGrid category={searchParams.category} sort={searchParams.sort} />
                </Suspense>
            </section>
        </div>
    );
}

function VideoGridSkeleton({ count }: { count: number }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="animate-pulse">
                    <div className="bg-zinc-800 aspect-video rounded-xl mb-3" />
                    <div className="flex gap-3">
                        <div className="w-9 h-9 bg-zinc-800 rounded-full flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 bg-zinc-800 rounded w-full" />
                            <div className="h-3 bg-zinc-800 rounded w-2/3" />
                            <div className="h-3 bg-zinc-800 rounded w-1/2" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
