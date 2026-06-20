import { CheckCircle, AlertTriangle, XCircle, Ruler, Eye, EyeOff } from 'lucide-react';
import type { InspectionData } from '@/types';

interface InspectionPanelProps {
  inspection: InspectionData;
}

export function InspectionPanel({ inspection }: InspectionPanelProps) {
  const hasErrors = inspection.errors && inspection.errors.length > 0;
  const hasWarnings = inspection.warnings && inspection.warnings.length > 0;
  const allClear = inspection.all_clear || (!hasErrors && !hasWarnings);

  // Vision inspection status
  const visionChecking = (inspection as any).visionChecking;
  const visionVerified = (inspection as any).visionVerified;
  const visionFeedback = (inspection as any).visionFeedback;
  const hasVision = visionVerified !== undefined || visionChecking;

  const statusIcon = hasErrors
    ? <XCircle className="h-3.5 w-3.5 text-red-400" />
    : hasWarnings
    ? <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
    : <CheckCircle className="h-3.5 w-3.5 text-green-400" />;

  const statusText = hasErrors
    ? 'Issues Found'
    : hasWarnings
    ? 'Warnings'
    : 'All Checks Passed';

  return (
    <div className="p-4 border-b border-adam-neutral-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-adam-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
          <Ruler className="h-3 w-3" /> Inspection
        </h3>
        <div className="flex items-center gap-1.5">
          {statusIcon}
          <span className="text-[10px] text-adam-text-tertiary">{statusText}</span>
        </div>
      </div>

      {/* Geometry Stats */}
      {inspection.bounding_box?.size && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          <Stat label="Dimensions" value={`${inspection.bounding_box.size.map(s => s.toFixed(0)).join('x')}mm`} />
          <Stat label="Volume" value={`${(inspection.volume || 0).toFixed(1)}mm³`} />
          <Stat label="Faces" value={String(inspection.face_count || 0)} />
          <Stat label="Edges" value={String(inspection.edge_count || 0)} />
          <Stat label="Shape" value={inspection.shape_type || 'unknown'} />
          <Stat label="Valid" value={inspection.is_valid ? 'Yes' : 'No'} valueClass={inspection.is_valid ? 'text-green-400' : 'text-red-400'} />
        </div>
      )}

      {/* Errors */}
      {hasErrors && (
        <div className="space-y-1 mb-2">
          {inspection.errors!.map((err, i) => (
            <div key={i} className="text-[10px] text-red-400 bg-red-500/10 rounded-md px-2 py-1.5 flex items-start gap-1.5">
              <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{err}</span>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {hasWarnings && (
        <div className="space-y-1">
          {inspection.warnings!.map((warn, i) => (
            <div key={i} className="text-[10px] text-yellow-400 bg-yellow-500/10 rounded-md px-2 py-1.5 flex items-start gap-1.5">
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{warn}</span>
            </div>
          ))}
        </div>
      )}

      {/* All clear */}
      {allClear && inspection.bounding_box?.size && !hasVision && (
        <div className="text-[10px] text-green-400 bg-green-500/10 rounded-md px-2 py-1.5 flex items-center gap-1.5">
          <CheckCircle className="h-3 w-3" />
          <span>Valid watertight solid — all geometry checks passed</span>
        </div>
      )}

      {/* Vision inspection status */}
      {hasVision && (
        <div className="mt-2 space-y-1.5">
          {visionChecking && (
            <div className="text-[10px] text-adam-blue bg-adam-blue/10 rounded-md px-2 py-1.5 flex items-center gap-1.5">
              <Eye className="h-3 w-3 animate-pulse" />
              <span>Visually inspecting rendered model...</span>
            </div>
          )}
          {visionVerified && !visionChecking && (
            <div className="text-[10px] text-green-400 bg-green-500/10 rounded-md px-2 py-1.5 flex items-center gap-1.5">
              <Eye className="h-3 w-3" />
              <span>Vision-verified — model matches request</span>
            </div>
          )}
          {visionVerified === false && !visionChecking && (
            <div className="text-[10px] text-yellow-400 bg-yellow-500/10 rounded-md px-2 py-1.5 flex items-start gap-1.5">
              <EyeOff className="h-3 w-3 mt-0.5 shrink-0" />
              <span>{visionFeedback || 'Vision check found issues — self-correcting...'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-adam-bg-dark rounded-md px-2 py-1.5">
      <div className="text-[9px] text-adam-text-tertiary uppercase tracking-wider">{label}</div>
      <div className={`text-xs text-adam-text-primary font-medium ${valueClass || ''}`}>{value}</div>
    </div>
  );
}
