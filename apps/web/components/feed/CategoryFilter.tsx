'use client';

import Link from 'next/link';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

const CATEGORIES = [
  { slug: '', label: 'All' },
  { slug: 'gaming', label: 'Gaming' },
  { slug: 'music', label: 'Music' },
  { slug: 'education', label: 'Education' },
  { slug: 'tech', label: 'Tech' },
  { slug: 'entertainment', label: 'Entertainment' },
  { slug: 'sports', label: 'Sports' },
];

interface CategoryFilterProps {
  activeCategory?: string;
}

export function CategoryFilter({ activeCategory }: CategoryFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function selectCategory(slug: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) params.set('category', slug);
    else params.delete('category');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {CATEGORIES.map(({ slug, label }) => {
        const active = (activeCategory ?? '') === slug;
        return (
          <button
            key={slug || 'all'}
            type="button"
            onClick={() => selectCategory(slug)}
            className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-zinc-100 text-zinc-900'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
