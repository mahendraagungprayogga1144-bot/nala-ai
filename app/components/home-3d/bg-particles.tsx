"use client";
import { useRef, useMemo, Suspense, useEffect, useState } from "react";
import { Canvas, useFrame, useThree, extend } from "@react-three/fiber";
import { Float, Sphere, Text } from "@react-three/drei";
import { EffectComposer, Bloom, ChromaticAberration } from "@react-three/postprocessing";
import * as THREE from "three";

let globalScroll = 0;

function useScrollTracker() {
  useEffect(() => {
    const fn = () => {
      const max = document.body.scrollHeight - window.innerHeight;
      globalScroll = max > 0 ? window.scrollY / max : 0;
    };
    window.addEventListener("scroll", fn, { passive: true });
    fn();
    return () => window.removeEventListener("scroll", fn);
  }, []);
}

/* ── Holographic Grid Floor (using BufferGeometry line segments) ── */
function HoloGrid() {
  const ref = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const verts: number[] = [];
    for (let i = -30; i <= 30; i += 2) {
      verts.push(i, 0, -40, i, 0, 40);
    }
    for (let j = -20; j <= 20; j += 2) {
      verts.push(-30, 0, j * 2, 30, 0, j * 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    return g;
  }, []);

  useFrame((state) => {
    if (ref.current) ref.current.position.z = (state.clock.elapsedTime * 0.5) % 4;
  });

  return (
    <group ref={ref} position={[0, -4, 0]}>
      <lineSegments geometry={geo}>
        <lineBasicMaterial color="#2DD4BF" transparent opacity={0.06} />
      </lineSegments>
    </group>
  );
}

/* ── Futuristic Building ── */
function Building({ position, height, width, color, emissive }: {
  position: [number, number, number]; height: number; width: number; color: string; emissive: string;
}) {
  const windowRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (windowRef.current)
      (windowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.15;
  });

  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, width * 0.8]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.6} roughness={0.2} metalness={0.9} transparent opacity={0.85} />
      </mesh>
      {Array.from({ length: Math.floor(height / 0.8) }, (_, i) => (
        <mesh key={i} ref={i === 0 ? windowRef : undefined} position={[0, i * 0.8 + 0.5, width * 0.41]}>
          <planeGeometry args={[width * 0.7, 0.12]} />
          <meshBasicMaterial color={emissive} transparent opacity={0.3} />
        </mesh>
      ))}
      <pointLight position={[0, height + 0.5, 0]} color={emissive} intensity={0.5} distance={5} />
      <mesh position={[0, height + 0.2, 0]}>
        <sphereGeometry args={[0.08, 8, 8]} />
        <meshBasicMaterial color={emissive} />
      </mesh>
    </group>
  );
}

/* ── City Skyline ── */
function CityScape() {
  const buildings = useMemo(() => [
    { pos: [-10, -4, 5] as [number, number, number], h: 6, w: 1.2, c: "#0a1520", e: "#2DD4BF" },
    { pos: [-7, -4, 2] as [number, number, number], h: 9, w: 1.5, c: "#0a1225", e: "#8B5CF6" },
    { pos: [-4, -4, 7] as [number, number, number], h: 4, w: 1, c: "#0a1520", e: "#2DD4BF" },
    { pos: [-1, -4, 0] as [number, number, number], h: 12, w: 1.8, c: "#0a0f25", e: "#EC4899" },
    { pos: [2, -4, 4] as [number, number, number], h: 7, w: 1.3, c: "#0a1520", e: "#38BDF8" },
    { pos: [5, -4, -1] as [number, number, number], h: 10, w: 1.6, c: "#0a1225", e: "#8B5CF6" },
    { pos: [8, -4, 6] as [number, number, number], h: 5, w: 1.1, c: "#0a1520", e: "#2DD4BF" },
    { pos: [11, -4, 1] as [number, number, number], h: 8, w: 1.4, c: "#0a0f25", e: "#EC4899" },
    { pos: [-13, -4, 0] as [number, number, number], h: 7, w: 1.2, c: "#0a1520", e: "#38BDF8" },
    { pos: [14, -4, -2] as [number, number, number], h: 11, w: 1.7, c: "#0a1225", e: "#A78BFA" },
    { pos: [-16, -4, 3] as [number, number, number], h: 8, w: 1.3, c: "#0a0f25", e: "#F59E0B" },
    { pos: [17, -4, 5] as [number, number, number], h: 5, w: 1, c: "#0a1520", e: "#2DD4BF" },
    { pos: [-2, -4, -4] as [number, number, number], h: 14, w: 2, c: "#0a0f20", e: "#8B5CF6" },
    { pos: [6, -4, -3] as [number, number, number], h: 13, w: 1.9, c: "#0a0f20", e: "#2DD4BF" },
  ], []);

  return (
    <group>
      {buildings.map((b, i) => (
        <Building key={i} position={b.pos} height={b.h} width={b.w} color={b.c} emissive={b.e} />
      ))}
    </group>
  );
}

