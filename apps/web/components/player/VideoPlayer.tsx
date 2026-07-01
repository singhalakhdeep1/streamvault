'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import {
    Play, Pause, Volume2, VolumeX, Maximize2, Minimize2,
    Settings, PictureInPicture2, ChevronLeft, ChevronRight,
    Subtitles, SkipForward,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { QualitySelector } from './QualitySelector';
import { SubtitleSelector } from './SubtitleSelector';
import { formatDuration } from '@/lib/format';

interface VideoPlayerProps {
    videoId: string;
    hlsUrl: string;
    posterUrl?: string;
    resumeTime?: number;
    chapters?: Array<{ startTime: number; title: string }>;
    subtitles?: Array<{ language: string; label: string; url: string }>;
    onTimeUpdate?: (seconds: number) => void;
    onEnded?: () => void;
    className?: string;
}

export function VideoPlayer({
    videoId,
    hlsUrl,
    posterUrl,
    resumeTime = 0,
    chapters = [],
    subtitles = [],
    onTimeUpdate,
    onEnded,
    className,
}: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const hlsRef = useRef<Hls | null>(null);
    const controlsTimeoutRef = useRef<NodeJS.Timeout>();
    const progressRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [currentQuality, setCurrentQuality] = useState('Auto');
    const [availableQualities, setAvailableQualities] = useState<string[]>([]);
    const [isBuffering, setIsBuffering] = useState(false);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [isTheaterMode, setIsTheaterMode] = useState(false);
    const [currentChapter, setCurrentChapter] = useState<string>('');
    const [showIntroSkip, setShowIntroSkip] = useState(false);

    // ─── Initialize HLS ────────────────────────────────────────────────
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !hlsUrl) return;

        if (Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: false,
                backBufferLength: 90,
                maxBufferLength: 30,
                maxMaxBufferLength: 600,
                startLevel: -1,     // Auto quality on start
                abrEwmaDefaultEstimate: 500000,
                abrEwmaFastLive: 3,
                abrEwmaSlowLive: 9,
            });

            hls.loadSource(hlsUrl);
            hls.attachMedia(video);
            hlsRef.current = hls;

            hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
                const qualityLabels = data.levels.map((l, i) => {
                    const height = l.height;
                    if (height >= 1080) return '1080p';
                    if (height >= 720) return '720p';
                    if (height >= 480) return '480p';
                    return '360p';
                });
                setAvailableQualities(['Auto', ...new Set(qualityLabels)]);

                // Resume from last position
                if (resumeTime > 10) {
                    video.currentTime = resumeTime;
                }
                video.play().catch(() => { });
            });

            hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
                const level = hls.levels[data.level];
                const height = level?.height || 0;
                if (height >= 1080) setCurrentQuality('1080p');
                else if (height >= 720) setCurrentQuality('720p');
                else if (height >= 480) setCurrentQuality('480p');
                else setCurrentQuality('360p');
            });

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        hls.startLoad();
                    } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        hls.recoverMediaError();
                    }
                }
            });

            return () => { hls.destroy(); };
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari native HLS
            video.src = hlsUrl;
        }
    }, [hlsUrl, resumeTime]);

    // ─── Video event listeners ─────────────────────────────────────────
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onWaiting = () => setIsBuffering(true);
        const onCanPlay = () => setIsBuffering(false);
        const onDurationChange = () => setDuration(video.duration);
        const onVolumeChange = () => {
            setVolume(video.volume);
            setIsMuted(video.muted);
        };
        const onTimeUpdateHandler = () => {
            setCurrentTime(video.currentTime);
            onTimeUpdate?.(Math.floor(video.currentTime));

            // Update buffered progress
            if (video.buffered.length > 0) {
                setBuffered(video.buffered.end(video.buffered.length - 1));
            }

            // Update current chapter
            if (chapters.length > 0) {
                const chapter = [...chapters]
                    .reverse()
                    .find(c => c.startTime <= video.currentTime);
                setCurrentChapter(chapter?.title || '');
            }
        };
        const onEndedHandler = () => {
            setIsPlaying(false);
            onEnded?.();
        };

        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('waiting', onWaiting);
        video.addEventListener('canplay', onCanPlay);
        video.addEventListener('durationchange', onDurationChange);
        video.addEventListener('volumechange', onVolumeChange);
        video.addEventListener('timeupdate', onTimeUpdateHandler);
        video.addEventListener('ended', onEndedHandler);

        return () => {
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('waiting', onWaiting);
            video.removeEventListener('canplay', onCanPlay);
            video.removeEventListener('durationchange', onDurationChange);
            video.removeEventListener('volumechange', onVolumeChange);
            video.removeEventListener('timeupdate', onTimeUpdateHandler);
            video.removeEventListener('ended', onEndedHandler);
        };
    }, [chapters, onTimeUpdate, onEnded]);

    // ─── Keyboard shortcuts ────────────────────────────────────────────
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT') return;
            const video = videoRef.current;
            if (!video) return;

            switch (e.key) {
                case ' ':
                case 'k': e.preventDefault(); togglePlay(); break;
                case 'f': e.preventDefault(); toggleFullscreen(); break;
                case 'm': e.preventDefault(); toggleMute(); break;
                case 'ArrowRight': e.preventDefault(); video.currentTime += 10; break;
                case 'ArrowLeft': e.preventDefault(); video.currentTime -= 10; break;
                case 'ArrowUp': e.preventDefault(); video.volume = Math.min(1, video.volume + 0.1); break;
                case 'ArrowDown': e.preventDefault(); video.volume = Math.max(0, video.volume - 0.1); break;
                case 'j': e.preventDefault(); video.currentTime -= 10; break;
                case 'l': e.preventDefault(); video.currentTime += 10; break;
            }
        };

        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, []);

    // ─── Controls auto-hide ────────────────────────────────────────────
    const showControlsTemporarily = useCallback(() => {
        setShowControls(true);
        clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) setShowControls(false);
        }, 3000);
    }, [isPlaying]);

    // ─── Playback controls ─────────────────────────────────────────────
    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) video.play();
        else video.pause();
    };

    const toggleMute = () => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
    };

    const toggleFullscreen = async () => {
        const container = containerRef.current;
        if (!container) return;

        if (!document.fullscreenElement) {
            await container.requestFullscreen();
            setIsFullscreen(true);
        } else {
            await document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const togglePiP = async () => {
        const video = videoRef.current;
        if (!video) return;
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else {
            await video.requestPictureInPicture();
        }
    };

    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        const video = videoRef.current;
        const bar = progressRef.current;
        if (!video || !bar) return;

        const rect = bar.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        video.currentTime = Math.max(0, Math.min(duration, ratio * duration));
    };

    const handleQualityChange = (quality: string) => {
        const hls = hlsRef.current;
        if (!hls) return;

        if (quality === 'Auto') {
            hls.currentLevel = -1;
        } else {
            const levelIndex = hls.levels.findIndex(l => {
                const h = l.height;
                if (quality === '1080p') return h >= 1080;
                if (quality === '720p') return h >= 720 && h < 1080;
                if (quality === '480p') return h >= 480 && h < 720;
                return h < 480;
            });
            if (levelIndex >= 0) hls.currentLevel = levelIndex;
        }
        setCurrentQuality(quality);
    };

    const skipSeconds = (seconds: number) => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
    };

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;

    return (
        <div
            ref={containerRef}
            className={cn(
                'relative bg-black select-none group',
                isTheaterMode ? 'w-full aspect-video' : 'w-full aspect-video rounded-xl overflow-hidden',
                className,
            )}
            onMouseMove={showControlsTemporarily}
            onMouseLeave={() => isPlaying && setShowControls(false)}
            onClick={togglePlay}
        >
            {/* Video element */}
            <video
                ref={videoRef}
                className="w-full h-full"
                poster={posterUrl}
                playsInline
                preload="metadata"
            />

            {/* Buffering spinner */}
            {isBuffering && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
            )}

            {/* Chapter title overlay */}
            {currentChapter && (
                <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm px-3 py-1 rounded-full text-sm text-white">
                    {currentChapter}
                </div>
            )}

            {/* Skip intro button */}
            {showIntroSkip && (
                <button
                    className="absolute bottom-20 right-4 bg-black/80 border border-white/20 px-4 py-2 rounded text-sm text-white hover:bg-black/90 transition-colors"
                    onClick={(e) => { e.stopPropagation(); skipSeconds(90); }}
                >
                    Skip Intro →
                </button>
            )}

            {/* Controls overlay */}
            <div
                className={cn(
                    'absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-transparent to-transparent transition-opacity duration-300',
                    showControls ? 'opacity-100' : 'opacity-0 pointer-events-none',
                )}
                onClick={e => e.stopPropagation()}
            >
                {/* Chapter markers on progress bar */}
                {chapters.length > 0 && (
                    <div className="absolute bottom-14 left-4 right-4 flex">
                        {chapters.map((chapter) => {
                            const pos = (chapter.startTime / duration) * 100;
                            return (
                                <div
                                    key={chapter.startTime}
                                    className="absolute w-0.5 h-2 bg-white/60 bottom-0"
                                    style={{ left: `${pos}%` }}
                                    title={chapter.title}
                                />
                            );
                        })}
                    </div>
                )}

                {/* Progress bar */}
                <div
                    ref={progressRef}
                    className="mx-4 mb-2 h-1.5 bg-white/20 rounded-full cursor-pointer group/bar hover:h-3 transition-all"
                    onClick={handleSeek}
                >
                    {/* Buffered */}
                    <div
                        className="absolute h-full bg-white/30 rounded-full"
                        style={{ width: `${bufferedProgress}%` }}
                    />
                    {/* Played */}
                    <div
                        className="h-full bg-red-500 rounded-full relative"
                        style={{ width: `${progress}%` }}
                    >
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                    </div>
                </div>

                {/* Bottom controls */}
                <div className="flex items-center gap-3 px-4 pb-3">
                    {/* Play/Pause */}
                    <button onClick={togglePlay} className="text-white hover:text-red-400 transition-colors">
                        {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                    </button>

                    {/* Skip back/forward */}
                    <button onClick={() => skipSeconds(-10)} className="text-white/70 hover:text-white">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button onClick={() => skipSeconds(10)} className="text-white/70 hover:text-white">
                        <ChevronRight className="w-5 h-5" />
                    </button>

                    {/* Volume */}
                    <div className="flex items-center gap-2">
                        <button onClick={toggleMute} className="text-white hover:text-red-400 transition-colors">
                            {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                        </button>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={isMuted ? 0 : volume}
                            onChange={e => {
                                const video = videoRef.current;
                                if (!video) return;
                                video.volume = parseFloat(e.target.value);
                                video.muted = false;
                            }}
                            className="w-20 accent-red-500 cursor-pointer"
                        />
                    </div>

                    {/* Time display */}
                    <span className="text-sm text-white/80 tabular-nums">
                        {formatDuration(currentTime)} / {formatDuration(duration)}
                    </span>

                    <div className="flex-1" />

                    {/* Quality selector */}
                    <QualitySelector
                        current={currentQuality}
                        options={availableQualities}
                        onChange={handleQualityChange}
                    />

                    {/* Playback speed */}
                    <select
                        value={playbackRate}
                        onChange={e => {
                            const rate = parseFloat(e.target.value);
                            if (videoRef.current) videoRef.current.playbackRate = rate;
                            setPlaybackRate(rate);
                        }}
                        className="bg-transparent text-white text-sm border border-white/20 rounded px-1 cursor-pointer"
                        onClick={e => e.stopPropagation()}
                    >
                        {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map(r => (
                            <option key={r} value={r} className="bg-zinc-900">
                                {r === 1 ? 'Normal' : `${r}x`}
                            </option>
                        ))}
                    </select>

                    {/* PiP */}
                    <button onClick={togglePiP} className="text-white/70 hover:text-white transition-colors">
                        <PictureInPicture2 className="w-5 h-5" />
                    </button>

                    {/* Fullscreen */}
                    <button onClick={toggleFullscreen} className="text-white hover:text-red-400 transition-colors">
                        {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
