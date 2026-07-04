"use client";
import { useRef, Suspense, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float, RoundedBox, Text } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

function DashboardScreen() {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.08;
    groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.03 - 0.1;
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      {/* Monitor body */}
      <RoundedBox args={[5.5, 3.2, 0.1]} radius={0.08} smoothness={4} position={[0, 0.5, 0]}>
        <meshStandardMaterial color="#0A0A14" metalness={0.9} roughness={0.1} emissive="#1a1a2e" emissiveIntensity={0.1} />
      </RoundedBox>
      {/* Screen */}
      <RoundedBox args={[5.2, 2.9, 0.05]} radius={0.05} smoothness={4} position={[0, 0.5, 0.06]}>
        <meshStandardMaterial color="#0D0D1A" emissive="#2DD4BF" emissiveIntensity={hovered ? 0.08 : 0.04} />
      </RoundedBox>
      {/* Stand */}
      <mesh position={[0, -1.2, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.8, 16]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[0, -1.6, 0.2]} rotation={[-0.2, 0, 0]}>
        <cylinderGeometry args={[0.6, 0.8, 0.05, 32]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* KPI cards on screen */}
      <FloatingCard position={[-1.8, 1.3, 0.15]} color="#2DD4BF" width={1.2} height={0.5} />
      <FloatingCard position={[-0.4, 1.3, 0.15]} color="#38BDF8" width={1.2} height={0.5} />
      <FloatingCard position={[1.0, 1.3, 0.15]} color="#A78BFA" width={1.2} height={0.5} />
      {/* Chart area */}
      <FloatingCard position={[-0.8, 0.2, 0.15]} color="#2DD4BF" width={2.8} height={1.2} />
      {/* Side panel */}
      <FloatingCard position={[1.6, 0.2, 0.15]} color="#8B5CF6" width={1.2} height={1.2} />
      {/* Chart bars */}
      <ChartBars position={[-1.6, -0.1, 0.18]} />

      {/* Floating popup cards around monitor */}
      <Float speed={2} rotationIntensity={0.05} floatIntensity={0.3}>
        <PopupCard position={[3.5, 1.5, 0.5]} color="#2DD4BF" label="Transaksi" />
      </Float>
      <Float speed={1.5} rotationIntensity={0.05} floatIntensity={0.4}>
        <PopupCard position={[-3.5, 0, 0.8]} color="#8B5CF6" label="Marketplace" />
      </Float>
      <Float speed={2.5} rotationIntensity={0.05} floatIntensity={0.2}>
        <PopupCard position={[3.2, -0.8, 0.6]} color="#EC4899" label="AI Insight" />
      </Float>
    </group>
  );
}

function FloatingCard({ position, color, width, height }: { position: [number, number, number]; color: string; width: number; height: number }) {
  return (
    <RoundedBox args={[width, height, 0.02]} radius={0.03} position={position}>
      <meshBasicMaterial color={color} transparent opacity={0.08} />
    </RoundedBox>
  );
}

function PopupCard({ position, color, label }: { position: [number, number, number]; color: string; label: string }) {
  return (
    <group position={position}>
      <RoundedBox args={[1.4, 0.7, 0.03]} radius={0.05}>
        <meshStandardMaterial color="#0D0D1A" emissive={color} emissiveIntensity={0.15} metalness={0.5} roughness={0.3} />
      </RoundedBox>
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[1.3, 0.05]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

function ChartBars({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.children.forEach((child, i) => {
      const target = 0.1 + Math.abs(Math.sin(state.clock.elapsedTime * 0.5 + i * 0.8)) * 0.6;
      child.scale.y += (target - child.scale.y) * 0.03;
    });
  });

  return (
    <group ref={ref} position={position}>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[i * 0.2, 0, 0]} scale={[0.1, 0.3, 0.02]}>
          <boxGeometry />
          <meshBasicMaterial color={i % 2 === 0 ? "#2DD4BF" : "#8B5CF6"} transparent opacity={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function DragHint() {
  const { camera } = useThree();
  useFrame((state) => {
    camera.position.x += (state.pointer.x * 0.5 - camera.position.x) * 0.01;
    camera.position.y += (state.pointer.y * 0.3 + 0.5 - camera.position.y) * 0.01;
    camera.lookAt(0, 0, 0);
  });
  return null;
}

export default function DashboardScene() {
  return (
    <div className="w-full" style={{ height: 500 }}>
      <Canvas camera={{ position: [0, 0.5, 5], fov: 50 }} dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }} style={{ background: "transparent" }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.3} />
          <pointLight position={[3, 3, 5]} intensity={0.5} color="#2DD4BF" />
          <pointLight position={[-3, 2, 3]} intensity={0.3} color="#8B5CF6" />
          <spotLight position={[0, 5, 5]} intensity={0.4} color="#2DD4BF" angle={0.5} penumbra={1} />
          <DashboardScreen />
          <DragHint />
          <EffectComposer>
            <Bloom intensity={0.8} luminanceThreshold={0.2} mipmapBlur />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
