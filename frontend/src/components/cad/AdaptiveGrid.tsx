import { useState, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Grid } from '@react-three/drei';

function getGridParams(distance: number) {
  if (distance < 50) return { cell: 5, section: 50 };
  if (distance < 200) return { cell: 25, section: 250 };
  return { cell: 100, section: 1000 };
}

export function AdaptiveGrid() {
  const { camera } = useThree();
  const [gridParams, setGridParams] = useState(() => getGridParams(camera.position.length()));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFrame(() => {
    const dist = camera.position.length();
    const target = getGridParams(dist);

    // Only update if threshold crossed
    if (target.cell !== gridParams.cell) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setGridParams(target);
      }, 80);
    }
  });

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <Grid
      args={[200, 200]}
      cellSize={gridParams.cell}
      sectionSize={gridParams.section}
      cellColor="#2A2A2A"
      sectionColor="#525252"
      cellThickness={0.5}
      sectionThickness={1}
      infiniteGrid
      fadeDistance={400}
    />
  );
}
