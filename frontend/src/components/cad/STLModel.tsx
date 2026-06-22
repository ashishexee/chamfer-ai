import { useRef, useEffect } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

interface STLModelProps {
  url: string;
  updating: boolean;
  onBoundsReady?: (sphere: THREE.Sphere) => void;
}

export function STLModel({ url, updating, onBoundsReady }: STLModelProps) {
  const geometry = useLoader(STLLoader, url);
  const ref = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const reportedRef = useRef(false);

  useEffect(() => {
    if (ref.current && geometry) {
      geometry.computeVertexNormals();
      const box = new THREE.Box3().setFromBufferAttribute(geometry.attributes.position as THREE.BufferAttribute);
      const center = box.getCenter(new THREE.Vector3());
      geometry.translate(-center.x, -center.y, -center.z);
      if (!reportedRef.current && onBoundsReady) {
        const sphere = new THREE.Sphere();
        box.setFromBufferAttribute(geometry.attributes.position as THREE.BufferAttribute);
        box.getBoundingSphere(sphere);
        const centered = new THREE.Sphere(new THREE.Vector3(0, 0, 0), sphere.radius);
        onBoundsReady(centered);
        reportedRef.current = true;
      }
    }
  }, [geometry, onBoundsReady, camera]);

  return (
    <mesh ref={ref} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color="#A8A8A8"
        metalness={0.55}
        roughness={0.35}
        emissive="#1a1a1a"
        emissiveIntensity={0.12}
        transparent={updating}
        opacity={updating ? 0.4 : 1}
      />
    </mesh>
  );
}
