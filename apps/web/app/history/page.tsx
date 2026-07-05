'use client';

import { useEffect, useState } from 'react';
import { VideoCard } from '@/components/feed/VideoCard';
import { History } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { api } from '@/lib/api';

export default function HistoryPage() {
  const { isAuthenticated, status } = useAuth(true);
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void api.get('/users/me/history?limit=48').then((res) => {
      setItems(res.data.data?.items ?? []);
    });
  }, [isAuthenticated]);

  if (status === 'unauthenticated' || !isAuthenticated) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-8">
        <History className="w-6 h-6 text-white" />
        <h1 className="text-xl font-bold text-white">Watch History</h1>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16">
          <History className="w-16 h-16 text-gray-700 mx-auto mb-4" />
          <p className="text-gray-500">No watch history yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => (
            <VideoCard key={item.video?.id ?? item.id} video={item.video ?? item} />
          ))}
        </div>
      )}
    </div>
  );
}
