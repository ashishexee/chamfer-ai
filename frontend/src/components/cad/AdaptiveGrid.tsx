import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Grid } from '@react-three/drei';
import type { GridHelper } from 'three';

export function AdaptiveGrid() {
  const gridRef = useRef<GridHelper | null>(null);
  const { camera } = useThree();

  useFrame(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const dist = camera.position.length();
    let cellSize: number;
    let sectionSize: number;
    if (dist < 50) {
      cellSize = 1;
      sectionSize = 10;
    } else if (dist < 200) {
      cellSize = 5;
      sectionSize = 50;
    } else {
      cellSize = 20;
      sectionSize = 200;
    }
    grid.cellSize = cellSize;
    grid.sectionSize = sectionSize;
    const mat = grid.material as { transparent?: boolean; opacity?: number; fadeDistance?: number };
    mat.fadeDistance = dist * 1.6;
  });

  return (
    <Grid
      ref={gridRef}
      args={[200, 200]}
      cellColor="#2A2A2A"
      sectionColor="#525252"
      cellThickness={0.5}
      sectionThickness={1}
      infiniteGrid
    />
  );
}
