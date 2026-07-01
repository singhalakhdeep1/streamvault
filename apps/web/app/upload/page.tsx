'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { UploadZone } from '@/components/upload/UploadZone';
import { Globe, Lock, EyeOff, Upload } from 'lucide-react';

export default function UploadPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [meta, setMeta] = useState({
        title: '',
        description: '',
        visibility: 'PUBLIC',
        categoryId: '',
    });
    const [videoId, setVideoId] = useState<string | null>(null);

    if (status === 'unauthenticated') {
        router.push('/login');
        return null;
    }

    const VISIBILITY = [
        { value: 'PUBLIC', label: 'Public', icon: Globe, desc: 'Anyone can watch' },
        { value: 'UNLISTED', label: 'Unlisted', icon: EyeOff, desc: 'Only with the link' },
        { value: 'PRIVATE', label: 'Private', icon: Lock, desc: 'Only you' },
    ];

    return (
        <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="flex items-center gap-3 mb-8">
                <Upload className="w-6 h-6 text-white" />
                <h1 className="text-xl font-bold text-white">Upload Video</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Upload zone */}
                <div>
                    <UploadZone
                        metadata={meta}
                        onUploaded={(id) => {
                            setVideoId(id);
                        }}
                    />
                </div>

                {/* Metadata form */}
                <div className="space-y-5">
                    <div>
                        <label className="block text-gray-400 text-sm mb-2">
                            Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            value={meta.title}
                            onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                            maxLength={100}
                            placeholder="Add a title that describes your video"
                            className="w-full bg-gray-900 text-white rounded-lg px-4 py-2.5 border border-gray-700 focus:border-gray-500 outline-none"
                        />
                        <p className="text-gray-600 text-xs mt-1 text-right">{meta.title.length}/100</p>
                    </div>

                    <div>
                        <label className="block text-gray-400 text-sm mb-2">Description</label>
                        <textarea
                            value={meta.description}
                            onChange={(e) => setMeta({ ...meta, description: e.target.value })}
                            rows={5}
                            placeholder="Tell viewers about your video"
                            className="w-full bg-gray-900 text-white rounded-lg px-4 py-2.5 border border-gray-700 focus:border-gray-500 outline-none resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-gray-400 text-sm mb-3">Visibility</label>
                        <div className="space-y-2">
                            {VISIBILITY.map(({ value, label, icon: Icon, desc }) => (
                                <button
                                    key={value}
                                    onClick={() => setMeta({ ...meta, visibility: value })}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${meta.visibility === value
                                            ? 'border-white bg-white/5'
                                            : 'border-gray-800 hover:border-gray-700'
                                        }`}
                                >
                                    <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                    <div>
                                        <p className="text-white text-sm font-medium">{label}</p>
                                        <p className="text-gray-500 text-xs">{desc}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {videoId && (
                        <div className="bg-green-900/30 border border-green-700/50 rounded-xl p-4 text-center">
                            <p className="text-green-400 text-sm font-medium">Upload complete!</p>
                            <p className="text-gray-500 text-xs mt-1">Your video is being processed. You can close this page.</p>
                            <button
                                onClick={() => router.push('/studio')}
                                className="mt-3 text-white text-sm underline hover:no-underline"
                            >
                                Go to Studio
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
