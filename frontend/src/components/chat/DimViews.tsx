import { useState } from 'react';
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

  if (entries.length === 0 && !hasError) return null;

  return (
    <>
      <div className="mt-3 rounded-xl border border-adam-neutral-700/40 bg-[#1a1a1a]/60 overflow-hidden">
        <div className="px-3 py-2 border-b border-adam-neutral-700/30 bg-[#1e1e1e]/50">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-adam-text-tertiary uppercase tracking-[0.1em]">Dimensional Views</span>
            <span className="text-[9px] text-adam-text-tertiary">{entries.length} views</span>
          </div>
        </div>

        {hasError && (
          <div className="px-3 py-2 text-[10px] text-red-400 flex items-center gap-1.5">
            <AlertCircle className="h-3 w-3" />
            {dimViews.error || dimViews.Error}
          </div>
        )}

        <div className="p-2 grid grid-cols-3 gap-1.5">
          {entries.map(([view, b64]) => (
            <button
              key={view}
              onClick={() => setSelected(view)}
              className="group relative rounded-lg overflow-hidden border border-adam-neutral-700/40 bg-adam-bg-dark/50 hover:border-adam-blue/50 transition-colors"
            >
              <img
                src={dataUrl(b64)}
                alt={`${VIEW_LABELS[view] || view} view`}
                className="w-full h-24 object-contain"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <Maximize2 className="h-3.5 w-3.5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="text-center text-[8px] text-adam-text-tertiary py-0.5 uppercase tracking-wider bg-[#1e1e1e]/80">
                {VIEW_LABELS[view] || view}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox modal */}
      {selected && dimViews[selected] && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] rounded-2xl border border-adam-neutral-700 bg-[#1a1a1a] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-adam-neutral-700/50">
              <span className="text-sm font-medium text-adam-text-primary">
                {VIEW_LABELS[selected] || selected} View
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={dataUrl(dimViews[selected])}
                  download={`dim_${selected}.png`}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-adam-text-tertiary hover:text-adam-text-secondary transition-colors"
                >
                  <Download className="h-4 w-4" />
                </a>
                <button
                  onClick={() => setSelected(null)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-adam-text-tertiary hover:text-adam-text-secondary transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="p-4 flex items-center justify-center max-h-[75vh]">
              <img
                src={dataUrl(dimViews[selected])}
                alt={`${VIEW_LABELS[selected] || selected} view`}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