/* ── Data Streams ── */
function DataStreams() {
  const refs = useRef<THREE.Mesh[]>([]);
  const streams = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      x: (Math.random() - 0.5) * 30,
      z: -2 + Math.random() * 10,
      speed: 1 + Math.random() * 2,
      color: ["#2DD4BF", "#8B5CF6", "#EC4899", "#38BDF8"][i % 4],
      height: 3 + Math.random() * 5,
    })), []);

  useFrame((state) => {
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const s = streams[i];
      mesh.position.y = -4 + ((state.clock.elapsedTime * s.speed) % (s.height + 8));
      (mesh.material as THREE.MeshBasicMaterial).opacity = 0.15 + Math.sin(state.clock.elapsedTime * 3 + i) * 0.1;
    });
  });

  return (
    <group>
      {streams.map((s, i) => (
        <mesh key={i} ref={el => { if (el) refs.current[i] = el; }} position={[s.x, 0, s.z]}>
          <cylinderGeometry args={[0.015, 0.015, s.height, 6]} />
          <meshBasicMaterial color={s.color} transparent opacity={0.2} />
        </mesh>
      ))}
    </group>
  );
}

/* ── Network Nodes ── */
function NetworkNodes() {
  const groupRef = useRef<THREE.Group>(null);
  const nodes = useMemo(() =>
    Array.from({ length: 15 }, () => ({
      pos: [(Math.random() - 0.5) * 25, (Math.random() - 0.5) * 8 + 2, Math.random() * 10] as [number, number, number],
      color: ["#2DD4BF", "#8B5CF6", "#EC4899", "#38BDF8"][Math.floor(Math.random() * 4)],
    })), []);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        if (nodes[i]) child.position.y = nodes[i].pos[1] + Math.sin(state.clock.elapsedTime * 0.5 + i * 0.8) * 0.3;
      });
    }
  });

  return (
    <group ref={groupRef}>
      {nodes.map((n, i) => (
        <group key={i} position={n.pos}>
          <Sphere args={[0.06, 8, 8]}>
            <meshBasicMaterial color={n.color} />
          </Sphere>
          <Sphere args={[0.15, 8, 8]}>
            <meshBasicMaterial color={n.color} transparent opacity={0.08} />
          </Sphere>
          <pointLight color={n.color} intensity={0.15} distance={3} />
        </group>
      ))}
    </group>
  );
}

/* ── Flying Vehicles ── */
function FlyingVehicle({ color, speed, radius, height }: {
  color: string; speed: number; radius: number; height: number;
}) {
  const ref = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * speed;
    ref.current.position.x = Math.cos(t) * radius;
    ref.current.position.z = Math.sin(t) * radius + 2;
    ref.current.position.y = height + Math.sin(t * 2) * 0.3;
    ref.current.rotation.y = -t + Math.PI / 2;
    if (trailRef.current) trailRef.current.scale.x = 0.5 + Math.sin(state.clock.elapsedTime * 5) * 0.2;
  });

  return (
    <group ref={ref}>
      <mesh scale={[0.15, 0.05, 0.08]}>
        <boxGeometry />
        <meshStandardMaterial color="#0a1520" emissive={color} emissiveIntensity={0.5} metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh ref={trailRef} position={[-0.2, 0, 0]} scale={[0.3, 0.02, 0.02]}>
        <boxGeometry />
        <meshBasicMaterial color={color} transparent opacity={0.4} />
      </mesh>
      <pointLight color={color} intensity={0.3} distance={4} />
    </group>
  );
}

