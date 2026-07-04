"use client";
import { useRef, useMemo, Suspense, useEffect, useState } from "react";
import { Canvas, useFrame, useThree, extend } from "@react-three/fiber";
import { Float, Sphere, Text } from "@react-three/drei";
import { EffectComposer, Bloom, ChromaticAberration } from "@react-three/postprocessing";
import * as THREE from "three";

let globalScroll = 0;

function useScrollTracker() {
  useEffect(() => {
    const onScroll = () => { globalScroll = window.scrollY / (document.body.scrollHeight - window.innerHeight); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
}

/* ── Holographic Grid Floor (using lineSegments to avoid SVG conflict) ── */
function HoloGrid() {
  const ref = useRef<THREE.LineSegments>(null);

  const geometry = useMemo(() => {
    const points: number[] = [];
    for (let i = -30; i <= 30; i += 2) {
      points.push(i, 0, -40, i, 0, 40);
      points.push(-30, 0, i * 2, 30, 0, i * 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    return geo;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.z = ((state.clock.elapsedTime * 0.5) % 2);
  });

  return (
    <lineSegments ref={ref} geometry={geometry} position={[0, -4, 0]}>
      <lineBasicMaterial color="#1a3a5a" transparent opacity={0.12} />
    </lineSegments>
  );
}

/* ── Futuristic Building ── */
function Building({ position, height, width, color, emissive }: {
  position: [number, number, number]; height: number; width: number; color: string; emissive: string;
}) {
  const windowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (windowRef.current) {
      (windowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.15;
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, width * 0.8]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.15} roughness={0.2} metalness={0.9} transparent opacity={0.7} />
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

/* ── Futuristic City Skyline ── */
function CityScape() {
  const buildings = useMemo(() => [
    { pos: [-12, -4, -15] as [number, number, number], h: 6, w: 1.2, c: "#0a1520", e: "#2DD4BF" },
    { pos: [-9, -4, -18] as [number, number, number], h: 9, w: 1.5, c: "#0a1225", e: "#8B5CF6" },
    { pos: [-6, -4, -12] as [number, number, number], h: 4, w: 1, c: "#0a1520", e: "#2DD4BF" },
    { pos: [-3, -4, -20] as [number, number, number], h: 12, w: 1.8, c: "#0a0f25", e: "#EC4899" },
    { pos: [0, -4, -16] as [number, number, number], h: 7, w: 1.3, c: "#0a1520", e: "#38BDF8" },
    { pos: [3, -4, -22] as [number, number, number], h: 10, w: 1.6, c: "#0a1225", e: "#8B5CF6" },
    { pos: [6, -4, -14] as [number, number, number], h: 5, w: 1.1, c: "#0a1520", e: "#2DD4BF" },
    { pos: [9, -4, -19] as [number, number, number], h: 8, w: 1.4, c: "#0a0f25", e: "#EC4899" },
    { pos: [12, -4, -16] as [number, number, number], h: 6, w: 1.2, c: "#0a1520", e: "#38BDF8" },
    { pos: [15, -4, -21] as [number, number, number], h: 11, w: 1.7, c: "#0a1225", e: "#A78BFA" },
    { pos: [-15, -4, -20] as [number, number, number], h: 8, w: 1.3, c: "#0a0f25", e: "#F59E0B" },
    { pos: [18, -4, -17] as [number, number, number], h: 5, w: 1, c: "#0a1520", e: "#2DD4BF" },
  ], []);

  return (
    <group>
      {buildings.map((b, i) => (
        <Building key={i} position={b.pos} height={b.h} width={b.w} color={b.c} emissive={b.e} />
      ))}
    </group>
  );
}

/* ── Data Streams — vertical light beams ── */
function DataStreams() {
  const refs = useRef<THREE.Mesh[]>([]);
  const streams = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      x: (Math.random() - 0.5) * 30,
      z: -10 - Math.random() * 15,
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
      pos: [(Math.random() - 0.5) * 25, (Math.random() - 0.5) * 8 + 2, -5 - Math.random() * 15] as [number, number, number],
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
    ref.current.position.z = Math.sin(t) * radius - 10;
    ref.current.position.y = height + Math.sin(t * 2) * 0.3;
    ref.current.rotation.y = -t + Math.PI / 2;
    if (trailRef.current) {
      trailRef.current.scale.x = 0.5 + Math.sin(state.clock.elapsedTime * 5) * 0.2;
    }
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
    <group ref={ref} position={[0, 4, -18]}>
      <Text fontSize={2.5} color="#2DD4BF"
        anchorX="center" anchorY="middle" fillOpacity={0.15}
        outlineWidth={0.02} outlineColor="#2DD4BF" outlineOpacity={0.6}
        font="https://fonts.gstatic.com/s/spacegrotest/v16/V8mDoQDjQSkFtoMM3T6r8E7mPb54C_k3HqU.woff2">
        GERCEP AI
      </Text>
      <Text fontSize={0.4} color="#8B5CF6"
        anchorX="center" anchorY="middle" position={[0, -1.8, 0]} fillOpacity={0.3}
        outlineWidth={0.01} outlineColor="#8B5CF6" outlineOpacity={0.5}
        font="https://fonts.gstatic.com/s/spacegrotest/v16/V8mDoQDjQSkFtoMM3T6r8E7mPb54C_k3HqU.woff2">
        BUSINESS OS MASA DEPAN
      </Text>
    </group>
  );
}

/* ── Star Background ── */
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
      pos[i * 3 + 2] = -10 - Math.random() * 40;
      const c = palette[Math.floor(Math.random() * palette.length)];
      const b = 0.3 + Math.random() * 0.7;
      col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
    }
    return { positions: pos, colors: col };
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.003;
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

/* ── Floating Asteroids ── */
function FloatingAsteroid({ position, size, color, speed }: {
  position: [number, number, number]; size: number; color: string; speed: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.rotation.x = state.clock.elapsedTime * speed * 0.3;
    ref.current.rotation.y = state.clock.elapsedTime * speed * 0.5;
    ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * speed * 0.2) * 0.5;
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

/* ── Scroll Camera Controller ── */
function ScrollCamera() {
  const { camera } = useThree();
  const targetY = useRef(3);

  useFrame(() => {
    targetY.current = 3 - globalScroll * 6;
    camera.position.y += (targetY.current - camera.position.y) * 0.02;
    camera.lookAt(0, targetY.current - 2, -15);
  });

  return null;
}

/* ── Main Export ── */
export default function BgParticles() {
  const [visible, setVisible] = useState(false);

  useScrollTracker();

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.25);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none transition-opacity duration-1000"
      style={{ zIndex: 0, opacity: visible ? 1 : 0 }}>
      <Canvas camera={{ position: [0, 3, 20], fov: 60 }} dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent", position: "fixed", top: 0, left: 0, width: "100%", height: "100%" }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.08} />
          <fog attach="fog" args={["#050508", 15, 50]} />

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

          <FloatingAsteroid position={[-12, 8, 3]} size={0.2} color="#2DD4BF" speed={1.2} />
          <FloatingAsteroid position={[15, -5, 5]} size={0.15} color="#8B5CF6" speed={0.8} />
          <FloatingAsteroid position={[-8, -10, 8]} size={0.25} color="#EC4899" speed={1.5} />

          <EffectComposer>
            <Bloom intensity={1.5} luminanceThreshold={0.1} mipmapBlur radius={0.8} />
            <ChromaticAberration offset={new THREE.Vector2(0.0006, 0.0006)} radialModulation modulationOffset={0.5} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
