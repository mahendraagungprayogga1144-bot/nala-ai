"use client";
import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, MeshDistortMaterial, Sphere, Stars } from "@react-three/drei";
import * as THREE from "three";

function Particles({ count = 800 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) arr[i] = (Math.random() - 0.5) * 20;
    return arr;
  }, [count]);

  const colors = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const palette = [
      [0.18, 0.83, 0.75],
      [0.55, 0.36, 0.96],
      [0.93, 0.29, 0.60],
    ];
    for (let i = 0; i < count; i++) {
      const c = palette[Math.floor(Math.random() * palette.length)];
      arr[i * 3] = c[0]; arr[i * 3 + 1] = c[1]; arr[i * 3 + 2] = c[2];
    }
    return arr;
  }, [count]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.015;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.035} vertexColors transparent opacity={0.7} sizeAttenuation />
    </points>
  );
}

function GlowSphere() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.08;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.05) * 0.1;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.8}>
      <Sphere ref={ref} args={[1.8, 64, 64]} position={[0, 0, 0]}>
        <MeshDistortMaterial
          color="#2DD4BF"
          emissive="#8B5CF6"
          emissiveIntensity={0.3}
          roughness={0.2}
          metalness={0.8}
          distort={0.25}
          speed={1.5}
          transparent
          opacity={0.15}
        />
      </Sphere>
      <Sphere args={[2.0, 32, 32]} position={[0, 0, 0]}>
        <meshBasicMaterial color="#2DD4BF" wireframe transparent opacity={0.08} />
      </Sphere>
    </Float>
  );
}

function Rings() {
  const ref1 = useRef<THREE.Mesh>(null);
  const ref2 = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ref1.current) { ref1.current.rotation.x = t * 0.1; ref1.current.rotation.z = t * 0.05; }
    if (ref2.current) { ref2.current.rotation.y = t * 0.08; ref2.current.rotation.x = t * -0.06; }
  });
  return (
    <>
      <mesh ref={ref1} position={[0, 0, 0]}>
        <torusGeometry args={[2.8, 0.008, 16, 100]} />
        <meshBasicMaterial color="#8B5CF6" transparent opacity={0.25} />
      </mesh>
      <mesh ref={ref2} position={[0, 0, 0]}>
        <torusGeometry args={[3.2, 0.006, 16, 100]} />
        <meshBasicMaterial color="#EC4899" transparent opacity={0.15} />
      </mesh>
    </>
  );
}

function MouseTracker() {
  const { camera } = useThree();
  useFrame((state) => {
    const mx = state.pointer.x * 0.3;
    const my = state.pointer.y * 0.15;
    camera.position.x += (mx - camera.position.x) * 0.02;
    camera.position.y += (my - camera.position.y) * 0.02;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function HeroScene() {
  return (
    <div className="absolute inset-0" style={{ zIndex: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.3} />
          <pointLight position={[5, 5, 5]} intensity={0.5} color="#2DD4BF" />
          <pointLight position={[-5, -5, 3]} intensity={0.3} color="#8B5CF6" />
          <GlowSphere />
          <Rings />
          <Particles count={600} />
          <Stars radius={15} depth={40} count={1500} factor={2} saturation={0.5} fade speed={0.5} />
          <MouseTracker />
        </Suspense>
      </Canvas>
    </div>
  );
}
