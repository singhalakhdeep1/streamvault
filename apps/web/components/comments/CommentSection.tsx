'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { ThumbsUp, MoreHorizontal, Loader2, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import { formatViewCount } from '@/lib/format';
import toast from 'react-hot-toast';

interface CommentSectionProps {
    videoId: string;
    commentCount: number;
}

export function CommentSection({ videoId, commentCount }: CommentSectionProps) {
    const { user } = useAuthStore();
    const queryClient = useQueryClient();
    const [commentText, setCommentText] = useState('');
    const [sort, setSort] = useState<'top' | 'new'>('top');

    const { data, isLoading, fetchNextPage, hasNextPage } = useQuery({
        queryKey: ['comments', videoId, sort],
        queryFn: () => api.get(`/comments/${videoId}?sort=${sort}&limit=20`).then(r => r.data.data),
        staleTime: 60_000,
    });

    const addComment = useMutation({
        mutationFn: (text: string) => api.post(`/comments`, { videoId, content: text }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['comments', videoId] });
            setCommentText('');
            toast.success('Comment added');
        },
        onError: () => toast.error('Failed to post comment'),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!commentText.trim()) return;
        if (!user) { toast.error('Sign in to comment'); return; }
        addComment.mutate(commentText.trim());
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <h3 className="font-semibold text-zinc-100">{formatViewCount(commentCount)} Comments</h3>
                <select
                    value={sort}
                    onChange={e => setSort(e.target.value as 'top' | 'new')}
                    className="bg-transparent text-sm text-zinc-400 focus:outline-none cursor-pointer"
                >
                    <option value="top" className="bg-zinc-900">Top comments</option>
                    <option value="new" className="bg-zinc-900">Newest first</option>
                </select>
            </div>

            {/* Add comment */}
            {user && (
                <form onSubmit={handleSubmit} className="flex gap-3">
                    <div className="w-9 h-9 rounded-full bg-zinc-700 overflow-hidden flex-shrink-0">
                        {user.avatarUrl && <Image src={user.avatarUrl} alt={user.username} width={36} height={36} className="object-cover" />}
                    </div>
                    <div className="flex-1">
                        <input
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            placeholder="Add a comment..."
                            className="w-full bg-transparent border-b border-zinc-700 focus:border-red-500 text-zinc-100 text-sm py-2 outline-none transition-colors placeholder:text-zinc-500"
                        />
                        {commentText && (
                            <div className="flex justify-end gap-2 mt-2">
                                <button type="button" onClick={() => setCommentText('')} className="text-sm text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-full">
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={addComment.isPending}
                                    className="text-sm bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-full flex items-center gap-2 transition-colors"
                                >
                                    {addComment.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                                    Comment
                                </button>
                            </div>
                        )}
                    </div>
                </form>
            )}

            {/* Comments list */}
            {isLoading ? (
                <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex gap-3 animate-pulse">
                            <div className="w-9 h-9 rounded-full bg-zinc-800 flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                                <div className="h-3 bg-zinc-800 rounded w-1/4" />
                                <div className="h-4 bg-zinc-800 rounded w-full" />
                                <div className="h-4 bg-zinc-800 rounded w-3/4" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-5">
                    {data?.comments?.map((comment: any) => (
                        <CommentItem key={comment.id} comment={comment} />
                    ))}
                    {hasNextPage && (
                        <button
                            onClick={() => fetchNextPage()}
                            className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300"
                        >
                            <ChevronDown className="w-4 h-4" /> Load more comments
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

function CommentItem({ comment }: { comment: any }) {
    const [showReplies, setShowReplies] = useState(false);

    return (
        <div className="flex gap-3">
            <div className="w-9 h-9 rounded-full bg-zinc-700 overflow-hidden flex-shrink-0">
                {comment.user?.avatarUrl && (
                    <Image src={comment.user.avatarUrl} alt={comment.user.username} width={36} height={36} className="object-cover" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-zinc-200">{comment.user?.username}</span>
                    <span className="text-xs text-zinc-500">
                        {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </span>
                </div>
                <p className="text-sm text-zinc-300 mt-1 leading-relaxed">{comment.content}</p>
                <div className="flex items-center gap-3 mt-2">
                    <button className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                        <ThumbsUp className="w-3.5 h-3.5" />
                        {comment._count?.likes > 0 && comment._count.likes}
                    </button>
                    <button className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">Reply</button>
                </div>
                {comment._count?.replies > 0 && (
                    <button
                        onClick={() => setShowReplies(!showReplies)}
                        className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-2"
                    >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showReplies ? 'rotate-180' : ''}`} />
                        {comment._count.replies} {comment._count.replies === 1 ? 'reply' : 'replies'}
                    </button>
                )}
            </div>
        </div>
    );
}
