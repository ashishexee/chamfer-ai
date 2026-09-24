import { useEffect, useState } from 'react';

// 3×3 pixel-grid loader — "Drive" chevron wavefront from Beautiful UI's
// loading-state primitive. Cells light up left-to-right with a chevron
// offset; the 1400ms cycle is shorter than the sweep so two fronts overlap.
const DELAYS = Array.from({ length: 9 }, (_, i) => {
  const r = Math.floor(i / 3);
  const c = i % 3;
  return (c + Math.abs(r - 1)) * 180;
});

function useElapsed() {
  // Whole seconds, ticking once per second — the 100ms tenths counter
  // flickered too fast to read
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

interface PixelLoaderProps {
  /** When omitted, renders the bare 3×3 grid without label or timer. */
  label?: string;
}

/**
 * Pixel-grid loader restyled to the adam palette (blue cells). With a
 * label it also shows the shimmering text and live elapsed timer.
 */
export function PixelLoader({ label }: PixelLoaderProps) {
  const elapsed = useElapsed();

  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span aria-hidden className="grid shrink-0 grid-cols-3 gap-[1.5px]">
        {DELAYS.map((d, i) => (
          <span
            key={i}
            className="h-[4px] w-[4px] rounded-[1px] bg-adam-blue"
            style={{
              opacity: 0.15,
              animation: `pixel-on 1400ms ease-in-out ${d}ms infinite`,
            }}
          />
        ))}
      </span>
      {label && (
        <>
          <span
            className="bg-clip-text text-[13px] font-medium text-transparent"
            style={{
              backgroundImage:
                'linear-gradient(90deg, #676767 35%, #E5E5E5 50%, #676767 65%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer-text 1.4s linear infinite',
            }}
          >
            {label}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-adam-text-tertiary tabular-nums">
            {elapsed}
          </span>
        </>
      )}
    </div>
  );
}
