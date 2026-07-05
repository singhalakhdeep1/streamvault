'use client';

interface QualitySelectorProps {
  qualities: string[];
  current: string;
  onChange: (quality: string) => void;
  onClose: () => void;
}

export function QualitySelector({ qualities, current, onChange, onClose }: QualitySelectorProps) {
  const options = ['Auto', ...qualities];

  return (
    <div className="absolute bottom-16 right-4 z-50 min-w-[140px] rounded-lg bg-black/90 border border-zinc-700 py-1 shadow-xl">
      <p className="px-3 py-1.5 text-xs font-semibold text-zinc-400 uppercase tracking-wide">Quality</p>
      {options.map((q) => (
        <button
          key={q}
          type="button"
          onClick={() => {
            onChange(q);
            onClose();
          }}
          className={`w-full px-3 py-2 text-left text-sm hover:bg-zinc-800 ${
            current === q ? 'text-red-400 font-medium' : 'text-zinc-200'
          }`}
        >
          {q}
        </button>
      ))}
    </div>
  );
}
