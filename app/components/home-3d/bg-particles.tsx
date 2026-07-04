"use client";
import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Sphere, Torus } from "@react-three/drei";
import { EffectComposer, Bloom, ChromaticAberration } from "@react-three/postprocessing";
import * as THREE from "three";

function StarField() {
  const ref = useRef<THREE.Points>(null);
  const count = 1500;
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const palette = [[0.18, 0.83, 0.75], [0.55, 0.36, 0.96], [0.93, 0.29, 0.6], [0.22, 0.74, 0.97], [1, 1, 1]];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 80;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 300;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40 - 5;
      const c = palette[Math.floor(Math.random() * palette.length)];
      const b = 0.4 + Math.random() * 0.6;
      col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
    }
    return { positions: pos, colors: col };
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.004;
    const pos = ref.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += 0.003;
      if (pos[i * 3 + 1] > 150) pos[i * 3 + 1] = -150;
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.06} vertexColors transparent opacity={0.85} sizeAttenuation />
    </points>
  );
}

function Planet({ radius, size, color, emissive, speed, tilt, hasRing }: {
  radius: number; size: number; color: string; emissive: string; speed: number; tilt: number; hasRing?: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * speed;
    ref.current.position.x = Math.cos(t) * radius;
    ref.current.position.z = Math.sin(t) * radius;
    ref.current.position.y = Math.sin(t * 0.7) * tilt;
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.5;
    }
  });

  return (
    <group ref={ref}>
      <Sphere ref={meshRef} args={[size, 32, 32]}>
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.8} roughness={0.3} metalness={0.7} />
      </Sphere>
      {hasRing && (
        <mesh rotation={[Math.PI / 2.5, 0.2, 0]}>
          <torusGeometry args={[size * 1.8, size * 0.08, 8, 64]} />
          <meshBasicMaterial color={emissive} transparent opacity={0.5} />
        </mesh>
      )}
      <pointLight color={emissive} intensity={0.4} distance={8} />
    </group>
  );
}

function OrbitPath({ radius, color, tilt = 0 }: { radius: number; color: string; tilt?: number }) {
  return (
    <mesh rotation={[Math.PI / 2 + tilt * 0.1, tilt * 0.05, 0]}>
      <torusGeometry args={[radius, 0.008, 8, 128]} />
      <meshBasicMaterial color={color} transparent opacity={0.08} />
    </mesh>
  );
}

function ShootingStar() {
  const ref = useRef<THREE.Mesh>(null);
  const data = useMemo(() => ({
    startX: (Math.random() - 0.5) * 40,
    startY: (Math.random()) * 30 + 10,
    startZ: (Math.random() - 0.5) * 20 - 5,
    speed: 8 + Math.random() * 12,
    delay: Math.random() * 30,
    angle: -0.5 - Math.random() * 0.5,
  }), []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = ((state.clock.elapsedTime + data.delay) % (8 + data.delay)) - data.delay;
    if (t < 0) { ref.current.visible = false; return; }
    ref.current.visible = true;
    const progress = t * data.speed * 0.05;
    ref.current.position.x = data.startX + progress * 3;
    ref.current.position.y = data.startY + progress * data.angle * 3;
    ref.current.position.z = data.startZ;
    ref.current.scale.setScalar(Math.max(0, 1 - progress * 0.5));
  });

  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.03, 8, 8]} />
      <meshBasicMaterial color="#ffffff" />
    </mesh>
  );
}

function FloatingAsteroid({ position, size, color, speed }: {
  position: [number, number, number]; size: number; color: string; speed: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.x = state.clock.elapsedTime * speed * 0.3;
    ref.current.rotation.y = state.clock.elapsedTime * speed * 0.5;
    ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed * 0.2) * 0.5;
    ref.current.position.z = position[2] + Math.sin(state.clock.elapsedTime * speed * 0.15) * 2;
  });

  return (
    <Float speed={speed} rotationIntensity={0.8} floatIntensity={0.5}>
      <mesh ref={ref} position={position} scale={size}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.6} wireframe />
      </mesh>
    </Float>
  );
}

