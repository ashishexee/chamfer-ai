import { useRef, useState, useEffect, useCallback } from "react";
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
  provider: string;
  isCollapsed?: boolean;
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
  provider,
  isCollapsed,
}: PreviewPanelProps) {
  const cameraRef = useRef<THREE.Camera | null>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const [axesVisible, setAxesVisible] = useState(true);
  const [activeView, setActiveView] = useState<ViewPresetId>("iso");
  const [bounds, setBounds] = useState<THREE.Sphere | null>(null);

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

  // Auto-fit camera once both refs and bounds are ready
  useEffect(() => {
    if (!stlUrl || !bounds || !controlsRef.current || !cameraRef.current || isParamUpdating) {
      return;
    }
    const timeout = setTimeout(() => {
      fitToView(bounds.radius);
    }, 100);
    return () => clearTimeout(timeout);
  }, [stlUrl, bounds, isParamUpdating, fitToView]);

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
          shadows
          className="w-full h-full"
        >
          <CanvasSetup onReady={handleReady} />
          <ViewTracker onChange={setActiveView} />

          <color attach="background" args={["#1C1C1C"]} />
          <fog attach="fog" args={["#1C1C1C", 800, 100000000]} />

          <ambientLight intensity={0.45} />
          <directionalLight
            position={[50, 80, 50]}
            intensity={1.1}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <directionalLight position={[-50, 30, -40]} intensity={0.5} />
          <directionalLight position={[0, -20, -30]} intensity={0.15} />

          {axesVisible && <AxisLines />}
          {stlUrl && (
            <STLModel
              key={`${stlUrl}-${paramUpdateKey}`}
              url={stlUrl}
              updating={isParamUpdating}
              onBoundsReady={handleBoundsReady}
            />
          )}
          {stlUrl && axesVisible && bounds && (
            <ContactShadows
              position={[0, -0.001, 0]}
              opacity={0.55}
              scale={bounds.radius * 3.5}
              blur={2.2}
              far={bounds.radius * 1.5}
              resolution={256}
              color="#000000"
            />
          )}
          <OrbitControls enableDamping dampingFactor={0.1} zoomSpeed={0.4} makeDefault />
        </Canvas>

        <div className="absolute inset-0 vignette" />

        {!stlUrl && (
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

        {stlUrl && (
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <div className="glass-hud rounded-lg px-3 py-1.5 text-[10px] text-adam-text-secondary">
              Generated by {provider}
            </div>
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

        <ViewportHUD
          activeView={activeView}
          onSelectView={animateTo}
          onFit={handleFit}
          onReset={resetCamera}
          axesVisible={axesVisible}
          onToggleAxes={() => setAxesVisible((v) => !v)}
          hasModel={!!stlUrl}
        />
      </div>
    </div>
  );
}
