'use client';

import { useEffect, useState } from 'react';
import { VideoCard } from '@/components/feed/VideoCard';
import { Bell } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

export default function SubscriptionsPage() {
  const { isAuthenticated, status } = useAuth(true);
  const [videos, setVideos] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void api.get('/subscriptions/feed?page=1&limit=24').then((res) => {
      setVideos(res.data.data?.videos ?? []);
    });
  }, [isAuthenticated]);

  if (status === 'unauthenticated' || !isAuthenticated) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-8">
        <Bell className="w-6 h-6 text-white" />
        <h1 className="text-xl font-bold text-white">Subscriptions</h1>
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-24">
          <Bell className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <h2 className="text-white text-xl font-semibold mb-2">No new videos</h2>
          <p className="text-gray-500 text-sm max-w-sm mx-auto">
            Subscribe to channels to see their latest videos here.
          </p>
        </div>
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
