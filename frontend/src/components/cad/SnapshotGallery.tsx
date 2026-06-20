import { useState } from 'react';
import { Camera, Eye } from 'lucide-react';

interface SnapshotGalleryProps {
  snapshots: Record<string, string>;
}

export function SnapshotGallery({ snapshots }: SnapshotGalleryProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const entries = Object.entries(snapshots).filter(([_, svg]) => svg && !svg.includes('error'));

  if (entries.length === 0) return null;

  const viewLabels: Record<string, string> = {
    iso: 'Isometric',
    top: 'Top',
    front: 'Front',
    right: 'Right',
    back: 'Back',
    left: 'Left',
  };

  return (
    <div className="p-4 border-b border-adam-neutral-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-adam-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
          <Camera className="h-3 w-3" /> Snapshots
        </h3>
        <span className="text-[10px] text-adam-text-tertiary">{entries.length} views</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {entries.map(([view, svg]) => (
          <button
            key={view}
            onClick={() => setSelected(view)}
            className="relative group rounded-lg overflow-hidden border border-adam-neutral-700 bg-adam-bg-dark hover:border-adam-blue transition-colors"
          >
            <div
              className="w-full h-20 flex items-center justify-center"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-adam-bg-dark/90 to-transparent px-1.5 py-0.5">
              <span className="text-[9px] text-adam-text-tertiary font-medium">{viewLabels[view] || view}</span>
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
          onClick={() => setSelected(null)}
        >
          <div className="relative max-w-4xl max-h-full bg-adam-bg-secondary-dark rounded-xl p-4 border border-adam-neutral-700">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-adam-text-primary flex items-center gap-1.5">
                <Eye className="h-4 w-4" /> {viewLabels[selected] || selected} View
              </span>
              <button
                onClick={() => setSelected(null)}
                className="text-adam-text-tertiary hover:text-adam-text-primary text-sm"
              >
                Close
              </button>
            </div>
            <div
              className="bg-adam-bg-dark rounded-lg p-4 max-h-[70vh] overflow-auto"
              dangerouslySetInnerHTML={{ __html: snapshots[selected] }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
