"use client";
import { useRef, useMemo, Suspense, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Sphere, Text, MeshTransmissionMaterial } from "@react-three/drei";
import { EffectComposer, Bloom, ChromaticAberration } from "@react-three/postprocessing";
import * as THREE from "three";

let globalScroll = 0;

function useScroll() {
  useEffect(() => {
    const onScroll = () => { globalScroll = window.scrollY / (document.body.scrollHeight - window.innerHeight); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
}

/* ── Holographic Grid Floor ── */
function HoloGrid() {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.z = ((state.clock.elapsedTime * 0.5) % 2);
  });

  const lines = useMemo(() => {
    const arr: { start: [number, number, number]; end: [number, number, number]; color: string }[] = [];
    for (let i = -30; i <= 30; i += 2) {
      arr.push({ start: [i, 0, -40], end: [i, 0, 40], color: i % 10 === 0 ? "#2DD4BF" : "#1a3a4a" });
      arr.push({ start: [-30, 0, i * 2], end: [30, 0, i * 2], color: i % 5 === 0 ? "#8B5CF6" : "#1a2a4a" });
    }
    return arr;
  }, []);

  return (
    <group ref={ref} position={[0, -4, 0]} rotation={[0, 0, 0]}>
      {lines.map((l, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[new Float32Array([...l.start, ...l.end]), 3]} />
          </bufferGeometry>
          <lineBasicMaterial color={l.color} transparent opacity={0.15} />
        </line>
      ))}
    </group>
  );
}

/* ── Futuristic Building ── */
function Building({ position, height, width, color, emissive }: {
  position: [number, number, number]; height: number; width: number; color: string; emissive: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const windowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (windowRef.current) {
      (windowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.15;
    }
  });

  return (
    <group position={position}>
      <mesh ref={ref} position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, width * 0.8]} />
        <meshStandardMaterial color={color} emissive={emissive} emissiveIntensity={0.15} roughness={0.2} metalness={0.9} transparent opacity={0.7} />
      </mesh>
      {/* Window glow lines */}
      {Array.from({ length: Math.floor(height / 0.8) }, (_, i) => (
        <mesh key={i} ref={i === 0 ? windowRef : undefined} position={[0, i * 0.8 + 0.5, width * 0.41]}>
          <planeGeometry args={[width * 0.7, 0.12]} />
          <meshBasicMaterial color={emissive} transparent opacity={0.3} />
        </mesh>
      ))}
      {/* Rooftop beacon */}
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
        child.position.y = nodes[i].pos[1] + Math.sin(state.clock.elapsedTime * 0.5 + i * 0.8) * 0.3;
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

/* ── Flying Vehicles / Drones ── */
function FlyingVehicle({ color, speed, radius, height, tilt }: {
  color: string; speed: number; radius: number; height: number; tilt: number;
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
      {/* Engine trail */}
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
      <Text fontSize={2.5} font="/fonts/SpaceGrotesk-Bold.ttf" color="#2DD4BF"
        anchorX="center" anchorY="middle" fillOpacity={0.15}
        outlineWidth={0.02} outlineColor="#2DD4BF" outlineOpacity={0.6}>
        GERCEP AI
      </Text>
      <Text fontSize={0.4} font="/fonts/SpaceGrotesk-Bold.ttf" color="#8B5CF6"
        anchorX="center" anchorY="middle" position={[0, -1.8, 0]} fillOpacity={0.3}
        outlineWidth={0.01} outlineColor="#8B5CF6" outlineOpacity={0.5}>
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

  useScroll();

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > window.innerHeight * 0.3);
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

          {/* Flying vehicles */}
          <FlyingVehicle color="#2DD4BF" speed={0.3} radius={8} height={3} tilt={0} />
          <FlyingVehicle color="#EC4899" speed={-0.2} radius={12} height={5} tilt={0.5} />
          <FlyingVehicle color="#8B5CF6" speed={0.25} radius={6} height={1} tilt={-0.3} />
          <FlyingVehicle color="#38BDF8" speed={-0.15} radius={15} height={4} tilt={0.2} />

          <EffectComposer>
            <Bloom intensity={1.5} luminanceThreshold={0.1} mipmapBlur radius={0.8} />
            <ChromaticAberration offset={new THREE.Vector2(0.0006, 0.0006)} radialModulation modulationOffset={0.5} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
