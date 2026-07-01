import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import { Navbar } from '@/components/layout/Navbar';
import { Sidebar } from '@/components/layout/Sidebar';
import { Toaster } from 'react-hot-toast';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
    title: { default: 'StreamVault', template: '%s | StreamVault' },
    description: 'Stream, upload, and discover videos — Production-grade OTT platform',
    keywords: ['streaming', 'video', 'live', 'creator', 'OTT'],
    openGraph: {
        type: 'website',
        siteName: 'StreamVault',
        title: 'StreamVault — Video Streaming Platform',
        description: 'Stream, upload, and discover videos',
    },
    twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.variable} font-sans bg-zinc-950 text-zinc-100 antialiased`}>
                <Providers>
                    <div className="flex min-h-screen">
                        <Sidebar />
                        <div className="flex flex-col flex-1 min-w-0">
                            <Navbar />
                            <main className="flex-1">{children}</main>
                        </div>
                    </div>
                    <Toaster
                        position="bottom-right"
                        toastOptions={{
                            style: { background: '#18181b', color: '#f4f4f5', border: '1px solid #27272a' },
                        }}
                    />
                </Providers>
            </body>
        </html>
    );
}
