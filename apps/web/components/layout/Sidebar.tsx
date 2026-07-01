'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    Home, Compass, Flame, Clock, Bell, PlaySquare,
    Radio, History, ThumbsUp, Settings,
    Users, Star, ListVideo, Tv2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/store';

const primaryNav = [
    { href: '/', label: 'Home', icon: Home },
    { href: '/explore', label: 'Explore', icon: Compass },
    { href: '/trending', label: 'Trending', icon: Flame },
    { href: '/live', label: 'Live', icon: Radio },
];

const libraryNav = [
    { href: '/subscriptions', label: 'Subscriptions', icon: Bell, auth: true },
    { href: '/history', label: 'History', icon: History, auth: true },
    { href: '/watch-later', label: 'Watch Later', icon: Clock, auth: true },
    { href: '/liked', label: 'Liked Videos', icon: ThumbsUp, auth: true },
    { href: '/playlists', label: 'Playlists', icon: ListVideo, auth: true },
];

const studioNav = [
    { href: '/studio', label: 'Studio', icon: Tv2, auth: true },
    { href: '/upload', label: 'Upload', icon: PlaySquare, auth: true },
    { href: '/studio/analytics', label: 'Analytics', icon: Star, auth: true },
];

export function Sidebar() {
    const pathname = usePathname();
    const { user } = useAuthStore();

    const isActive = (href: string) =>
        href === '/' ? pathname === '/' : pathname.startsWith(href);

    return (
        <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 border-r border-zinc-800 bg-zinc-950 h-screen sticky top-0 overflow-y-auto">
            <div className="p-4 space-y-1 pt-16">
                {/* Primary nav */}
                <nav className="space-y-0.5">
                    {primaryNav.map(({ href, label, icon: Icon }) => (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                                isActive(href)
                                    ? 'bg-red-600/20 text-red-400'
                                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800',
                            )}
                        >
                            <Icon className="w-4 h-4" />
                            {label}
                        </Link>
                    ))}
                </nav>

                <div className="pt-4">
                    <p className="px-3 text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-2">Library</p>
                    <nav className="space-y-0.5">
                        {libraryNav.map(({ href, label, icon: Icon, auth }) => {
                            if (auth && !user) return null;
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    className={cn(
                                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                                        isActive(href)
                                            ? 'bg-zinc-800 text-zinc-100'
                                            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800',
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    {label}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {user && (
                    <div className="pt-4">
                        <p className="px-3 text-xs font-semibold text-zinc-600 uppercase tracking-wider mb-2">Creator</p>
                        <nav className="space-y-0.5">
                            {studioNav.map(({ href, label, icon: Icon }) => (
                                <Link
                                    key={href}
                                    href={href}
                                    className={cn(
                                        'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                                        isActive(href)
                                            ? 'bg-zinc-800 text-zinc-100'
                                            : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800',
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    {label}
                                </Link>
                            ))}
                        </nav>
                    </div>
                )}
            </div>
        </aside>
    );
}
