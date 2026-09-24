import { CheckCircle, AlertTriangle, XCircle, Eye, EyeOff } from 'lucide-react';
import type { InspectionData } from '@/types';

interface InspectionPanelProps {
  inspection: InspectionData;
}

function formatVolume(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toFixed(1);
}

export function InspectionPanel({ inspection }: InspectionPanelProps) {
  const hasErrors = inspection.errors && inspection.errors.length > 0;
  const hasWarnings = inspection.warnings && inspection.warnings.length > 0;
  const allClear = inspection.all_clear || (!hasErrors && !hasWarnings);

  const visionChecking = inspection.visionChecking;
  const visionVerified = inspection.visionVerified;
  const visionFeedback = inspection.visionFeedback;
  const hasVision = visionVerified !== undefined || visionChecking;

  const stats = [
    {
      label: 'Dimensions',
      value: inspection.bounding_box?.size
        ? `${inspection.bounding_box.size.map((s) => s.toFixed(0)).join('×')}mm`
        : '—',
    },
    { label: 'Volume', value: `${formatVolume(inspection.volume || 0)}mm³` },
    { label: 'Faces', value: String(inspection.face_count || 0) },
    { label: 'Edges', value: String(inspection.edge_count || 0) },
    { label: 'Shape', value: inspection.shape_type || 'unknown' },
    {
      label: 'Valid',
      value: inspection.is_valid ? 'Yes' : 'No',
      valueClass: inspection.is_valid ? 'text-emerald-400' : 'text-red-400',
    },
  ];

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Geometry spec grid — borderless, hairline-divided */}
      {inspection.bounding_box?.size && (
        <div className="grid grid-cols-3 overflow-hidden">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`py-1.5 ${i % 3 !== 0 ? 'border-l border-white/[0.05] pl-3' : ''} ${
                i >= 3 ? 'border-t border-white/[0.05] pb-1.5 pt-2.5' : 'pb-2.5'
              }`}
            >
              <div className="text-[9px] uppercase tracking-wider text-adam-text-tertiary">{s.label}</div>
              <div className={`truncate font-mono text-[12px] text-adam-text-primary ${s.valueClass || ''}`}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Errors */}
      {hasErrors && (
        <div className="space-y-1">
          {inspection.errors!.map((err, i) => (
            <div key={i} className="flex items-start gap-1.5 rounded-md bg-red-400/[0.07] px-2.5 py-1.5 text-[10px] text-red-400/95 ring-1 ring-red-400/10">
              <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {hasWarnings && (
        <div className="space-y-1">
          {inspection.warnings!.map((warn, i) => (
            <div key={i} className="flex items-start gap-1.5 rounded-md bg-yellow-400/[0.07] px-2.5 py-1.5 text-[10px] text-yellow-400/95 ring-1 ring-yellow-400/10">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      {/* All clear */}
      {allClear && inspection.bounding_box?.size && !hasVision && (
        <div className="flex items-center gap-1.5 rounded-md bg-emerald-400/[0.06] px-2.5 py-1.5 text-[10px] text-emerald-400/90 ring-1 ring-emerald-400/10">
          <CheckCircle className="h-3 w-3" />
          <span>Valid watertight solid — all geometry checks passed</span>
        </div>
      )}

      {/* Vision inspection status */}
      {hasVision && (
        <div className="space-y-1.5">
          {visionChecking && (
            <div className="flex items-center gap-1.5 rounded-md bg-adam-blue/[0.07] px-2.5 py-1.5 text-[10px] text-adam-blue ring-1 ring-adam-blue/10">
              <Eye className="h-3 w-3 animate-pulse" />
              <span>Visually inspecting rendered model...</span>
            </div>
          )}
          {visionVerified && !visionChecking && (
            <div className="flex items-center gap-1.5 rounded-md bg-emerald-400/[0.06] px-2.5 py-1.5 text-[10px] text-emerald-400/90 ring-1 ring-emerald-400/10">
              <Eye className="h-3 w-3" />
              <span>Vision-verified — model matches request</span>
            </div>
          )}
          {visionVerified === false && !visionChecking && (
            <div className="flex items-start gap-1.5 rounded-md bg-yellow-400/[0.07] px-2.5 py-1.5 text-[10px] text-yellow-400/95 ring-1 ring-yellow-400/10">
              <EyeOff className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{visionFeedback || 'Vision check found issues — self-correcting...'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
