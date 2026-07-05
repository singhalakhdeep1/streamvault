'use client';

import { useEffect, useState } from 'react';
import { VideoCard } from '@/components/feed/VideoCard';
import { ThumbsUp } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

export default function LikedPage() {
  const { isAuthenticated, status } = useAuth(true);
  const [videos, setVideos] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void api.get('/videos/liked?limit=48').then((res) => {
      setVideos(res.data.data?.videos ?? []);
    });
  }, [isAuthenticated]);

  if (status === 'unauthenticated' || !isAuthenticated) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-8">
        <ThumbsUp className="w-6 h-6 text-white" />
        <h1 className="text-xl font-bold text-white">Liked Videos</h1>
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-16">
          <ThumbsUp className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500">No liked videos yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      )}
    </div>
  );
}
