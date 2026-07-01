'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60_000,
            retry: 1,
        },
    },
});

export function Providers({ children }: { children: React.ReactNode }) {
    const fetchMe = useAuthStore(s => s.fetchMe);
    const accessToken = useAuthStore(s => s.accessToken);

    useEffect(() => {
        if (accessToken) fetchMe();
    }, []);

    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
                {children}
            </ThemeProvider>
        </QueryClientProvider>
    );
}
