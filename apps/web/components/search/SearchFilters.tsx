'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';

interface Props { currentType: string; query: string; }

const TYPES = [
    { label: 'All', value: 'all' },
    { label: 'Videos', value: 'videos' },
    { label: 'Channels', value: 'channels' },
];

export function SearchFilters({ currentType, query }: Props) {
    const router = useRouter();

    return (
        <div className="flex gap-2 mb-6 border-b border-gray-800 pb-4">
            {TYPES.map((t) => (
                <Link
                    key={t.value}
                    href={`/search?q=${encodeURIComponent(query)}&type=${t.value}`}
                    className={`px-4 py-1.5 rounded-full text-sm transition-colors ${currentType === t.value
                            ? 'bg-white text-black font-medium'
                            : 'text-gray-400 hover:text-white border border-gray-700'
                        }`}
                >
                    {t.label}
                </Link>
            ))}
        </div>
    );
}
