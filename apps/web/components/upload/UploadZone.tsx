'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Film, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUpload } from '@/hooks/useUpload';
import { formatFileSize } from '@/lib/format';

interface UploadZoneProps {
    onUploadComplete: (videoId: string) => void;
}

export function UploadZone({ onUploadComplete }: UploadZoneProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [metadata, setMetadata] = useState({
        title: '',
        description: '',
        tags: '',
        visibility: 'PRIVATE',
    });

    const { uploadState, startUpload, cancelUpload } = useUpload();

    const onDrop = useCallback((acceptedFiles: File[]) => {
        const file = acceptedFiles[0];
        if (!file) return;

        setSelectedFile(file);
        // Auto-fill title from filename
        const name = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setMetadata(prev => ({ ...prev, title: name }));
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'video/mp4': ['.mp4'],
            'video/webm': ['.webm'],
            'video/quicktime': ['.mov'],
            'video/x-msvideo': ['.avi'],
            'video/x-matroska': ['.mkv'],
        },
        maxFiles: 1,
        maxSize: 10 * 1024 * 1024 * 1024, // 10GB
        disabled: uploadState.status !== 'idle',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile || !metadata.title) return;

        const videoId = await startUpload(selectedFile, {
            title: metadata.title,
            description: metadata.description,
            tags: metadata.tags.split(',').map(t => t.trim()).filter(Boolean),
            visibility: metadata.visibility,
        });

        if (videoId) onUploadComplete(videoId);
    };

    const statusIcon = {
        idle: null,
        uploading: <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />,
        processing: <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />,
        transcoding: <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />,
        complete: <CheckCircle2 className="w-5 h-5 text-green-500" />,
        error: <AlertCircle className="w-5 h-5 text-red-500" />,
    }[uploadState.status];

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            {/* Drop Zone */}
            {!selectedFile ? (
                <div
                    {...getRootProps()}
                    className={cn(
                        'border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all',
                        isDragActive
                            ? 'border-red-500 bg-red-500/10'
                            : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/50',
                    )}
                >
                    <input {...getInputProps()} />
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center">
                            <Upload className="w-10 h-10 text-zinc-400" />
                        </div>
                        <div>
                            <p className="text-xl font-semibold text-zinc-100">
                                {isDragActive ? 'Drop your video here' : 'Drag & drop your video'}
                            </p>
                            <p className="text-zinc-400 mt-1">or click to browse files</p>
                        </div>
                        <p className="text-sm text-zinc-500">MP4, WebM, MOV, AVI, MKV up to 10GB</p>
                    </div>
                </div>
            ) : (
                /* File selected - show metadata form */
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* File info */}
                    <div className="flex items-center gap-4 p-4 bg-zinc-900 rounded-xl border border-zinc-800">
                        <Film className="w-8 h-8 text-red-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="font-medium text-zinc-100 truncate">{selectedFile.name}</p>
                            <p className="text-sm text-zinc-400">{formatFileSize(selectedFile.size)}</p>
                        </div>
                        {uploadState.status === 'idle' && (
                            <button
                                type="button"
                                onClick={() => setSelectedFile(null)}
                                className="text-zinc-500 hover:text-zinc-300"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>

                    {/* Upload progress */}
                    {uploadState.status !== 'idle' && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                    {statusIcon}
                                    <span className="capitalize text-zinc-300">
                                        {uploadState.status === 'uploading' && `Uploading... ${uploadState.uploadProgress}%`}
                                        {uploadState.status === 'processing' && 'Processing...'}
                                        {uploadState.status === 'transcoding' && `Transcoding... ${uploadState.transcodeProgress}%`}
                                        {uploadState.status === 'complete' && 'Upload complete!'}
                                        {uploadState.status === 'error' && uploadState.error}
                                    </span>
                                </div>
                                <span className="text-zinc-500">
                                    {uploadState.status === 'uploading' && `${uploadState.uploadProgress}%`}
                                    {uploadState.status === 'transcoding' && `${uploadState.transcodeProgress}%`}
                                </span>
                            </div>
                            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        'h-full rounded-full transition-all duration-300',
                                        uploadState.status === 'uploading' && 'bg-blue-500',
                                        uploadState.status === 'processing' && 'bg-yellow-500',
                                        uploadState.status === 'transcoding' && 'bg-purple-500',
                                        uploadState.status === 'complete' && 'bg-green-500',
                                        uploadState.status === 'error' && 'bg-red-500',
                                    )}
                                    style={{
                                        width: `${uploadState.status === 'uploading' ? uploadState.uploadProgress
                                                : uploadState.status === 'transcoding' ? uploadState.transcodeProgress
                                                    : uploadState.status === 'complete' ? 100
                                                        : 0
                                            }%`,
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Metadata fields */}
                    <div className="grid gap-4">
                        <div>
                            <label className="text-sm font-medium text-zinc-300 mb-1.5 block">
                                Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                value={metadata.title}
                                onChange={e => setMetadata(p => ({ ...p, title: e.target.value }))}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                                placeholder="Add a title that describes your video"
                                required
                                disabled={uploadState.status !== 'idle'}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-zinc-300 mb-1.5 block">Description</label>
                            <textarea
                                value={metadata.description}
                                onChange={e => setMetadata(p => ({ ...p, description: e.target.value }))}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500 resize-none"
                                placeholder="Tell viewers about your video..."
                                rows={4}
                                disabled={uploadState.status !== 'idle'}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-zinc-300 mb-1.5 block">Tags</label>
                            <input
                                value={metadata.tags}
                                onChange={e => setMetadata(p => ({ ...p, tags: e.target.value }))}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                                placeholder="gaming, tutorial, vlog (comma separated)"
                                disabled={uploadState.status !== 'idle'}
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-zinc-300 mb-1.5 block">Visibility</label>
                            <select
                                value={metadata.visibility}
                                onChange={e => setMetadata(p => ({ ...p, visibility: e.target.value }))}
                                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-red-500"
                                disabled={uploadState.status !== 'idle'}
                            >
                                <option value="PRIVATE">🔒 Private</option>
                                <option value="UNLISTED">🔗 Unlisted</option>
                                <option value="PUBLIC">🌍 Public</option>
                            </select>
                        </div>
                    </div>

                    {/* Submit button */}
                    {uploadState.status === 'idle' && (
                        <button
                            type="submit"
                            disabled={!metadata.title}
                            className="w-full bg-red-600 hover:bg-red-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold py-3 rounded-xl transition-colors"
                        >
                            Upload Video
                        </button>
                    )}
                </form>
            )}
        </div>
    );
}
