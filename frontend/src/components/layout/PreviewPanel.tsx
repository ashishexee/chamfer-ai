import { useRef, useState, useEffect, useCallback } from "react";
import { Eye, Loader2, X } from "lucide-react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { STLModel } from "@/components/cad/STLModel";
import { AxisLines } from "@/components/cad/AxisLines";
import { ViewportHUD } from "@/components/cad/ViewportHUD";
import { ProgressiveFluxLoader } from "@/components/ui/progressive-flux-loader";
import { PARAM_PHASES } from "@/lib/constants";
import { useViewPresets } from "@/hooks/useViewPresets";
import { cn } from "@/lib/utils";
import type { ViewPresetId } from "@/lib/constants";

interface PreviewPanelProps {
  stlUrl: string | null;
  paramUpdateKey: number;
  isParamUpdating: boolean;
  isCollapsed?: boolean;
  /** When set, the viewport shows a stored iteration instead of the working model. */
  previewStlUrl?: string | null;
  previewLabel?: string | null;
  previewLoading?: boolean;
  /** False when the previewed version is already the active one. */
  previewCanGoBack?: boolean;
  onExitPreview?: () => void;
  onGoBack?: () => void;
}

function CanvasSetup({
  onReady,
}: {
  onReady: (camera: THREE.Camera, controls: OrbitControlsImpl) => void;
}) {
  const { camera } = useThree();
  const controls = useThree(
    (state) => state.controls,
  ) as OrbitControlsImpl | null;
  useEffect(() => {
    if (camera && controls) onReady(camera, controls);
  }, [camera, controls, onReady]);
  return null;
}

function ViewTracker({ onChange }: { onChange: (id: ViewPresetId) => void }) {
  const lastRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const { camera } = useThree();
  useFrame(() => {
    const dist = camera.position.distanceTo(lastRef.current);
    if (dist > 0.5) {
      lastRef.current.copy(camera.position);
      const dir = camera.position.clone().normalize();
      const ax = Math.abs(dir.x),
        ay = Math.abs(dir.y),
        az = Math.abs(dir.z);
      let id: ViewPresetId;
      if (ax < 0.3 && ay < 0.3) id = "iso";
      else if (ay > ax && ay > az) id = dir.y > 0 ? "top" : "bottom";
      else if (ax > az) id = dir.x > 0 ? "right" : "left";
      else id = dir.z > 0 ? "front" : "back";
      onChange(id);
    }
  });
  return null;
}

