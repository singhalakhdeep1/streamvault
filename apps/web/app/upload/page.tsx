'use client';

import { Upload } from 'lucide-react';
import { UploadZone } from '@/components/upload/UploadZone';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';

export default function UploadPage() {
  const { isAuthenticated, status } = useAuth(true);
  const router = useRouter();

  if (status === 'unauthenticated' || !isAuthenticated) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Upload className="w-6 h-6 text-white" />
        <h1 className="text-xl font-bold text-white">Upload Video</h1>
      </div>
      <UploadZone
        onUploadComplete={(videoId) => {
          router.push('/studio');
        }}
      />
    </div>
  );
}