function SolarSystem() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.02) * 0.05;
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.005;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Sun core */}
      <Sphere args={[0.6, 32, 32]}>
        <meshBasicMaterial color="#F59E0B" />
      </Sphere>
      <Sphere args={[0.8, 16, 16]}>
        <meshBasicMaterial color="#F59E0B" transparent opacity={0.15} />
      </Sphere>
      <pointLight color="#F59E0B" intensity={2} distance={30} />

      {/* Orbit paths */}
      <OrbitPath radius={3} color="#2DD4BF" />
      <OrbitPath radius={5.5} color="#8B5CF6" tilt={0.3} />
      <OrbitPath radius={8} color="#EC4899" tilt={-0.2} />
      <OrbitPath radius={11} color="#38BDF8" tilt={0.15} />
      <OrbitPath radius={14} color="#A78BFA" tilt={-0.1} />

      {/* Planets */}
      <Planet radius={3} size={0.18} color="#2DD4BF" emissive="#2DD4BF" speed={0.3} tilt={0.5} />
      <Planet radius={5.5} size={0.35} color="#8B5CF6" emissive="#8B5CF6" speed={0.18} tilt={1} hasRing />
      <Planet radius={8} size={0.25} color="#EC4899" emissive="#EC4899" speed={0.12} tilt={0.8} />
      <Planet radius={11} size={0.45} color="#38BDF8" emissive="#38BDF8" speed={0.08} tilt={1.2} hasRing />
      <Planet radius={14} size={0.2} color="#A78BFA" emissive="#A78BFA" speed={0.05} tilt={0.6} />
    </group>
  );
}

function DepthParticles() {
  const ref = useRef<THREE.Points>(null);
  const count = 200;
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 50;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 50;
      pos[i * 3 + 2] = Math.random() * 20 + 5;
      const r = Math.random();
      if (r < 0.33) { col[i * 3] = 0.18; col[i * 3 + 1] = 0.83; col[i * 3 + 2] = 0.75; }
      else if (r < 0.66) { col[i * 3] = 0.55; col[i * 3 + 1] = 0.36; col[i * 3 + 2] = 0.96; }
      else { col[i * 3] = 0.93; col[i * 3 + 1] = 0.29; col[i * 3 + 2] = 0.6; }
    }
    return { positions: pos, colors: col };
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 2] -= 0.02;
      if (pos[i * 3 + 2] < -5) {
        pos[i * 3 + 2] = 25;
        pos[i * 3] = (Math.random() - 0.5) * 50;
        pos[i * 3 + 1] = (Math.random() - 0.5) * 50;
      }
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.15} vertexColors transparent opacity={0.6} sizeAttenuation />
    </points>
  );
}

export default function BgParticles() {
  return (
    <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <Canvas camera={{ position: [0, 3, 20], fov: 65 }} dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent", position: "fixed", top: 0, left: 0, width: "100%", height: "100%" }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.1} />

          <StarField />
          <SolarSystem />
          <DepthParticles />

          {/* Shooting stars */}
          {Array.from({ length: 5 }, (_, i) => <ShootingStar key={i} />)}

          {/* Floating asteroids at different depths */}
          <FloatingAsteroid position={[-12, 8, 3]} size={0.2} color="#2DD4BF" speed={1.2} />
          <FloatingAsteroid position={[15, -5, 5]} size={0.15} color="#8B5CF6" speed={0.8} />
          <FloatingAsteroid position={[-8, -10, 8]} size={0.25} color="#EC4899" speed={1.5} />
          <FloatingAsteroid position={[10, 12, 2]} size={0.12} color="#38BDF8" speed={1} />
          <FloatingAsteroid position={[-15, 3, 6]} size={0.18} color="#A78BFA" speed={0.9} />
          <FloatingAsteroid position={[6, -8, 10]} size={0.3} color="#F59E0B" speed={0.7} />

          <EffectComposer>
            <Bloom intensity={1.2} luminanceThreshold={0.1} mipmapBlur radius={0.8} />
            <ChromaticAberration offset={new THREE.Vector2(0.0008, 0.0008)} radialModulation modulationOffset={0.5} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
