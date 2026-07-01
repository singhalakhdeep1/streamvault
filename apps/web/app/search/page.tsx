import { Suspense } from 'next';
import { SearchResults } from '@/components/search/SearchResults';
import { SearchFilters } from '@/components/search/SearchFilters';

interface Props {
    searchParams: { q?: string; type?: string; page?: string };
}

export async function generateMetadata({ searchParams }: Props) {
    return {
        title: searchParams.q ? `"${searchParams.q}" — StreamVault Search` : 'Search — StreamVault',
    };
}

async function getResults(query: string, type: string, page: number) {
    if (!query) return { videos: [], channels: [], total: 0 };
    try {
        const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/search?q=${encodeURIComponent(query)}&type=${type}&page=${page}&limit=20`,
            { cache: 'no-store' },
        );
        if (!res.ok) return { videos: [], channels: [], total: 0 };
        const data = await res.json();
        return data.data || { videos: [], channels: [], total: 0 };
    } catch { return { videos: [], channels: [], total: 0 }; }
}

export default async function SearchPage({ searchParams }: Props) {
    const query = searchParams.q || '';
    const type = searchParams.type || 'all';
    const page = parseInt(searchParams.page || '1');

    const results = await getResults(query, type, page);

    return (
        <div className="max-w-5xl mx-auto px-4 py-6">
            {query ? (
                <>
                    <p className="text-gray-400 text-sm mb-6">
                        {results.total > 0
                            ? `About ${results.total.toLocaleString()} results for "${query}"`
                            : `No results for "${query}"`
                        }
                    </p>
                    <SearchFilters currentType={type} query={query} />
                    <SearchResults results={results} type={type} />
                </>
            ) : (
                <div className="text-center py-24 text-gray-600">
                    <p className="text-xl">Search for videos, channels, and more</p>
                </div>
            )}
        </div>
    );
}
