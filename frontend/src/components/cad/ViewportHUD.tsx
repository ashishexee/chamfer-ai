import { Maximize2, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewPresetId } from '@/lib/constants';

interface ViewportHUDProps {
  activeView: ViewPresetId;
  onSelectView: (id: ViewPresetId) => void;
  onFit: () => void;
  onReset: () => void;
  axesVisible: boolean;
  onToggleAxes: () => void;
  hasModel: boolean;
}

// Wedge SVG segments arranged like a die — centered isometric disc + 6 outer faces.
// The 7 faces are clickable to switch camera view.
const FACE_DEFS: Array<{ id: ViewPresetId; label: string; path: string; viewBox?: string }> = [
  // Top wedge
  { id: 'top',    label: 'Top',    path: 'M40,14 L66,30 L40,46 L14,30 Z' },
  // Right wedge
  { id: 'right',  label: 'Right',  path: 'M66,30 L66,70 L40,86 L40,46 Z' },
  // Bottom wedge
  { id: 'bottom', label: 'Bot',    path: 'M40,46 L66,70 L40,94 L14,70 Z' },
  // Left wedge
  { id: 'left',   label: 'Left',   path: 'M14,30 L40,46 L40,86 L14,70 Z' },
  // Front wedge (lower-left in iso)
  { id: 'front',  label: 'Front',  path: 'M40,14 L40,46 L14,30 Z' },
  // Back wedge (lower-right)
  { id: 'back',   label: 'Back',   path: 'M40,14 L66,30 L40,46 Z' },
];

export function ViewportHUD({
  activeView,
  onSelectView,
  onFit,
  onReset,
  axesVisible,
  onToggleAxes,
  hasModel,
}: ViewportHUDProps) {
  return (
    <>
      {/* ─── Top-right: ViewCube + XYZ legend ─── */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5 pointer-events-none">
        <div className="glass-hud pointer-events-auto select-none">
          <svg viewBox="0 0 80 108" width="56" height="76" className="block">
            {FACE_DEFS.map(f => {
              const isActive = activeView === f.id;
              return (
                <g key={f.id} onClick={() => onSelectView(f.id)} className="cursor-pointer">
                  <path
                    d={f.path}
                    fill={isActive ? '#00A6FF' : 'rgba(255,255,255,0.04)'}
                    stroke={isActive ? '#00A6FF' : 'rgba(255,255,255,0.18)'}
                    strokeWidth="0.8"
                    className="transition-colors duration-150 hover:fill-[#00A6FF]/40"
                  />
                </g>
              );
            })}
            {/* Iso center dot */}
            <circle
              cx="40"
              cy="54"
              r="3.5"
              fill={activeView === 'iso' ? '#00A6FF' : 'rgba(255,255,255,0.25)'}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="0.6"
              onClick={() => onSelectView('iso')}
              className="cursor-pointer transition-colors duration-150 hover:fill-[#00A6FF]/40"
            />
          </svg>
        </div>

        {/* XYZ legend */}
        <div className="glass-hud pointer-events-auto px-2 py-1.5 flex flex-col gap-0.5 select-none">
          <div className="flex items-center gap-2 text-[10px] font-semibold text-adam-text-primary">
            <span className="inline-block w-2.5 h-0.5 rounded-full" style={{ background: '#E34D4D' }} />
            <span style={{ color: '#E34D4D' }}>X</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-adam-text-primary">
            <span className="inline-block w-2.5 h-0.5 rounded-full" style={{ background: '#7AB838' }} />
            <span style={{ color: '#7AB838' }}>Y</span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-semibold text-adam-text-primary">
            <span className="inline-block w-2.5 h-0.5 rounded-full" style={{ background: '#4D8FE3' }} />
            <span style={{ color: '#4D8FE3' }}>Z</span>
          </div>
        </div>
      </div>

      {/* ─── Bottom-right: toolbar ─── */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 pointer-events-none">
        <ToolbarButton onClick={onFit} disabled={!hasModel} title="Fit to view">
          <Maximize2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton onClick={onReset} title="Reset camera">
          <RotateCcw className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={onToggleAxes}
          active={axesVisible}
          title={axesVisible ? 'Hide grid + axes' : 'Show grid + axes'}
        >
          {axesVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </ToolbarButton>
      </div>
    </>
  );
}

function ToolbarButton({
  onClick,
  disabled,
  active,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'glass-hud pointer-events-auto h-8 w-8 flex items-center justify-center',
        'text-adam-text-secondary hover:text-adam-text-primary transition-colors',
        active && 'text-adam-blue',
        disabled && 'opacity-40 cursor-not-allowed hover:text-adam-text-secondary',
      )}
    >
      {children}
    </button>
  );
}
