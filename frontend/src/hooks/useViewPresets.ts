import { useCallback, useEffect, useRef } from 'react';
import type { Camera } from 'three';
import type { OrbitControls } from 'three-stdlib';
import { VIEW_PRESETS, type ViewPresetId } from '@/lib/constants';

const TWEEN_MS = 320;

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function useViewPresets(
  cameraRef: React.MutableRefObject<Camera | null>,
  controlsRef: React.MutableRefObject<OrbitControls | null>,
  isParamUpdating: boolean,
) {
  const rafRef = useRef<number | null>(null);
  const startPos = useRef<[number, number, number] | null>(null);
  const endPos = useRef<[number, number, number] | null>(null);
  const startTarget = useRef<[number, number, number] | null>(null);
  const startTime = useRef(0);

  const cancel = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  const animateTo = useCallback((presetId: ViewPresetId) => {
    if (isParamUpdating) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const preset = VIEW_PRESETS.find(p => p.id === presetId);
    if (!camera || !controls || !preset) return;

    cancel();

    startPos.current = [camera.position.x, camera.position.y, camera.position.z];
    endPos.current = preset.position;
    const epsilonTarget: [number, number, number] =
      preset.position[2] === 0
        ? [0, 0, Math.sign(preset.position[0] || preset.position[1] || 1) * 0.001]
        : [0, 0, 0];
    startTarget.current = [controls.target.x, controls.target.y, controls.target.z];
    startTime.current = performance.now();

    const step = () => {
      const t = Math.min(1, (performance.now() - startTime.current) / TWEEN_MS);
      const k = easeOutCubic(t);
      const sp = startPos.current;
      const ep = endPos.current;
      const st = startTarget.current;
      if (!sp || !ep || !st) {
        rafRef.current = null;
        return;
      }
      camera.position.set(
        sp[0] + (ep[0] - sp[0]) * k,
        sp[1] + (ep[1] - sp[1]) * k,
        sp[2] + (ep[2] - sp[2]) * k,
      );
      controls.target.set(
        st[0] + (epsilonTarget[0] - st[0]) * k,
        st[1] + (epsilonTarget[1] - st[1]) * k,
        st[2] + (epsilonTarget[2] - st[2]) * k,
      );
      camera.lookAt(controls.target);
      controls.update();

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [cameraRef, controlsRef, isParamUpdating, cancel]);

  const fitToView = useCallback((boundingRadius: number) => {
    if (isParamUpdating) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;

    cancel();

    const targetDistance = Math.max(boundingRadius * 4.5, 60);
    const dir = camera.position.clone().sub(controls.target).normalize();
    if (dir.lengthSq() < 1e-6) dir.set(1, 1, 1).normalize();

    const endPosition = controls.target.clone().add(dir.multiplyScalar(targetDistance));
    startPos.current = [camera.position.x, camera.position.y, camera.position.z];
    endPos.current = [endPosition.x, endPosition.y, endPosition.z];
    startTarget.current = [controls.target.x, controls.target.y, controls.target.z];
    startTime.current = performance.now();

    const step = () => {
      const t = Math.min(1, (performance.now() - startTime.current) / TWEEN_MS);
      const k = easeOutCubic(t);
      const sp = startPos.current;
      const ep = endPos.current;
      if (!sp || !ep) {
        rafRef.current = null;
        return;
      }
      camera.position.set(
        sp[0] + (ep[0] - sp[0]) * k,
        sp[1] + (ep[1] - sp[1]) * k,
        sp[2] + (ep[2] - sp[2]) * k,
      );
      camera.lookAt(controls.target);
      controls.update();

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [cameraRef, controlsRef, isParamUpdating, cancel]);

  const resetCamera = useCallback(() => {
    if (isParamUpdating) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    const targetPos: [number, number, number] = [80, 80, 80];
    cancel();

    startPos.current = [camera.position.x, camera.position.y, camera.position.z];
    endPos.current = targetPos;
    startTarget.current = [controls.target.x, controls.target.y, controls.target.z];
    const endTarget: [number, number, number] = [0, 0, 0];
    startTime.current = performance.now();

    const step = () => {
      const t = Math.min(1, (performance.now() - startTime.current) / TWEEN_MS);
      const k = easeOutCubic(t);
      const sp = startPos.current;
      const ep = endPos.current;
      const st = startTarget.current;
      if (!sp || !ep || !st) {
        rafRef.current = null;
        return;
      }
      camera.position.set(
        sp[0] + (ep[0] - sp[0]) * k,
        sp[1] + (ep[1] - sp[1]) * k,
        sp[2] + (ep[2] - sp[2]) * k,
      );
      controls.target.set(
        st[0] + (endTarget[0] - st[0]) * k,
        st[1] + (endTarget[1] - st[1]) * k,
        st[2] + (endTarget[2] - st[2]) * k,
      );
      camera.lookAt(controls.target);
      controls.update();

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
  }, [cameraRef, controlsRef, isParamUpdating, cancel]);

  return { animateTo, fitToView, resetCamera };
}
