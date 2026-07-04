"use client";
import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

function StarField({ count = 1200 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const palette = [[0.18, 0.83, 0.75], [0.55, 0.36, 0.96], [0.93, 0.29, 0.6], [0.22, 0.74, 0.97], [1, 1, 1]];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 200;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 30 - 10;
      const c = palette[Math.floor(Math.random() * palette.length)];
      const brightness = 0.5 + Math.random() * 0.5;
      col[i * 3] = c[0] * brightness;
      col[i * 3 + 1] = c[1] * brightness;
      col[i * 3 + 2] = c[2] * brightness;
    }
    return { positions: pos, colors: col };
  }, [count]);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.003;
    const pos = ref.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += 0.002;
      if (pos[i * 3 + 1] > 100) pos[i * 3 + 1] = -100;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.05} vertexColors transparent opacity={0.8} sizeAttenuation />
    </points>
  );
}

export default function BgParticles() {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <Canvas camera={{ position: [0, 0, 15], fov: 60 }} dpr={[1, 2]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent", position: "fixed", top: 0, left: 0, width: "100%", height: "100%" }}>
        <Suspense fallback={null}>
          <StarField count={1200} />
          <EffectComposer>
            <Bloom intensity={0.6} luminanceThreshold={0.1} mipmapBlur />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
