"use client";
import { useRef, useMemo, Suspense, useCallback } from "react";
import { Canvas, useFrame, useThree, extend } from "@react-three/fiber";
import { Float, Icosahedron, Torus, TorusKnot, MeshDistortMaterial, Sphere, shaderMaterial } from "@react-three/drei";
import { EffectComposer, Bloom, ChromaticAberration } from "@react-three/postprocessing";
import * as THREE from "three";

/* ─── Holographic Crystal ─── */
function HoloCrystal() {
  const ref = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ref.current) {
      ref.current.rotation.y = t * 0.12;
      ref.current.rotation.x = Math.sin(t * 0.08) * 0.15;
      ref.current.rotation.z = Math.cos(t * 0.06) * 0.1;
    }
    if (innerRef.current) {
      (innerRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.4 + Math.sin(t * 2) * 0.2;
    }
    if (outerRef.current) {
      outerRef.current.rotation.y = -t * 0.08;
      outerRef.current.rotation.x = t * 0.05;
    }
  });

  return (
    <group ref={ref} position={[0, 0, 0]}>
      {/* Core crystal */}
      <Icosahedron ref={innerRef} args={[1.4, 1]} castShadow>
        <MeshDistortMaterial
          color="#2DD4BF"
          emissive="#8B5CF6"
          emissiveIntensity={0.4}
          roughness={0.05}
          metalness={0.95}
          distort={0.35}
          speed={2.5}
          transparent
          opacity={0.85}
        />
      </Icosahedron>

      {/* Wireframe shell */}
      <Icosahedron args={[1.8, 2]} >
        <meshBasicMaterial color="#2DD4BF" wireframe transparent opacity={0.12} />
      </Icosahedron>

      {/* Orbiting torus knot */}
      <group ref={outerRef}>
        <TorusKnot args={[2.6, 0.015, 256, 8, 2, 3]}>
          <meshBasicMaterial color="#EC4899" transparent opacity={0.5} />
        </TorusKnot>
        <TorusKnot args={[2.8, 0.01, 256, 8, 3, 5]}>
          <meshBasicMaterial color="#8B5CF6" transparent opacity={0.35} />
        </TorusKnot>
      </group>

      {/* Energy rings */}
      <EnergyRing radius={3.2} color="#2DD4BF" speed={0.15} axis="x" />
      <EnergyRing radius={3.5} color="#8B5CF6" speed={-0.1} axis="y" />
      <EnergyRing radius={3.8} color="#EC4899" speed={0.08} axis="z" />

      {/* Glow sphere */}
      <Sphere args={[2.2, 32, 32]}>
        <meshBasicMaterial color="#2DD4BF" transparent opacity={0.03} />
      </Sphere>
    </group>
  );
}

function EnergyRing({ radius, color, speed, axis }: { radius: number; color: string; speed: number; axis: "x" | "y" | "z" }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * speed;
    if (axis === "x") { ref.current.rotation.x = t; ref.current.rotation.z = t * 0.3; }
    else if (axis === "y") { ref.current.rotation.y = t; ref.current.rotation.x = t * 0.2; }
    else { ref.current.rotation.z = t; ref.current.rotation.y = t * 0.4; }
  });
  return (
    <mesh ref={ref}>
      <torusGeometry args={[radius, 0.006, 16, 128]} />
      <meshBasicMaterial color={color} transparent opacity={0.3} />
    </mesh>
  );
}

