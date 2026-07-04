"use client";
import { useRef, useMemo, Suspense, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Sphere, Text, Edges } from "@react-three/drei";
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

/* ── Lit-window texture, drawn once per building ── */
function makeWindowTexture(accent: string, seed: number) {
  const c = document.createElement("canvas");
  c.width = 64; c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#04060c";
  ctx.fillRect(0, 0, 64, 256);
  let rnd = seed;
  const rand = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
  for (let y = 6; y < 250; y += 9) {
    for (let x = 5; x < 58; x += 11) {
      const r = rand();
      if (r > 0.42) {
        ctx.fillStyle = r > 0.88 ? accent : r > 0.7 ? "#9fd8ff" : "#cfe8ff";
        ctx.globalAlpha = 0.35 + rand() * 0.65;
        ctx.fillRect(x, y, 7, 5);
      }
    }
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

/* ── Realistic Skyscraper: dark body + lit windows + neon edge + antenna ── */
function Tower({ position, height, width, accent, seed, setbacks = 1 }: {
  position: [number, number, number]; height: number; width: number; accent: string; seed: number; setbacks?: number;
}) {
  const beaconRef = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => makeWindowTexture(accent, seed), [accent, seed]);

  useFrame((state) => {
    if (beaconRef.current) {
      (beaconRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.4 + Math.abs(Math.sin(state.clock.elapsedTime * 1.5 + seed)) * 0.6;
    }
  });

  const sections = useMemo(() => {
    const arr: { y: number; h: number; w: number }[] = [];
    let y = 0;
    let w = width;
    let remaining = height;
    for (let i = 0; i < setbacks; i++) {
      const h = i === setbacks - 1 ? remaining : remaining * (0.5 + (seed % 10) * 0.02);
      arr.push({ y: y + h / 2, h, w });
      y += h; remaining -= h; w *= 0.72;
      if (remaining <= 0.5) break;
    }
    return arr;
  }, [height, width, setbacks, seed]);

  const topY = sections.reduce((acc, s) => Math.max(acc, s.y + s.h / 2), 0);

  return (
    <group position={position}>
      {sections.map((s, i) => (
        <mesh key={i} position={[0, s.y, 0]}>
          <boxGeometry args={[s.w, s.h, s.w * 0.85]} />
          <meshStandardMaterial
            color="#070a12"
            emissive="#ffffff"
            emissiveMap={tex}
            emissiveIntensity={1.1}
            roughness={0.35}
            metalness={0.85}
          />
          <Edges color={accent} threshold={15}>
            <lineBasicMaterial color={accent} transparent opacity={0.55} />
          </Edges>
        </mesh>
      ))}
      {/* Antenna + blinking beacon */}
      <mesh position={[0, topY + 0.45, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.9, 6]} />
        <meshBasicMaterial color="#1a2030" />
      </mesh>
      <mesh ref={beaconRef} position={[0, topY + 0.95, 0]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshBasicMaterial color={accent} transparent />
      </mesh>
    </group>
  );
}

/* ── City ── */
function CityScape() {
  const towers = useMemo(() => [
    { pos: [-11, -4, 4] as [number, number, number], h: 6, w: 1.3, a: "#2DD4BF", seed: 11, sb: 2 },
    { pos: [-7.5, -4, 1] as [number, number, number], h: 9.5, w: 1.6, a: "#8B5CF6", seed: 23, sb: 3 },
    { pos: [-4.5, -4, 6] as [number, number, number], h: 4.5, w: 1.1, a: "#2DD4BF", seed: 37, sb: 1 },
    { pos: [-1.5, -4, -1] as [number, number, number], h: 13, w: 2.0, a: "#EC4899", seed: 41, sb: 3 },
    { pos: [2, -4, 3.5] as [number, number, number], h: 7.5, w: 1.4, a: "#38BDF8", seed: 53, sb: 2 },
    { pos: [5.5, -4, -2] as [number, number, number], h: 11, w: 1.7, a: "#8B5CF6", seed: 67, sb: 3 },
    { pos: [8.5, -4, 5] as [number, number, number], h: 5.5, w: 1.2, a: "#2DD4BF", seed: 71, sb: 1 },
    { pos: [11.5, -4, 0.5] as [number, number, number], h: 8.5, w: 1.5, a: "#EC4899", seed: 83, sb: 2 },
    { pos: [-14.5, -4, -1] as [number, number, number], h: 7, w: 1.3, a: "#38BDF8", seed: 89, sb: 2 },
    { pos: [15, -4, -3] as [number, number, number], h: 12, w: 1.8, a: "#A78BFA", seed: 97, sb: 3 },
    { pos: [-17.5, -4, 2.5] as [number, number, number], h: 8, w: 1.4, a: "#F59E0B", seed: 101, sb: 2 },
    { pos: [18.5, -4, 4] as [number, number, number], h: 5, w: 1.05, a: "#2DD4BF", seed: 113, sb: 1 },
  ], []);

  return (
    <group>
      {towers.map((t, i) => (
        <Tower key={i} position={t.pos} height={t.h} width={t.w} accent={t.a} seed={t.seed} setbacks={t.sb} />
      ))}
      {/* Reflective ground */}
      <mesh position={[0, -4.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#04050a" roughness={0.15} metalness={0.9} />
      </mesh>
    </group>
  );
}

/* ── Grid Floor ── */
function HoloGrid() {
  const ref = useRef<THREE.Group>(null);
  const geo = useMemo(() => {
    const verts: number[] = [];
    for (let i = -40; i <= 40; i += 2) verts.push(i, 0, -50, i, 0, 50);
    for (let j = -25; j <= 25; j += 2) verts.push(-40, 0, j * 2, 40, 0, j * 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    return g;
  }, []);

  useFrame((state) => {
    if (ref.current) ref.current.position.z = (state.clock.elapsedTime * 0.4) % 4;
  });

  return (
    <group ref={ref} position={[0, -3.99, 0]}>
      <lineSegments geometry={geo}>
        <lineBasicMaterial color="#2DD4BF" transparent opacity={0.05} />
      </lineSegments>
    </group>
  );
}

/* ── Futuristic Ship with jet trail ── */
function Ship({ color, speed, y, z, dir = 1, delay = 0 }: {
  color: string; speed: number; y: number; z: number; dir?: number; delay?: number;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = ((state.clock.elapsedTime + delay) * speed) % 1;
    ref.current.position.x = dir * (-32 + t * 64);
    ref.current.position.y = y + Math.sin(t * Math.PI * 4) * 0.4;
    ref.current.position.z = z + Math.sin(t * Math.PI * 2) * 1.5;
    ref.current.rotation.y = dir > 0 ? 0 : Math.PI;
    ref.current.rotation.z = Math.sin(t * Math.PI * 4) * 0.15 * dir;
  });

  return (
    <group ref={ref}>
      {/* Fuselage */}
      <mesh scale={[0.8, 0.08, 0.16]}>
        <boxGeometry />
        <meshStandardMaterial color="#0d1220" metalness={0.95} roughness={0.1} emissive={color} emissiveIntensity={0.15} />
      </mesh>
      {/* Nose */}
      <mesh position={[0.52, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.075, 0.28, 8]} />
        <meshStandardMaterial color="#0d1220" metalness={0.95} roughness={0.1} />
      </mesh>
      {/* Swept wings */}
      <mesh position={[-0.1, 0, 0.28]} rotation={[0, 0.55, 0]} scale={[0.32, 0.02, 0.42]}>
        <boxGeometry />
        <meshStandardMaterial color="#0d1220" metalness={0.9} roughness={0.15} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[-0.1, 0, -0.28]} rotation={[0, -0.55, 0]} scale={[0.32, 0.02, 0.42]}>
        <boxGeometry />
        <meshStandardMaterial color="#0d1220" metalness={0.9} roughness={0.15} emissive={color} emissiveIntensity={0.25} />
      </mesh>
      {/* Cockpit glow */}
      <mesh position={[0.25, 0.05, 0]} scale={[0.14, 0.05, 0.09]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
      {/* Engine glow */}
      <mesh position={[-0.42, 0, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Jet trail */}
      <mesh position={[-1.4, 0, 0]} scale={[1.9, 0.025, 0.025]}>
        <boxGeometry />
        <meshBasicMaterial color={color} transparent opacity={0.5} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh position={[-2.6, 0, 0]} scale={[1.4, 0.012, 0.012]}>
        <boxGeometry />
        <meshBasicMaterial color={color} transparent opacity={0.25} blending={THREE.AdditiveBlending} />
      </mesh>
      <pointLight color={color} intensity={0.5} distance={5} />
    </group>
  );
}

/* ── Data streams ── */
function DataStreams() {
  const refs = useRef<THREE.Mesh[]>([]);
  const streams = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => ({
      x: (Math.random() - 0.5) * 28,
      z: -2 + Math.random() * 8,
      speed: 1 + Math.random() * 2,
      color: ["#2DD4BF", "#8B5CF6", "#EC4899", "#38BDF8"][i % 4],
      height: 3 + Math.random() * 4,
    })), []);

  useFrame((state) => {
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const s = streams[i];
      mesh.position.y = -4 + ((state.clock.elapsedTime * s.speed) % (s.height + 9));
      (mesh.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.sin(state.clock.elapsedTime * 3 + i) * 0.08;
    });
  });

  return (
    <group>
      {streams.map((s, i) => (
        <mesh key={i} ref={el => { if (el) refs.current[i] = el; }} position={[s.x, 0, s.z]}>
          <cylinderGeometry args={[0.012, 0.012, s.height, 6]} />
          <meshBasicMaterial color={s.color} transparent opacity={0.15} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

/* ── Floating network nodes ── */
function NetworkNodes() {
  const groupRef = useRef<THREE.Group>(null);
  const nodes = useMemo(() =>
    Array.from({ length: 10 }, () => ({
      pos: [(Math.random() - 0.5) * 24, Math.random() * 8 + 1, Math.random() * 8 - 2] as [number, number, number],
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
          <Sphere args={[0.05, 8, 8]}>
            <meshBasicMaterial color={n.color} />
          </Sphere>
          <Sphere args={[0.13, 8, 8]}>
            <meshBasicMaterial color={n.color} transparent opacity={0.07} />
          </Sphere>
        </group>
      ))}
    </group>
  );
}

/* ── Hologram sign, far behind the city ── */
function GercepText() {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = 9 + Math.sin(t * 0.3) * 0.4;
    const flicker = Math.random() > 0.97 ? 0.6 : 1;
    ref.current.children.forEach(c => {
      const m = (c as THREE.Mesh).material as THREE.Material & { opacity?: number };
      if (m) m.opacity = flicker;
    });
  });

  return (
    <group ref={ref} position={[0, 9, -28]}>
      <Text fontSize={4.2} font="/fonts/SpaceGrotesk-Bold.ttf" color="#2DD4BF"
        anchorX="center" anchorY="middle" fillOpacity={0.06}
        outlineWidth={0.035} outlineColor="#2DD4BF" outlineOpacity={0.45}>
        GERCEP AI
      </Text>
      <Text fontSize={0.55} font="/fonts/SpaceGrotesk-Bold.ttf" color="#8B5CF6"
        anchorX="center" anchorY="middle" position={[0, -2.9, 0]} fillOpacity={0.25}
        outlineWidth={0.012} outlineColor="#8B5CF6" outlineOpacity={0.4} letterSpacing={0.25}>
        BUSINESS OS MASA DEPAN
      </Text>
    </group>
  );
}

/* ── Stars ── */
function StarField() {
  const ref = useRef<THREE.Points>(null);
  const count = 1200;
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const palette = [[0.18, 0.83, 0.75], [0.55, 0.36, 0.96], [0.93, 0.29, 0.6], [1, 1, 1]];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 90;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 70;
      pos[i * 3 + 2] = -8 - Math.random() * 35;
      const c = palette[Math.floor(Math.random() * palette.length)];
      const b = 0.3 + Math.random() * 0.7;
      col[i * 3] = c[0] * b; col[i * 3 + 1] = c[1] * b; col[i * 3 + 2] = c[2] * b;
    }
    return { positions: pos, colors: col };
  }, []);

  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.002;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.055} vertexColors transparent opacity={0.75} sizeAttenuation />
    </points>
  );
}

/* ── Scroll camera ── */
function ScrollCamera() {
  const { camera } = useThree();
  useFrame(() => {
    const targetY = 4.5 - globalScroll * 5;
    camera.position.y += (targetY - camera.position.y) * 0.02;
    camera.position.x += (Math.sin(globalScroll * Math.PI) * 2 - camera.position.x) * 0.01;
    camera.lookAt(0, targetY - 3, -2);
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
      <Canvas camera={{ position: [0, 4.5, 19], fov: 58 }} dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.25} />
          <directionalLight position={[6, 12, 8]} intensity={0.35} color="#8B5CF6" />
          <directionalLight position={[-6, 10, 6]} intensity={0.3} color="#2DD4BF" />
          <fog attach="fog" args={["#050508", 28, 75]} />

          <ScrollCamera />
          <StarField />
          <HoloGrid />
          <CityScape />
          <DataStreams />
          <NetworkNodes />
          <Suspense fallback={null}>
            <GercepText />
          </Suspense>

          {/* Futuristic ships crossing the sky */}
          <Ship color="#2DD4BF" speed={0.055} y={4} z={2} dir={1} delay={0} />
          <Ship color="#EC4899" speed={0.04} y={6.5} z={-3} dir={-1} delay={5} />
          <Ship color="#8B5CF6" speed={0.07} y={2.5} z={5} dir={1} delay={9} />
          <Ship color="#38BDF8" speed={0.035} y={8} z={-6} dir={-1} delay={14} />
          <Ship color="#F59E0B" speed={0.05} y={5.5} z={7} dir={1} delay={20} />

          <EffectComposer>
            <Bloom intensity={1.1} luminanceThreshold={0.12} mipmapBlur radius={0.75} />
            <ChromaticAberration offset={new THREE.Vector2(0.0005, 0.0005)} radialModulation modulationOffset={0.5} />
          </EffectComposer>
        </Suspense>
      </Canvas>
      {/* Dark vignette so page content stays readable over the city */}
      <div className="absolute inset-0" style={{
        background: "radial-gradient(ellipse at 50% 45%, rgba(5,5,8,0.25) 0%, rgba(5,5,8,0.55) 60%, rgba(5,5,8,0.8) 100%)",
      }} />
    </div>
  );
}
