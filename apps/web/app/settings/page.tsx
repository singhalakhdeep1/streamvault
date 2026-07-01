'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { User, CreditCard, Bell, Shield } from 'lucide-react';

type Tab = 'profile' | 'billing' | 'notifications' | 'security';

export default function SettingsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [tab, setTab] = useState<Tab>('profile');
    const [profile, setProfile] = useState({ displayName: '', bio: '' });
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
    }, [status, router]);

    useEffect(() => {
        if (!session) return;
        api.get('/users/me').then((u) => {
            setProfile({ displayName: u?.displayName || '', bio: u?.bio || '' });
        });
    }, [session]);

    async function saveProfile(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        await api.patch('/users/me', profile);
        setSaving(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    }

    const TABS: { id: Tab; label: string; icon: any }[] = [
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'billing', label: 'Billing', icon: CreditCard },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'security', label: 'Security', icon: Shield },
    ];

    if (status === 'loading') return null;

    return (
        <div className="max-w-3xl mx-auto px-4 py-8">
            <h1 className="text-xl font-bold text-white mb-8">Settings</h1>

            <div className="flex gap-1 mb-8 border-b border-gray-800">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setTab(id)}
                        className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === id ? 'border-white text-white' : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        <Icon className="w-4 h-4" />
                        {label}
                    </button>
                ))}
            </div>

            {tab === 'profile' && (
                <form onSubmit={saveProfile} className="space-y-5 max-w-md">
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">Display Name</label>
                        <input
                            value={profile.displayName}
                            onChange={(e) => setProfile({ ...profile, displayName: e.target.value })}
                            className="w-full bg-gray-900 text-white rounded-lg px-4 py-2.5 border border-gray-700 focus:border-gray-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">Bio</label>
                        <textarea
                            value={profile.bio}
                            onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                            rows={3}
                            className="w-full bg-gray-900 text-white rounded-lg px-4 py-2.5 border border-gray-700 focus:border-gray-500 outline-none resize-none"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={saving}
                        className="bg-white text-black font-medium px-6 py-2 rounded-full hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                        {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </form>
            )}

            {tab === 'billing' && (
                <div className="space-y-4 max-w-md">
                    <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6">
                        <h2 className="text-white font-medium mb-1">Current Plan</h2>
                        <p className="text-gray-400 text-sm mb-4">
                            {(session?.user as any)?.isPremium ? 'Premium' : 'Free'}
                        </p>
                        <button
                            onClick={async () => {
                                const data = await api.post('/payments/portal');
                                if (data?.url) window.location.href = data.url;
                            }}
                            className="bg-white text-black text-sm font-medium px-5 py-2 rounded-full hover:bg-gray-200 transition-colors"
                        >
                            Manage Subscription
                        </button>
                    </div>
                    <a
                        href="/pricing"
                        className="block text-center text-sm text-gray-400 hover:text-white transition-colors"
                    >
                        View all plans →
                    </a>
                </div>
            )}

            {tab === 'notifications' && (
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 max-w-md">
                    <p className="text-gray-400 text-sm">
                        Notification preferences can be configured per channel from the Subscriptions page.
                    </p>
                </div>
            )}

            {tab === 'security' && (
                <div className="bg-[#1a1a1a] border border-gray-800 rounded-xl p-6 max-w-md">
                    <h2 className="text-white font-medium mb-4">Account Security</h2>
                    <p className="text-gray-400 text-sm mb-4">Signed in as <strong className="text-white">{session?.user?.email}</strong></p>
                    <button className="text-sm text-red-400 hover:text-red-300 transition-colors">
                        Sign out of all devices
                    </button>
                </div>
            )}
        </div>
    );
}