/* ── GERCEP AI 3D Text ── */
function GercepText() {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.y = 4 + Math.sin(state.clock.elapsedTime * 0.3) * 0.3;
    ref.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.15) * 0.1;
  });

  return (
    <group ref={ref} position={[0, 6, 3]}>
      <Text fontSize={3} font="/fonts/SpaceGrotesk-Bold.ttf" color="#2DD4BF"
        anchorX="center" anchorY="middle" fillOpacity={0.2}
        outlineWidth={0.03} outlineColor="#2DD4BF" outlineOpacity={0.8}>
        GERCEP AI
      </Text>
      <Text fontSize={0.5} font="/fonts/SpaceGrotesk-Bold.ttf" color="#8B5CF6"
        anchorX="center" anchorY="middle" position={[0, -2, 0]} fillOpacity={0.4}
        outlineWidth={0.015} outlineColor="#8B5CF6" outlineOpacity={0.7}>
        BUSINESS OS MASA DEPAN
      </Text>
    </group>
  );
}

/* ── Star Field ── */
function StarField() {
  const ref = useRef<THREE.Points>(null);
  const count = 1200;
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const palette = [[0.18, 0.83, 0.75], [0.55, 0.36, 0.96], [0.93, 0.29, 0.6], [1, 1, 1]];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 80;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 2] = -5 - Math.random() * 30;
      const c = palette[Math.floor(Math.random() * palette.length)];
      const b = 0.3 + Math.random() * 0.7;
      col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
    }
    return { positions: pos, colors: col };
  }, []);

  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.003;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.06} vertexColors transparent opacity={0.8} sizeAttenuation />
    </points>
  );
}

/* ── Scroll Camera ── */
function ScrollCamera() {
  const { camera } = useThree();
  const targetY = useRef(5);
  useFrame(() => {
    targetY.current = 5 - globalScroll * 8;
    camera.position.y += (targetY.current - camera.position.y) * 0.02;
    camera.lookAt(0, targetY.current - 3, 0);
  });
  return null;
}

/* ── Main ── */
export default function BgParticles() {
  const [scrollPast, setScrollPast] = useState(false);

  useScrollTracker();

  useEffect(() => {
    const fn = () => setScrollPast(window.scrollY > window.innerHeight * 0.25);
    window.addEventListener("scroll", fn, { passive: true });
    fn();
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none transition-opacity duration-1000"
      style={{ zIndex: 0, opacity: scrollPast ? 1 : 0 }}>
      <Canvas camera={{ position: [0, 3, 20], fov: 60 }} dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.3} />
          <directionalLight position={[5, 10, 10]} intensity={0.4} color="#8B5CF6" />
          <directionalLight position={[-5, 8, 5]} intensity={0.3} color="#2DD4BF" />
          <fog attach="fog" args={["#050508", 30, 80]} />

          <ScrollCamera />
          <StarField />
          <HoloGrid />
          <CityScape />
          <DataStreams />
          <NetworkNodes />
          <GercepText />

          <FlyingVehicle color="#2DD4BF" speed={0.3} radius={8} height={3} />
          <FlyingVehicle color="#EC4899" speed={-0.2} radius={12} height={5} />
          <FlyingVehicle color="#8B5CF6" speed={0.25} radius={6} height={1} />
          <FlyingVehicle color="#38BDF8" speed={-0.15} radius={15} height={4} />

          <EffectComposer>
            <Bloom intensity={1.5} luminanceThreshold={0.1} mipmapBlur radius={0.8} />
            <ChromaticAberration offset={new THREE.Vector2(0.0006, 0.0006)} radialModulation modulationOffset={0.5} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