/* ─── Neural Network Particles ─── */
function NeuralNetwork({ count = 120 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);

  const { positions, velocities } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 4 + Math.random() * 4;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      vel[i * 3] = (Math.random() - 0.5) * 0.003;
      vel[i * 3 + 1] = (Math.random() - 0.5) * 0.003;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.003;
    }
    return { positions: pos, velocities: vel };
  }, [count]);

  const colors = useMemo(() => {
    const arr = new Float32Array(count * 3);
    const palette = [[0.18, 0.83, 0.75], [0.55, 0.36, 0.96], [0.93, 0.29, 0.60], [0.22, 0.74, 0.97]];
    for (let i = 0; i < count; i++) {
      const c = palette[Math.floor(Math.random() * palette.length)];
      arr[i * 3] = c[0]; arr[i * 3 + 1] = c[1]; arr[i * 3 + 2] = c[2];
    }
    return arr;
  }, [count]);

  const linePositions = useMemo(() => new Float32Array(count * count * 6), [count]);
  const lineColors = useMemo(() => new Float32Array(count * count * 6), [count]);

  useFrame(() => {
    if (!pointsRef.current || !linesRef.current) return;
    const pos = pointsRef.current.geometry.attributes.position;

    for (let i = 0; i < count; i++) {
      pos.array[i * 3] += velocities[i * 3];
      pos.array[i * 3 + 1] += velocities[i * 3 + 1];
      pos.array[i * 3 + 2] += velocities[i * 3 + 2];

      const dist = Math.sqrt(pos.array[i * 3] ** 2 + pos.array[i * 3 + 1] ** 2 + pos.array[i * 3 + 2] ** 2);
      if (dist > 8 || dist < 3.5) {
        velocities[i * 3] *= -1;
        velocities[i * 3 + 1] *= -1;
        velocities[i * 3 + 2] *= -1;
      }
    }
    pos.needsUpdate = true;

    let lineIdx = 0;
    const maxDist = 2.5;
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        const dx = pos.array[i * 3] - pos.array[j * 3];
        const dy = pos.array[i * 3 + 1] - pos.array[j * 3 + 1];
        const dz = pos.array[i * 3 + 2] - pos.array[j * 3 + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < maxDist && lineIdx < count * count) {
          const alpha = 1 - d / maxDist;
          linePositions[lineIdx * 6] = pos.array[i * 3];
          linePositions[lineIdx * 6 + 1] = pos.array[i * 3 + 1];
          linePositions[lineIdx * 6 + 2] = pos.array[i * 3 + 2];
          linePositions[lineIdx * 6 + 3] = pos.array[j * 3];
          linePositions[lineIdx * 6 + 4] = pos.array[j * 3 + 1];
          linePositions[lineIdx * 6 + 5] = pos.array[j * 3 + 2];
          lineColors[lineIdx * 6] = 0.18 * alpha; lineColors[lineIdx * 6 + 1] = 0.83 * alpha; lineColors[lineIdx * 6 + 2] = 0.75 * alpha;
          lineColors[lineIdx * 6 + 3] = 0.55 * alpha; lineColors[lineIdx * 6 + 4] = 0.36 * alpha; lineColors[lineIdx * 6 + 5] = 0.96 * alpha;
          lineIdx++;
        }
      }
    }

    const lineGeo = linesRef.current.geometry;
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions.slice(0, lineIdx * 6), 3));
    lineGeo.setAttribute("color", new THREE.BufferAttribute(lineColors.slice(0, lineIdx * 6), 3));
    lineGeo.attributes.position.needsUpdate = true;
    lineGeo.attributes.color.needsUpdate = true;
    lineGeo.setDrawRange(0, lineIdx * 2);
  });

  return (
    <>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.06} vertexColors transparent opacity={0.9} sizeAttenuation />
      </points>
      <lineSegments ref={linesRef}>
        <bufferGeometry />
        <lineBasicMaterial vertexColors transparent opacity={0.15} />
      </lineSegments>
    </>
  );
}

/* ─── Floating Debris ─── */
function FloatingDebris() {
  const group = useRef<THREE.Group>(null);
  const items = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      pos: [(Math.random() - 0.5) * 16, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 10] as [number, number, number],
      scale: 0.02 + Math.random() * 0.06,
      speed: 0.1 + Math.random() * 0.4,
      color: ["#2DD4BF", "#8B5CF6", "#EC4899", "#38BDF8"][Math.floor(Math.random() * 4)],
    }));
  }, []);

  useFrame((state) => {
    if (!group.current) return;
    group.current.children.forEach((child, i) => {
      const item = items[i];
      child.rotation.x = state.clock.elapsedTime * item.speed * 0.5;
      child.rotation.y = state.clock.elapsedTime * item.speed;
      child.position.y = item.pos[1] + Math.sin(state.clock.elapsedTime * item.speed + i) * 0.3;
    });
  });

  return (
    <group ref={group}>
      {items.map((item, i) => (
        <mesh key={i} position={item.pos} scale={item.scale}>
          <octahedronGeometry args={[1, 0]} />
          <meshBasicMaterial color={item.color} transparent opacity={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/* ─── Mouse Camera ─── */
function MouseCamera() {
  const { camera } = useThree();
  useFrame((state) => {
    const mx = state.pointer.x * 1.2;
    const my = state.pointer.y * 0.6;
    camera.position.x += (mx - camera.position.x) * 0.015;
    camera.position.y += (my - camera.position.y) * 0.015;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/* ─── Main Scene ─── */
export default function HeroScene() {
  return (
    <div className="absolute inset-0" style={{ zIndex: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 55 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.2} />
          <pointLight position={[5, 5, 5]} intensity={0.8} color="#2DD4BF" />
          <pointLight position={[-5, -3, 3]} intensity={0.5} color="#EC4899" />
          <pointLight position={[0, -5, -5]} intensity={0.4} color="#8B5CF6" />
          <spotLight position={[0, 10, 0]} intensity={0.3} color="#2DD4BF" angle={0.5} penumbra={1} />

          <Float speed={0.8} rotationIntensity={0.1} floatIntensity={0.4}>
            <HoloCrystal />
          </Float>

          <NeuralNetwork count={100} />
          <FloatingDebris />
          <MouseCamera />

          <EffectComposer>
            <Bloom
              intensity={1.2}
              luminanceThreshold={0.2}
              luminanceSmoothing={0.9}
              mipmapBlur
            />
            <ChromaticAberration
              offset={new THREE.Vector2(0.0008, 0.0008)}
              radialModulation
              modulationOffset={0.5}
            />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