export function PreviewPanel({
  stlUrl,
  paramUpdateKey,
  isParamUpdating,
  isCollapsed,
  previewStlUrl,
  previewLabel,
  previewLoading,
  previewCanGoBack = true,
  onExitPreview,
  onGoBack,
}: PreviewPanelProps) {
  const cameraRef = useRef<THREE.Camera | null>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [axesVisible, setAxesVisible] = useState(true);
  const [activeView, setActiveView] = useState<ViewPresetId>("iso");
  const [bounds, setBounds] = useState<THREE.Sphere | null>(null);
  const hasAutoFitted = useRef(false);

  // A preview swap (in or out) is a new model — drop the old bounds and re-fit
  // once the new mesh reports its own, so we never fit to a stale radius.
  const prevPreviewRef = useRef<string | null>(null);
  const previewActive = previewLabel != null;
  const effectiveStlUrl = previewActive ? (previewStlUrl ?? null) : stlUrl;
  useEffect(() => {
    const next = previewStlUrl ?? null;
    if (prevPreviewRef.current !== next) {
      prevPreviewRef.current = next;
      hasAutoFitted.current = false;
      setBounds(null);
    }
  }, [previewStlUrl]);

  const { animateTo, fitToView, resetCamera } = useViewPresets(
    cameraRef,
    controlsRef,
    isParamUpdating,
  );

  const handleReady = useCallback(
    (camera: THREE.Camera, controls: OrbitControlsImpl) => {
      cameraRef.current = camera;
      controlsRef.current = controls;
    },
    [],
  );

  const handleBoundsReady = useCallback(
    (sphere: THREE.Sphere) => {
      setBounds(sphere);
    },
    [],
  );

  // Auto-fit camera only on first load, not on subsequent param updates
  useEffect(() => {
    if (!effectiveStlUrl || !bounds || !controlsRef.current || !cameraRef.current || isParamUpdating) {
      return;
    }
    if (hasAutoFitted.current) return;
    hasAutoFitted.current = true;
    const timeout = setTimeout(() => {
      fitToView(bounds.radius);
    }, 100);
    return () => clearTimeout(timeout);
  }, [effectiveStlUrl, bounds, isParamUpdating, fitToView]);

  const handleFit = useCallback(() => {
    const r = bounds?.radius ?? 30;
    fitToView(r);
  }, [fitToView, bounds]);

  return (
    <div className="flex-1 flex h-full w-full items-center justify-center bg-[#1C1C1C] relative overflow-hidden">
      {/* Content layer — hidden when collapsed */}
      <div className={cn("absolute inset-0", isCollapsed && "invisible")}>
        <Canvas
          key="main-canvas"
          camera={{ position: [30, 30, 30], fov: 30 }}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          className="w-full h-full"
          style={{ touchAction: 'none' }}
        >
          <CanvasSetup onReady={handleReady} />
          <ViewTracker onChange={setActiveView} />

          <color attach="background" args={["#1C1C1C"]} />
          <fog attach="fog" args={["#1C1C1C", 800, 100000000]} />

          <ambientLight intensity={0.45} />
          <directionalLight
            position={[50, 80, 50]}
            intensity={1.1}
          />
          <directionalLight position={[-50, 30, -40]} intensity={0.5} />
          <directionalLight position={[0, -20, -30]} intensity={0.15} />

          {axesVisible && <AxisLines />}
          {effectiveStlUrl && (
            <STLModel
              key={`${effectiveStlUrl}-${paramUpdateKey}`}
              url={effectiveStlUrl}
              updating={isParamUpdating}
              onBoundsReady={handleBoundsReady}
            />
          )}
          <OrbitControls
            enableDamping
            dampingFactor={0.1}
            zoomSpeed={0.4}
            enableRotate
            enablePan
            enableZoom
            makeDefault
          />
        </Canvas>

        <div className="absolute inset-0 vignette" />

        {!effectiveStlUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-2xl glass-hud flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-adam-text-tertiary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9"
                />
              </svg>
            </div>
            <span className="text-sm text-adam-text-secondary">
              Send a message to start creating
            </span>
          </div>
        )}

        {isParamUpdating && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 glass-hud rounded-xl px-6 py-3 w-80 pointer-events-none">
            <ProgressiveFluxLoader
              phases={PARAM_PHASES}
              showLabel
              className="gap-3"
              barClassName="h-2"
              textClassName="text-sm"
            />
          </div>
        )}

        {/* Preview banner — the working model is untouched until "Go back".
            Also shown while the 0G fetch is in flight so the click has feedback. */}
        {(previewActive || previewLoading) && (
          <div className="absolute left-1/2 top-4 z-20 flex max-w-[92%] -translate-x-1/2 items-center gap-2 rounded-xl border border-amber-400/20 bg-adam-bg-secondary-dark/95 px-3 py-2 shadow-lg backdrop-blur-md">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-amber-400/20">
              <Eye className="h-3 w-3" />
              {previewLabel || (previewLoading ? "Loading preview…" : "Preview")}
            </span>
            {previewActive && (
              <span className="hidden text-[11px] text-adam-text-tertiary sm:inline">
                Working model unchanged
              </span>
            )}
            {previewLoading && <Loader2 className="h-3 w-3 animate-spin text-amber-300" />}
            {previewActive && previewCanGoBack && (
              <button
                type="button"
                onClick={onGoBack}
                className="rounded-lg bg-amber-400/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-400/20 transition-colors hover:bg-amber-400/25"
              >
                Go back to this iteration
              </button>
            )}
            <button
              type="button"
              onClick={onExitPreview}
              aria-label="Exit preview"
              className="rounded-md p-1 text-adam-text-tertiary transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <ViewportHUD
          activeView={activeView}
          onSelectView={animateTo}
          onFit={handleFit}
          onReset={resetCamera}
          axesVisible={axesVisible}
          onToggleAxes={() => setAxesVisible((v) => !v)}
          hasModel={!!effectiveStlUrl}
        />
      </div>
    </div>
  );
}
