'use client';

import { useCallback, useState } from 'react';
import { api } from '@/lib/api';

export type UploadStatus = 'idle' | 'uploading' | 'processing' | 'transcoding' | 'complete' | 'error';

export interface UploadState {
  status: UploadStatus;
  uploadProgress: number;
  transcodeProgress: number;
  error?: string;
  videoId?: string;
}

interface UploadMetadata {
  title: string;
  description?: string;
  tags?: string[];
  visibility?: string;
}

export function useUpload() {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    uploadProgress: 0,
    transcodeProgress: 0,
  });

  const startUpload = useCallback(async (file: File, metadata: UploadMetadata): Promise<string | null> => {
    try {
      setUploadState({ status: 'uploading', uploadProgress: 0, transcodeProgress: 0 });

      const { data: initRes } = await api.post('/upload/init', {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'video/mp4',
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        visibility: metadata.visibility ?? 'PRIVATE',
      });

      const { uploadUrl, videoId, rawStorageKey } = initRes.data;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadState((s) => ({ ...s, uploadProgress: pct }));
          }
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Upload failed')));
        xhr.onerror = () => reject(new Error('Upload failed'));
        xhr.open('PUT', uploadUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      setUploadState((s) => ({ ...s, status: 'processing', uploadProgress: 100 }));

      await api.post(`/upload/${videoId}/complete`, { checksum: undefined });

      setUploadState((s) => ({ ...s, status: 'transcoding', transcodeProgress: 50 }));

      await api.post(`/videos/${videoId}/transcode`).catch(() => {});

      setUploadState({
        status: 'complete',
        uploadProgress: 100,
        transcodeProgress: 100,
        videoId,
      });

      return videoId;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setUploadState((s) => ({ ...s, status: 'error', error: message }));
      return null;
    }
  }, []);

  const cancelUpload = useCallback(() => {
    setUploadState({ status: 'idle', uploadProgress: 0, transcodeProgress: 0 });
  }, []);

  return { uploadState, startUpload, cancelUpload };
}
