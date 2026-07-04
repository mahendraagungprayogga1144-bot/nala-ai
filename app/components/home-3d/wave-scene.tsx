"use client";
import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

function InfiniteGrid() {
  const ref = useRef<THREE.Points>(null);
  const count = 80;
  const positions = useMemo(() => {
    const arr = new Float32Array(count * count * 3);
    let i = 0;
    for (let x = 0; x < count; x++) {
      for (let z = 0; z < count; z++) {
        arr[i++] = (x - count / 2) * 0.3;
        arr[i++] = 0;
        arr[i++] = (z - count / 2) * 0.3;
      }
    }
    return arr;
  }, []);

  const colors = useMemo(() => {
    const arr = new Float32Array(count * count * 3);
    for (let i = 0; i < count * count; i++) {
      const t = Math.random();
      if (t < 0.33) { arr[i * 3] = 0.18; arr[i * 3 + 1] = 0.83; arr[i * 3 + 2] = 0.75; }
      else if (t < 0.66) { arr[i * 3] = 0.55; arr[i * 3 + 1] = 0.36; arr[i * 3 + 2] = 0.96; }
      else { arr[i * 3] = 0.93; arr[i * 3 + 1] = 0.29; arr[i * 3 + 2] = 0.6; }
    }
    return arr;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position;
    const t = state.clock.elapsedTime;
    let i = 0;
    for (let x = 0; x < count; x++) {
      for (let z = 0; z < count; z++) {
        const px = (x - count / 2) * 0.3;
        const pz = (z - count / 2) * 0.3;
        const dist = Math.sqrt(px * px + pz * pz);
        pos.array[i * 3 + 1] =
          Math.sin(dist * 0.4 - t * 1.2) * 0.5 +
          Math.sin(px * 0.3 + t * 0.8) * 0.3 +
          Math.cos(pz * 0.2 + t * 0.6) * 0.2;
        i++;
      }
    }
    pos.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.04} vertexColors transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

function EnergyBeams() {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.05;
    }
  });

  const beams = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * Math.PI * 2;
    const positions = new Float32Array([
      Math.cos(angle) * 3, -2, Math.sin(angle) * 3,
      Math.cos(angle + 0.5) * 8, 2, Math.sin(angle + 0.5) * 8,
    ]);
    return { positions, color: ["#2DD4BF", "#8B5CF6", "#EC4899"][i % 3] };
  }), []);

  return (
    <group ref={ref}>
      {beams.map((b, i) => (
        <lineSegments key={i}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[b.positions, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={b.color} transparent opacity={0.15} />
        </lineSegments>
      ))}
    </group>
  );
}

export default function WaveScene() {
  return (
    <div className="absolute inset-0" style={{ zIndex: 0 }}>
      <Canvas
        camera={{ position: [0, 6, 12], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.3} />
          <InfiniteGrid />
          <EnergyBeams />
          <EffectComposer>
            <Bloom intensity={0.8} luminanceThreshold={0.15} mipmapBlur />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
