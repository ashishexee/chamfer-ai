import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, X, Download, AlertCircle } from 'lucide-react';

interface DimViewsProps {
  dimViews: Record<string, string>;
}

const VIEW_ORDER = ['top', 'front', 'side'];
const VIEW_LABELS: Record<string, string> = {
  top: 'Top',
  front: 'Front',
  side: 'Side',
};

export function DimViews({ dimViews }: DimViewsProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const entries = VIEW_ORDER
    .filter(v => dimViews[v])
    .map(v => [v, dimViews[v]] as [string, string]);

  const hasError = dimViews.error || dimViews.Error;
  const dataUrl = (b64: string) => `data:image/png;base64,${b64}`;

  // Escape closes the lightbox from anywhere.
  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  if (entries.length === 0 && !hasError) return null;

  return (
    <>
      <div className="mt-3 overflow-hidden rounded-xl border border-white/[0.05] bg-[#202020]">
        <div className="border-b border-white/[0.04] bg-white/[0.02] px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-adam-text-tertiary">
              Dimensional Views
            </span>
            <span className="text-[9px] text-adam-text-tertiary">{entries.length} views</span>
          </div>
        </div>

        {hasError && (
          <div className="flex items-center gap-1.5 px-3 py-2 text-[10px] text-red-400">
            <AlertCircle className="h-3 w-3" />
            {dimViews.error || dimViews.Error}
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5 p-2">
          {entries.map(([view, b64]) => (
            <button
              key={view}
              type="button"
              onClick={() => setSelected(view)}
              className="group relative overflow-hidden rounded-lg border border-white/[0.05] bg-[#171717] transition-colors hover:border-adam-accent/50"
              aria-label={`Open ${VIEW_LABELS[view] || view} view`}
            >
              <img
                src={dataUrl(b64)}
                alt={`${VIEW_LABELS[view] || view} view`}
                className="h-24 w-full object-contain"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                <Maximize2 className="h-3.5 w-3.5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="bg-[#202020]/90 py-0.5 text-center text-[8px] uppercase tracking-wider text-adam-text-tertiary">
                {VIEW_LABELS[view] || view}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox — portaled to body so it covers the whole window, not the
          transformed/animated chat bubble that owns this component. */}
      {selected && dimViews[selected] && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={`${VIEW_LABELS[selected] || selected} view`}
          onClick={() => setSelected(null)}
        >
          <div
            className="relative max-h-[88vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-white/[0.08] bg-[#202020] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
              <span className="text-sm font-medium text-adam-text-primary">
                {VIEW_LABELS[selected] || selected} View
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={dataUrl(dimViews[selected])}
                  download={`dim_${selected}.png`}
                  aria-label={`Download ${VIEW_LABELS[selected] || selected} view`}
                  className="rounded-lg p-1.5 text-adam-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-adam-text-secondary"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Close"
                  className="rounded-lg p-1.5 text-adam-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-adam-text-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex max-h-[78vh] items-center justify-center p-4">
              <img
                src={dataUrl(dimViews[selected])}
                alt={`${VIEW_LABELS[selected] || selected} view`}
                className="max-h-[74vh] max-w-full rounded-lg object-contain"
              />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
