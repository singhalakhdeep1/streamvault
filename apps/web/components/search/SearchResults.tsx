import { VideoCard } from '@/components/feed/VideoCard';
import Image from 'next/image';
import Link from 'next/link';
import { Users } from 'lucide-react';

interface Props {
    results: { videos?: any[]; channels?: any[]; total: number };
    type: string;
}

export function SearchResults({ results, type }: Props) {
    return (
        <div className="space-y-8">
            {/* Channels */}
            {(type === 'all' || type === 'channels') && results.channels && results.channels.length > 0 && (
                <section>
                    {type === 'all' && <h2 className="text-white font-semibold mb-4">Channels</h2>}
                    <div className="space-y-4">
                        {results.channels.map((ch: any) => (
                            <Link
                                key={ch.id}
                                href={`/channel/${ch.handle}`}
                                className="flex items-center gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors"
                            >
                                {ch.avatarUrl ? (
                                    <Image src={ch.avatarUrl} alt={ch.name} width={64} height={64}
                                        className="rounded-full object-cover" />
                                ) : (
                                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center text-white text-xl font-bold">
                                        {ch.name[0]}
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-white font-medium">{ch.name}</h3>
                                    <p className="text-gray-400 text-sm">@{ch.handle}</p>
                                    <div className="flex items-center gap-1 text-gray-500 text-xs mt-1">
                                        <Users className="w-3.5 h-3.5" />
                                        <span>{ch.subscriberCount?.toLocaleString()} subscribers</span>
                                    </div>
                                </div>
                                <button className="ml-auto border border-white text-white text-sm px-4 py-1.5 rounded-full hover:bg-white hover:text-black transition-colors">
                                    Subscribe
                                </button>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Videos */}
            {(type === 'all' || type === 'videos') && results.videos && results.videos.length > 0 && (
                <section>
                    {type === 'all' && <h2 className="text-white font-semibold mb-4">Videos</h2>}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {results.videos.map((video: any) => (
                            <VideoCard key={video.id} video={video} />
                        ))}
                    </div>
                </section>
            )}

            {(results.videos?.length === 0 && results.channels?.length === 0) && (
                <div className="text-center py-16 text-gray-600">
                    <p>No results found</p>
                    <p className="text-sm mt-2">Try different keywords</p>
                </div>
            )}
        </div>
    );
}
