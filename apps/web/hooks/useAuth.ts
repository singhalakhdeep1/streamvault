'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

/** Client-side auth hook — replaces next-auth useSession */
export function useAuth(requireAuth = false) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isLoading = useAuthStore((s) => s.isLoading);
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    if (accessToken && !user) {
      void fetchMe();
    }
  }, [accessToken, user, fetchMe]);

  useEffect(() => {
    if (requireAuth && !isLoading && !accessToken) {
      router.push('/login');
    }
  }, [requireAuth, isLoading, accessToken, router]);

  return {
    user,
    accessToken,
    isLoading,
    isAuthenticated: !!accessToken,
    status: !accessToken ? ('unauthenticated' as const) : ('authenticated' as const),
  };
}
