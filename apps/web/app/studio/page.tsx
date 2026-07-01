'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatDuration, formatTimeAgo, formatNumber } from '@/lib/format';
import {
    BarChart2, Video, Settings, DollarSign, Upload, Eye,
    ThumbsUp, MessageSquare, TrendingUp, Edit, Trash2, Globe, Lock, EyeOff
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import Image from 'next/image';

type Tab = 'dashboard' | 'videos' | 'analytics' | 'monetization' | 'settings';

export default function StudioPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [tab, setTab] = useState<Tab>('dashboard');
    const [stats, setStats] = useState<any>(null);
    const [videos, setVideos] = useState<any[]>([]);
    const [chartData, setChartData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
    }, [status, router]);

    useEffect(() => {
        if (!session) return;
        loadDashboard();
    }, [session]);

    async function loadDashboard() {
        setLoading(true);
        try {
            const [overviewData, videosData] = await Promise.all([
                api.get('/analytics/overview?period=30d'),
                api.get('/videos/mine?page=1&limit=50'),
            ]);
            setStats(overviewData);
            setVideos(videosData?.videos || []);
            setChartData(overviewData?.viewsTimeline || generateMockChartData());
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

    async function deleteVideo(videoId: string) {
        if (!confirm('Delete this video permanently?')) return;
        await api.delete(`/videos/${videoId}`);
        setVideos((prev) => prev.filter((v) => v.id !== videoId));
    }

    const TABS: { id: Tab; label: string; icon: any }[] = [
        { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
        { id: 'videos', label: 'Videos', icon: Video },
        { id: 'analytics', label: 'Analytics', icon: TrendingUp },
        { id: 'monetization', label: 'Monetization', icon: DollarSign },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    if (status === 'loading' || loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-2xl font-bold text-white">Creator Studio</h1>
                <Link
                    href="/upload"
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-full text-sm font-medium transition-colors"
                >
                    <Upload className="w-4 h-4" />
                    Upload Video
                </Link>
            </div>

            <div className="flex gap-1 mb-8 border-b border-gray-800">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setTab(id)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === id
                                ? 'border-white text-white'
                                : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            {tab === 'dashboard' && (
                <div className="space-y-8">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {[
                            { label: 'Views (30d)', value: formatNumber(stats?.totalViews || 0), icon: Eye, color: 'text-blue-400' },
                            { label: 'Watch Time (hrs)', value: formatNumber(stats?.watchTimeHours || 0), icon: TrendingUp, color: 'text-green-400' },
                            { label: 'Subscribers', value: formatNumber(stats?.subscriberCount || 0), icon: ThumbsUp, color: 'text-purple-400' },
                            { label: 'Revenue (₹)', value: formatNumber(stats?.revenue || 0), icon: DollarSign, color: 'text-yellow-400' },
                        ].map((kpi) => (
                            <div key={kpi.label} className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-gray-400 text-sm">{kpi.label}</span>
                                    <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
                                </div>
                                <p className="text-2xl font-bold text-white">{kpi.value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Views chart */}
                    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                        <h2 className="text-white font-semibold mb-6">Views — Last 30 Days</h2>
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} interval={4} />
                                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: '8px' }}
                                    labelStyle={{ color: '#fff' }}
                                />
                                <Area
                                    type="monotone" dataKey="views" stroke="#ef4444" strokeWidth={2}
                                    fill="url(#viewsGradient)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Recent videos */}
                    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl overflow-hidden">
                        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
                            <h2 className="text-white font-semibold">Recent Videos</h2>
                            <button onClick={() => setTab('videos')} className="text-blue-400 text-sm hover:underline">
                                See all
                            </button>
                        </div>
                        <VideoTable videos={videos.slice(0, 5)} onDelete={deleteVideo} />
                    </div>
                </div>
            )}

            {tab === 'videos' && (
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl overflow-hidden">
                    <div className="p-5 border-b border-gray-800">
                        <h2 className="text-white font-semibold">All Videos ({videos.length})</h2>
                    </div>
                    <VideoTable videos={videos} onDelete={deleteVideo} />
                </div>
            )}

            {tab === 'analytics' && (
                <div className="space-y-6">
                    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                        <h2 className="text-white font-semibold mb-6">Analytics Overview</h2>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="watchGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} interval={4} />
                                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ background: '#111', border: '1px solid #333', borderRadius: '8px' }}
                                    labelStyle={{ color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="watchTime" stroke="#3b82f6" strokeWidth={2} fill="url(#watchGradient)" name="Watch Time (min)" />
                            </AreaChart>
                        </ResponsiveContainer>
                        <p className="text-gray-500 text-sm mt-4 text-center">Watch time (minutes) over last 30 days</p>
                    </div>
                </div>
            )}

            {tab === 'monetization' && (
                <div className="space-y-6">
                    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-8 text-center">
                        <DollarSign className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                        <h2 className="text-white text-xl font-bold mb-2">Enable Monetization</h2>
                        <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
                            Connect your Stripe account to receive 70% of subscription revenue from your content.
                        </p>
                        <button
                            onClick={async () => {
                                const data = await api.post('/payments/connect');
                                if (data?.url) window.location.href = data.url;
                            }}
                            className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-8 py-3 rounded-full transition-colors"
                        >
                            Connect Stripe Account
                        </button>
                    </div>
                </div>
            )}

            {tab === 'settings' && (
                <ChannelSettings />
            )}
        </div>
    );
}

function VideoTable({ videos, onDelete }: { videos: any[]; onDelete: (id: string) => void }) {
    const visibilityIcon = (v: string) =>
        v === 'PUBLIC' ? <Globe className="w-3.5 h-3.5" /> :
            v === 'UNLISTED' ? <EyeOff className="w-3.5 h-3.5" /> :
                <Lock className="w-3.5 h-3.5" />;

    if (videos.length === 0) {
        return (
            <div className="text-center py-16 text-gray-600">
                <Video className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No videos uploaded yet</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-gray-800">
                        {['Video', 'Visibility', 'Views', 'Likes', 'Comments', 'Published', 'Actions'].map((h) => (
                            <th key={h} className="text-left text-gray-500 font-medium px-5 py-3 whitespace-nowrap">{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {videos.map((v) => (
                        <tr key={v.id} className="border-b border-gray-800/50 hover:bg-white/3 transition-colors">
                            <td className="px-5 py-4">
                                <div className="flex items-center gap-3">
                                    <div className="relative w-28 h-16 rounded overflow-hidden flex-shrink-0 bg-gray-800">
                                        {v.thumbnails?.[0]?.url && (
                                            <Image src={v.thumbnails[0].url} alt={v.title} fill className="object-cover" />
                                        )}
                                        {v.duration && (
                                            <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                                                {formatDuration(v.duration)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-white font-medium truncate max-w-xs">{v.title}</p>
                                        <p className={`text-xs mt-0.5 ${v.status === 'READY' ? 'text-green-400' :
                                                v.status === 'PROCESSING' ? 'text-yellow-400' :
                                                    'text-gray-500'
                                            }`}>
                                            {v.status}
                                        </p>
                                    </div>
                                </div>
                            </td>
                            <td className="px-5 py-4">
                                <span className="flex items-center gap-1.5 text-gray-400">
                                    {visibilityIcon(v.visibility)}
                                    {v.visibility}
                                </span>
                            </td>
                            <td className="px-5 py-4 text-gray-300">{formatNumber(v.viewCount || 0)}</td>
                            <td className="px-5 py-4 text-gray-300">{formatNumber(v.likeCount || 0)}</td>
                            <td className="px-5 py-4 text-gray-300">{formatNumber(v.commentCount || 0)}</td>
                            <td className="px-5 py-4 text-gray-500 whitespace-nowrap">
                                {v.publishedAt ? formatTimeAgo(v.publishedAt) : '—'}
                            </td>
                            <td className="px-5 py-4">
                                <div className="flex items-center gap-2">
                                    <Link href={`/studio/video/${v.id}`} className="text-gray-400 hover:text-white">
                                        <Edit className="w-4 h-4" />
                                    </Link>
                                    <button
                                        onClick={() => onDelete(v.id)}
                                        className="text-gray-600 hover:text-red-400"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function ChannelSettings() {
    const [form, setForm] = useState({ name: '', description: '' });
    const [saving, setSaving] = useState(false);

    async function save(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            await api.patch('/channels/me', form);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="max-w-xl">
            <form onSubmit={save} className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 space-y-5">
                <h2 className="text-white font-semibold text-lg">Channel Settings</h2>
                <div>
                    <label className="block text-gray-400 text-sm mb-2">Channel Name</label>
                    <input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full bg-gray-900 text-white rounded-lg px-4 py-2.5 border border-gray-700 focus:border-gray-500 outline-none"
                    />
                </div>
                <div>
                    <label className="block text-gray-400 text-sm mb-2">Description</label>
                    <textarea
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        rows={4}
                        className="w-full bg-gray-900 text-white rounded-lg px-4 py-2.5 border border-gray-700 focus:border-gray-500 outline-none resize-none"
                    />
                </div>
                <button
                    type="submit"
                    disabled={saving}
                    className="bg-white text-black font-medium px-6 py-2 rounded-full hover:bg-gray-200 disabled:opacity-50 transition-colors"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </form>
        </div>
    );
}
