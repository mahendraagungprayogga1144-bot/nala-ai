"use client";
import { useRef, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, Icosahedron, MeshDistortMaterial, Sphere, Text3D, Center, TorusKnot, Torus } from "@react-three/drei";
import { EffectComposer, Bloom, ChromaticAberration } from "@react-three/postprocessing";
import * as THREE from "three";

/* ── Massive Holographic Globe ── */
function HoloGlobe() {
  const wireRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const gridRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (wireRef.current) { wireRef.current.rotation.y = t * 0.06; wireRef.current.rotation.x = Math.sin(t * 0.03) * 0.1; }
    if (innerRef.current) { innerRef.current.rotation.y = -t * 0.04; (innerRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + Math.sin(t * 1.5) * 0.15; }
    if (gridRef.current) { gridRef.current.rotation.y = t * 0.08; gridRef.current.rotation.z = t * 0.02; }
  });

  return (
    <group position={[1.5, 0, 0]}>
      {/* Inner glow core */}
      <Sphere ref={innerRef} args={[1.6, 64, 64]}>
        <MeshDistortMaterial color="#0A2A2A" emissive="#2DD4BF" emissiveIntensity={0.3} roughness={0.1} metalness={0.9} distort={0.2} speed={2} transparent opacity={0.6} />
      </Sphere>
      {/* Primary wireframe globe */}
      <Sphere ref={wireRef} args={[2.3, 32, 32]}>
        <meshBasicMaterial color="#2DD4BF" wireframe transparent opacity={0.15} />
      </Sphere>
      {/* Secondary wireframe */}
      <Sphere ref={gridRef} args={[2.5, 24, 24]}>
        <meshBasicMaterial color="#8B5CF6" wireframe transparent opacity={0.07} />
      </Sphere>
      {/* Outer glow */}
      <Sphere args={[2.8, 32, 32]}>
        <meshBasicMaterial color="#2DD4BF" transparent opacity={0.02} side={THREE.BackSide} />
      </Sphere>
      {/* Latitude rings */}
      {[-0.8, 0, 0.8].map((y, i) => (
        <mesh key={i} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.8 * Math.cos(Math.asin(y / 2.3)), 1.8 * Math.cos(Math.asin(y / 2.3)) + 0.005, 64]} />
          <meshBasicMaterial color="#2DD4BF" transparent opacity={0.12} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* Orbiting energy rings */}
      <OrbitRing radius={3.0} color="#2DD4BF" speed={0.1} tilt={0.3} />
      <OrbitRing radius={3.3} color="#8B5CF6" speed={-0.07} tilt={-0.5} />
      <OrbitRing radius={3.6} color="#EC4899" speed={0.05} tilt={0.8} />
      {/* Orbiting satellites */}
      <OrbitalDots count={8} radius={2.8} color="#2DD4BF" speed={0.15} />
      <OrbitalDots count={6} radius={3.2} color="#8B5CF6" speed={-0.1} />
    </group>
  );
}

function OrbitRing({ radius, color, speed, tilt }: { radius: number; color: string; speed: number; tilt: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => { if (ref.current) { ref.current.rotation.y = state.clock.elapsedTime * speed; } });
  return (
    <mesh ref={ref} rotation={[tilt, 0, tilt * 0.5]}>
      <torusGeometry args={[radius, 0.005, 8, 128]} />
      <meshBasicMaterial color={color} transparent opacity={0.25} />
    </mesh>
  );
}

function OrbitalDots({ count, radius, color, speed }: { count: number; radius: number; color: string; speed: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => { if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * speed; });
  return (
    <group ref={ref}>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(angle) * radius, (Math.random() - 0.5) * 1.5, Math.sin(angle) * radius]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshBasicMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ── Particle Cloud ── */
function ParticleField({ count = 500 }: { count?: number }) {
  const ref = useRef<THREE.Points>(null);
  const { positions, colors, sizes } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const sz = new Float32Array(count);
    const palette = [[0.18, 0.83, 0.75], [0.55, 0.36, 0.96], [0.93, 0.29, 0.60], [0.22, 0.74, 0.97]];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 25;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 18;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 15 - 3;
      const c = palette[Math.floor(Math.random() * palette.length)];
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
      sz[i] = 0.01 + Math.random() * 0.04;
    }
    return { positions: pos, colors: col, sizes: sz };
  }, [count]);

  useFrame((_, delta) => { if (ref.current) ref.current.rotation.y += delta * 0.008; });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.04} vertexColors transparent opacity={0.7} sizeAttenuation />
    </points>
  );
}

/* ── Floating 3D Shapes ── */
function FloatingShapes() {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.children.forEach((child, i) => {
      child.rotation.x = state.clock.elapsedTime * (0.1 + i * 0.05);
      child.rotation.y = state.clock.elapsedTime * (0.15 + i * 0.03);
      child.position.y += Math.sin(state.clock.elapsedTime * 0.5 + i * 2) * 0.002;
    });
  });

  const shapes = useMemo(() => [
    { pos: [-5, 3, -2] as [number, number, number], scale: 0.15, color: "#EC4899" },
    { pos: [5, -2, -3] as [number, number, number], scale: 0.12, color: "#8B5CF6" },
    { pos: [-4, -3, -1] as [number, number, number], scale: 0.1, color: "#2DD4BF" },
    { pos: [6, 2, -4] as [number, number, number], scale: 0.08, color: "#38BDF8" },
    { pos: [-6, 0, -5] as [number, number, number], scale: 0.14, color: "#A78BFA" },
    { pos: [3, 4, -3] as [number, number, number], scale: 0.09, color: "#F59E0B" },
  ], []);

  return (
    <group ref={ref}>
      {shapes.map((s, i) => (
        <Float key={i} speed={1 + i * 0.3} rotationIntensity={0.4} floatIntensity={0.6}>
          <mesh position={s.pos} scale={s.scale}>
            {i % 3 === 0 ? <icosahedronGeometry args={[1, 0]} /> : i % 3 === 1 ? <octahedronGeometry args={[1, 0]} /> : <tetrahedronGeometry args={[1, 0]} />}
            <meshBasicMaterial color={s.color} wireframe transparent opacity={0.5} />
          </mesh>
        </Float>
      ))}
    </group>
  );
}

/* ── Mouse Camera ── */
function MouseCamera() {
  const { camera } = useThree();
  useFrame((state) => {
    camera.position.x += (state.pointer.x * 1.0 - camera.position.x) * 0.012;
    camera.position.y += (state.pointer.y * 0.5 - camera.position.y) * 0.012;
    camera.lookAt(0.5, 0, 0);
  });
  return null;
}

export default function HeroScene() {
  return (
    <div className="absolute inset-0" style={{ zIndex: 0 }}>
      <Canvas camera={{ position: [0, 0, 7], fov: 55 }} dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }} style={{ background: "transparent" }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.15} />
          <pointLight position={[5, 3, 5]} intensity={0.6} color="#2DD4BF" />
          <pointLight position={[-4, -2, 3]} intensity={0.4} color="#EC4899" />
          <pointLight position={[0, 5, -3]} intensity={0.3} color="#8B5CF6" />
          <spotLight position={[2, 8, 4]} intensity={0.5} color="#2DD4BF" angle={0.4} penumbra={1} />
          <HoloGlobe />
          <ParticleField count={400} />
          <FloatingShapes />
          <MouseCamera />
          <EffectComposer>
            <Bloom intensity={1.5} luminanceThreshold={0.15} luminanceSmoothing={0.9} mipmapBlur />
            <ChromaticAberration offset={new THREE.Vector2(0.001, 0.001)} radialModulation modulationOffset={0.5} />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
