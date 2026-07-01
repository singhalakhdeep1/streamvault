import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    experimental: { serverActions: { allowedOrigins: ['localhost:3000'] } },
    images: {
        remotePatterns: [
            { protocol: 'http', hostname: 'localhost' },
            { protocol: 'https', hostname: '*.amazonaws.com' },
            { protocol: 'https', hostname: '*.cloudfront.net' },
            { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
        ],
    },
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/:path*`,
            },
        ];
    },
};

export default nextConfig;
