'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search, Bell, Upload, Menu, X, User, LogOut, Settings } from 'lucide-react';
import Image from 'next/image';
import { useAuthStore } from '@/lib/store';
import { cn } from '@/lib/utils';

export function Navbar() {
    const [searchQuery, setSearchQuery] = useState('');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const { user, logout } = useAuthStore();

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;
        router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    };

    return (
        <header className="sticky top-0 z-50 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 px-4 h-14 flex items-center gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0">
                <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-sm">SV</span>
                </div>
                <span className="font-bold text-white hidden md:block">StreamVault</span>
            </Link>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-auto">
                <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded-full px-4 py-1.5 focus-within:border-zinc-500 transition-colors">
                    <Search className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                    <input
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search videos, channels..."
                        className="flex-1 bg-transparent text-zinc-100 text-sm placeholder:text-zinc-500 outline-none"
                    />
                </div>
            </form>

            {/* Right side actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
                {user ? (
                    <>
                        <Link
                            href="/upload"
                            className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-3 py-1.5 rounded-full transition-colors"
                        >
                            <Upload className="w-4 h-4" />
                            <span className="hidden sm:block">Upload</span>
                        </Link>

                        {/* Notifications */}
                        <button className="relative p-2 text-zinc-400 hover:text-zinc-100 transition-colors">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                        </button>

                        {/* User menu */}
                        <div className="relative">
                            <button
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                                className="w-8 h-8 rounded-full overflow-hidden bg-zinc-700 flex items-center justify-center"
                            >
                                {user.avatarUrl ? (
                                    <Image src={user.avatarUrl} alt={user.username} width={32} height={32} className="object-cover" />
                                ) : (
                                    <User className="w-4 h-4 text-zinc-300" />
                                )}
                            </button>

                            {userMenuOpen && (
                                <div className="absolute right-0 mt-2 w-52 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl overflow-hidden z-50">
                                    <div className="px-4 py-3 border-b border-zinc-800">
                                        <p className="font-medium text-zinc-100">{user.username}</p>
                                        <p className="text-xs text-zinc-400">{user.email}</p>
                                    </div>
                                    <div className="py-1">
                                        <Link
                                            href={`/channel/${user.username}`}
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                                            onClick={() => setUserMenuOpen(false)}
                                        >
                                            <User className="w-4 h-4" /> Your Channel
                                        </Link>
                                        <Link
                                            href="/studio"
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 transition-colors"
                                            onClick={() => setUserMenuOpen(false)}
                                        >
                                            <Settings className="w-4 h-4" /> Studio
                                        </Link>
                                        <button
                                            onClick={() => { logout(); setUserMenuOpen(false); }}
                                            className="flex items-center gap-3 px-4 py-2 text-sm text-red-400 hover:bg-zinc-800 transition-colors w-full"
                                        >
                                            <LogOut className="w-4 h-4" /> Sign out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <Link
                        href="/login"
                        className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-4 py-1.5 rounded-full transition-colors"
                    >
                        Sign in
                    </Link>
                )}
            </div>
        </header>
    );
}
