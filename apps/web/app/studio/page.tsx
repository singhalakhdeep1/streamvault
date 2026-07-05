'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { formatDuration, formatTimeAgo, formatNumber } from '@/lib/format';
import {
  BarChart2, Video, Settings, DollarSign, Upload, Eye,
  ThumbsUp, MessageSquare, TrendingUp, Edit, Trash2, Globe, Lock, EyeOff,
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type Tab = 'dashboard' | 'videos' | 'analytics' | 'monetization' | 'settings';

export default function StudioPage() {
  const { isAuthenticated, status } = useAuth(true);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [videos, setVideos] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    void loadDashboard();
  }, [isAuthenticated]);

  async function loadDashboard() {
    setLoading(true);
    try {
      const [overviewRes, videosRes] = await Promise.all([
        api.get('/analytics/overview?period=30d').catch(() => ({ data: { data: {} } })),
        api.get('/videos/mine?page=1&limit=50'),
      ]);
      setStats(overviewRes.data.data);
      setVideos(videosRes.data.data?.videos ?? []);
      setChartData(overviewRes.data.data?.viewsTimeline ?? generateMockChartData());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function generateMockChartData() {
    return Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 86400000).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      views: Math.floor(Math.random() * 5000 + 500),
      watchTime: Math.floor(Math.random() * 200 + 50),
    }));
  }

  if (status === 'unauthenticated' || !isAuthenticated) return null;

  const TABS: Array<{ id: Tab; label: string; icon: typeof BarChart2 }> = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
    { id: 'videos', label: 'Videos', icon: Video },
    { id: 'analytics', label: 'Analytics', icon: TrendingUp },
    { id: 'monetization', label: 'Monetization', icon: DollarSign },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 border-r border-zinc-800 p-4 space-y-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
              tab === id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
        <Link
          href="/upload"
          className="mt-4 flex items-center gap-2 w-full px-3 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm text-white font-medium"
        >
          <Upload className="w-4 h-4" />
          Upload
        </Link>
      </aside>

      <main className="flex-1 p-6">
        {loading ? (
          <p className="text-zinc-500">Loading studio...</p>
        ) : tab === 'dashboard' ? (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-white">Creator Studio</h1>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Views', value: formatNumber(stats?.totalViews ?? 0), icon: Eye },
                { label: 'Subscribers', value: formatNumber(stats?.subscribers ?? 0), icon: ThumbsUp },
                { label: 'Videos', value: String(videos.length), icon: Video },
                { label: 'Comments', value: formatNumber(stats?.totalComments ?? 0), icon: MessageSquare },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                  <Icon className="w-5 h-5 text-zinc-500 mb-2" />
                  <p className="text-2xl font-bold text-white">{value}</p>
                  <p className="text-sm text-zinc-400">{label}</p>
                </div>
              ))}
            </div>
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a' }} />
                  <Area type="monotone" dataKey="views" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : tab === 'videos' ? (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-white">Your Videos</h1>
            {videos.length === 0 ? (
              <p className="text-zinc-500">No videos yet. <Link href="/upload" className="text-red-400 underline">Upload your first video</Link></p>
            ) : (
              <div className="space-y-3">
                {videos.map((v) => (
                  <div key={v.id} className="flex items-center gap-4 bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <div className="w-32 aspect-video bg-zinc-800 rounded-lg flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{v.title}</p>
                      <p className="text-sm text-zinc-400">{formatNumber(Number(v.viewCount))} views · {v.status}</p>
                    </div>
                    <Link href={`/watch/${v.id}`} className="text-sm text-zinc-400 hover:text-white">
                      <Edit className="w-4 h-4" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-zinc-500">Coming soon — {tab} tab</p>
        )}
      </main>
    </div>
  );
}
