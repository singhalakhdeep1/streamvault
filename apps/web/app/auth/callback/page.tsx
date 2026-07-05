'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');

    if (accessToken && refreshToken) {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('refresh_token', refreshToken);
      useAuthStore.setState({ accessToken });
      void fetchMe().then(() => router.replace('/'));
    } else {
      router.replace('/login');
    }
  }, [searchParams, router, fetchMe]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-zinc-400">Signing you in...</p>
    </div>
  );
}
