'use client';

interface SubtitleTrack {
  language: string;
  label: string;
  url: string;
}

interface SubtitleSelectorProps {
  subtitles: SubtitleTrack[];
  active?: string;
  onChange: (language: string | null) => void;
  onClose: () => void;
}

export function SubtitleSelector({ subtitles, active, onChange, onClose }: SubtitleSelectorProps) {
  return (
    <div className="absolute bottom-16 right-4 z-50 min-w-[160px] rounded-lg bg-black/90 border border-zinc-700 py-1 shadow-xl">
      <p className="px-3 py-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Subtitles</p>
      <button
        type="button"
        onClick={() => { onChange(null); onClose(); }}
        className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-800 ${
          !active ? 'text-red-400 font-medium' : 'text-zinc-200'
        }`}
      >
        Off
      </button>
      {subtitles.map((s) => (
        <button
          key={s.language}
          type="button"
          onClick={() => { onChange(s.language); onClose(); }}
          className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-800 ${
            active === s.language ? 'text-red-400 font-medium' : 'text-zinc-200'
          }`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
