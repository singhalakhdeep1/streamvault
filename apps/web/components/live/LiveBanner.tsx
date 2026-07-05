'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Radio } from 'lucide-react';
import { api } from '@/lib/api';

export function LiveBanner() {
  const { data } = useQuery({
    queryKey: ['live', 'active'],
    queryFn: () => api.get('/live/streams').then((r) => r.data.data).catch(() => []),
    staleTime: 30_000,
    retry: false,
  });

  const streams = Array.isArray(data) ? data : data?.streams ?? [];
  if (streams.length === 0) return null;

  const stream = streams[0];

  return (
    <Link
      href={`/live/${stream.id}`}
      className="flex items-center gap-4 rounded-xl border border-red-900/50 bg-gradient-to-r from-red-950/80 to-zinc-900 p-4 hover:border-red-700 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
        <Radio className="w-5 h-5 text-red-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-red-400 uppercase tracking-wide">Live Now</p>
        <p className="text-zinc-100 font-medium truncate">{stream.title}</p>
        <p className="text-zinc-400 text-sm truncate">{stream.channel?.name ?? 'Creator'}</p>
      </div>
      <span className="text-zinc-400 text-sm flex-shrink-0">
        {stream.viewerCount ?? 0} watching
      </span>
    </Link>
  );
}
