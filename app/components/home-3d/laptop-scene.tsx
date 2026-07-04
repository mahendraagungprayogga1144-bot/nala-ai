"use client";
import { useRef, useMemo, Suspense, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { RoundedBox, Float, Edges } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

/* ── Draw the Gercep dashboard onto a canvas texture ── */
function drawDashboard(): THREE.CanvasTexture {
  const W = 1280, H = 800;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d")!;

  // Background
  x.fillStyle = "#070711"; x.fillRect(0, 0, W, H);

  // Top bar
  x.fillStyle = "#0D0D1A"; x.fillRect(0, 0, W, 60);
  x.strokeStyle = "rgba(45,212,191,0.15)"; x.lineWidth = 2;
  x.beginPath(); x.moveTo(0, 60); x.lineTo(W, 60); x.stroke();
  ["#EC4899", "#F59E0B", "#4ADE80"].forEach((col, i) => {
    x.fillStyle = col; x.beginPath(); x.arc(30 + i * 28, 30, 7, 0, Math.PI * 2); x.fill();
  });
  x.fillStyle = "#12121f"; x.beginPath(); x.roundRect(W / 2 - 160, 16, 320, 28, 14); x.fill();
  x.fillStyle = "#5A5B7A"; x.font = "16px monospace"; x.textAlign = "center";
  x.fillText("dashboard.gercep.ai", W / 2, 36);

  // Sidebar
  x.fillStyle = "#0A0A14"; x.fillRect(0, 60, 200, H - 60);
  const grad = x.createLinearGradient(20, 84, 50, 114);
  grad.addColorStop(0, "#2DD4BF"); grad.addColorStop(1, "#8B5CF6");
  x.fillStyle = grad; x.beginPath(); x.roundRect(20, 84, 32, 32, 8); x.fill();
  x.fillStyle = "#F2F1F8"; x.font = "bold 17px sans-serif"; x.textAlign = "left";
  x.fillText("GERCEP AI", 62, 106);
  const menu = ["Dashboard", "Keuangan", "Inventory", "AI Kasir", "Marketplace", "Pajak NPWP", "Smart Profit", "Insight AI"];
  menu.forEach((m, i) => {
    if (i === 0) {
      x.fillStyle = "rgba(45,212,191,0.12)";
      x.beginPath(); x.roundRect(12, 140 + i * 46, 176, 38, 8); x.fill();
      x.fillStyle = "#2DD4BF";
    } else x.fillStyle = "#5A5B7A";
    x.font = "15px sans-serif";
    x.fillText(m, 28, 164 + i * 46);
  });

  // KPI cards
  const kpis = [
    { l: "OMZET", v: "Rp 125.430.000", ch: "+18.2%", col: "#2DD4BF" },
    { l: "PROFIT", v: "Rp 42.780.000", ch: "+12.4%", col: "#4ADE80" },
    { l: "TRANSAKSI", v: "12.458", ch: "+23.5%", col: "#38BDF8" },
    { l: "PRODUK", v: "847", ch: "+5", col: "#A78BFA" },
  ];
  kpis.forEach((k, i) => {
    const cx = 224 + i * 262;
    x.fillStyle = "#0D0D1A"; x.beginPath(); x.roundRect(cx, 84, 244, 96, 12); x.fill();
    x.strokeStyle = k.col + "40"; x.lineWidth = 1.5;
    x.beginPath(); x.roundRect(cx, 84, 244, 96, 12); x.stroke();
    x.fillStyle = "#5A5B7A"; x.font = "12px sans-serif"; x.fillText(k.l, cx + 18, 110);
    x.fillStyle = k.col; x.font = "bold 22px monospace";
    x.shadowColor = k.col; x.shadowBlur = 12;
    x.fillText(k.v, cx + 18, 142);
    x.shadowBlur = 0;
    x.fillStyle = "#4ADE80"; x.font = "13px sans-serif"; x.fillText("↑ " + k.ch, cx + 18, 166);
  });

  // Revenue chart panel
  x.fillStyle = "#0D0D1A"; x.beginPath(); x.roundRect(224, 200, 660, 420, 14); x.fill();
  x.strokeStyle = "rgba(45,212,191,0.2)"; x.beginPath(); x.roundRect(224, 200, 660, 420, 14); x.stroke();
  x.fillStyle = "#8B8AA0"; x.font = "bold 15px sans-serif"; x.fillText("REVENUE TREND", 248, 232);

  // Bars
  const bars = [35, 48, 40, 58, 52, 68, 62, 78, 70, 85, 80, 92, 86, 95, 90, 98];
  bars.forEach((h, i) => {
    const bx = 252 + i * 38, bh = h * 3.4, by = 596 - bh;
    const bg = x.createLinearGradient(0, by, 0, 596);
    bg.addColorStop(0, "#2DD4BF"); bg.addColorStop(1, "#8B5CF6");
    x.fillStyle = bg; x.globalAlpha = 0.55 + i / 40;
    x.beginPath(); x.roundRect(bx, by, 26, bh, 5); x.fill();
    x.globalAlpha = 1;
  });
  // Trend line
  x.strokeStyle = "#EC4899"; x.lineWidth = 3;
  x.shadowColor = "#EC4899"; x.shadowBlur = 10;
  x.beginPath();
  bars.forEach((h, i) => {
    const px = 265 + i * 38, py = 590 - h * 3.4 - 22;
    i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
  });
  x.stroke(); x.shadowBlur = 0;

  // Right panel — Top Produk
  x.fillStyle = "#0D0D1A"; x.beginPath(); x.roundRect(900, 200, 344, 200, 14); x.fill();
  x.strokeStyle = "rgba(139,92,246,0.25)"; x.beginPath(); x.roundRect(900, 200, 344, 200, 14); x.stroke();
  x.fillStyle = "#8B8AA0"; x.font = "bold 14px sans-serif"; x.fillText("TOP PRODUK", 922, 230);
  const prods: [string, number, string][] = [["Skincare Set", 0.92, "#2DD4BF"], ["Masker Wajah", 0.71, "#8B5CF6"], ["Serum Vit C", 0.55, "#EC4899"]];
  prods.forEach(([name, pct, col], i) => {
    x.fillStyle = "#C4C3D4"; x.font = "14px sans-serif"; x.fillText(name as string, 922, 262 + i * 44);
    x.fillStyle = "rgba(255,255,255,0.07)"; x.beginPath(); x.roundRect(922, 272 + i * 44, 300, 8, 4); x.fill();
    x.fillStyle = col as string;
    x.shadowColor = col as string; x.shadowBlur = 8;
    x.beginPath(); x.roundRect(922, 272 + i * 44, 300 * (pct as number), 8, 4); x.fill();
    x.shadowBlur = 0;
  });

  // Right panel — Donut chart
  x.fillStyle = "#0D0D1A"; x.beginPath(); x.roundRect(900, 420, 344, 200, 14); x.fill();
  x.strokeStyle = "rgba(236,72,153,0.25)"; x.beginPath(); x.roundRect(900, 420, 344, 200, 14); x.stroke();
  x.fillStyle = "#8B8AA0"; x.font = "bold 14px sans-serif"; x.fillText("MARKETPLACE", 922, 450);
  const cx2 = 1000, cy2 = 535, r2 = 52;
  const segs: [number, number, string][] = [[0, 0.45, "#F97316"], [0.45, 0.75, "#EC4899"], [0.75, 1, "#22C55E"]];
  segs.forEach(([a, b, col]) => {
    x.strokeStyle = col as string; x.lineWidth = 20;
    x.beginPath(); x.arc(cx2, cy2, r2, (a as number) * Math.PI * 2 - Math.PI / 2, (b as number) * Math.PI * 2 - Math.PI / 2);
    x.stroke();
  });
  const legend: [string, string][] = [["Shopee 45%", "#F97316"], ["TikTok 30%", "#EC4899"], ["Tokped 25%", "#22C55E"]];
  legend.forEach(([t, col], i) => {
    x.fillStyle = col as string; x.fillRect(1090, 495 + i * 30, 12, 12);
    x.fillStyle = "#8B8AA0"; x.font = "13px sans-serif"; x.fillText(t as string, 1110, 506 + i * 30);
  });

  // AI chat bubble
  x.fillStyle = "rgba(45,212,191,0.08)"; x.beginPath(); x.roundRect(224, 644, 660, 120, 14); x.fill();
  x.strokeStyle = "rgba(45,212,191,0.3)"; x.beginPath(); x.roundRect(224, 644, 660, 120, 14); x.stroke();
  x.fillStyle = "#2DD4BF"; x.font = "bold 14px sans-serif"; x.fillText("✦ GERCEP AI ASSISTANT", 248, 676);
  x.fillStyle = "#C4C3D4"; x.font = "15px sans-serif";
  x.fillText("Omzet naik 18% minggu ini! Produk skincare paling laris.", 248, 706);
  x.fillText("Mau saya buatkan laporan lengkap?", 248, 730);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ── Mini holo side panel texture ── */
function drawSidePanel(title: string, accent: string, type: "bars" | "spark"): THREE.CanvasTexture {
  const W = 256, H = 320;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d")!;
  x.fillStyle = "rgba(7,7,17,0.92)"; x.fillRect(0, 0, W, H);
  x.strokeStyle = accent; x.lineWidth = 2; x.globalAlpha = 0.6;
  x.strokeRect(1, 1, W - 2, H - 2); x.globalAlpha = 1;
  x.fillStyle = accent; x.font = "bold 16px sans-serif"; x.fillText(title, 20, 38);
  if (type === "bars") {
    [0.85, 0.6, 0.72, 0.45, 0.9].forEach((p, i) => {
      x.fillStyle = "rgba(255,255,255,0.08)"; x.beginPath(); x.roundRect(20, 70 + i * 46, 216, 12, 6); x.fill();
      x.fillStyle = accent; x.shadowColor = accent; x.shadowBlur = 8;
      x.beginPath(); x.roundRect(20, 70 + i * 46, 216 * p, 12, 6); x.fill();
      x.shadowBlur = 0;
    });
  } else {
    x.strokeStyle = accent; x.lineWidth = 3; x.shadowColor = accent; x.shadowBlur = 10;
    x.beginPath();
    const pts = [200, 180, 190, 150, 160, 120, 130, 90, 100, 70];
    pts.forEach((p, i) => { const px = 20 + i * 24; i === 0 ? x.moveTo(px, p + 60) : x.lineTo(px, p + 60); });
    x.stroke(); x.shadowBlur = 0;
    x.fillStyle = "#4ADE80"; x.font = "bold 28px monospace"; x.fillText("+18.2%", 20, 300);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ── Laptop model with opening lid ── */
function Laptop() {
  const groupRef = useRef<THREE.Group>(null);
  const lidRef = useRef<THREE.Group>(null);
  const openT = useRef(0);
  const rotTarget = useRef(0);
  const dragging = useRef(false);
  const { gl } = useThree();
  const screenTex = useMemo(() => drawDashboard(), []);

  useEffect(() => {
    const el = gl.domElement;
    let lastX = 0;
    const down = (e: PointerEvent) => { dragging.current = true; lastX = e.clientX; };
    const move = (e: PointerEvent) => {
      if (!dragging.current) return;
      rotTarget.current += (e.clientX - lastX) * 0.006;
      lastX = e.clientX;
    };
    const up = () => { dragging.current = false; };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [gl]);

  useFrame((state, delta) => {
    // Lid opens over ~2.5s with ease-out
    openT.current = Math.min(1, openT.current + delta * 0.4);
    const ease = 1 - Math.pow(1 - openT.current, 3);
    if (lidRef.current) lidRef.current.rotation.x = -1.95 * ease;

    if (groupRef.current) {
      const idle = dragging.current ? 0 : Math.sin(state.clock.elapsedTime * 0.35) * 0.18;
      groupRef.current.rotation.y += (rotTarget.current + idle - groupRef.current.rotation.y) * 0.05;
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.9, 0]}>
      {/* Base */}
      <RoundedBox args={[3.6, 0.14, 2.4]} radius={0.04}>
        <meshStandardMaterial color="#0c0f1a" metalness={0.9} roughness={0.25} />
      </RoundedBox>
      {/* Keyboard deck */}
      <mesh position={[0, 0.072, -0.15]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[3.2, 1.35]} />
        <meshStandardMaterial color="#05070d" roughness={0.6} metalness={0.5} />
      </mesh>
      {/* Trackpad */}
      <mesh position={[0, 0.073, 0.78]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.0, 0.5]} />
        <meshStandardMaterial color="#0a0e1a" roughness={0.25} metalness={0.7} />
      </mesh>

      {/* Lid (hinged at back edge) */}
      <group ref={lidRef} position={[0, 0.07, -1.2]}>
        <RoundedBox args={[3.6, 0.1, 2.4]} radius={0.04} position={[0, 0.05, 1.2]}>
          <meshStandardMaterial color="#0c0f1a" metalness={0.9} roughness={0.25} />
        </RoundedBox>
        {/* Logo on lid top */}
        <mesh position={[0, 0.105, 1.2]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.22, 32]} />
          <meshBasicMaterial color="#2DD4BF" transparent opacity={0.85} />
        </mesh>
        {/* Bezel (behind screen) */}
        <mesh position={[0, -0.002, 1.2]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.5, 2.24]} />
          <meshBasicMaterial color="#0a0d16" />
        </mesh>
        {/* Screen (inner face, visible when open) */}
        <mesh position={[0, -0.01, 1.2]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[3.36, 2.1]} />
          <meshBasicMaterial map={screenTex} toneMapped={false} />
        </mesh>
      </group>

      {/* Glow platform rings under laptop */}
      <PlatformRings />
    </group>
  );
}

function PlatformRings() {
  const r1 = useRef<THREE.Mesh>(null);
  const r2 = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (r1.current) r1.current.rotation.z = t * 0.25;
    if (r2.current) r2.current.rotation.z = -t * 0.18;
  });
  return (
    <group position={[0, -0.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh ref={r1}>
        <torusGeometry args={[2.6, 0.015, 8, 100]} />
        <meshBasicMaterial color="#2DD4BF" transparent opacity={0.5} />
      </mesh>
      <mesh ref={r2}>
        <torusGeometry args={[3.1, 0.01, 8, 100]} />
        <meshBasicMaterial color="#8B5CF6" transparent opacity={0.35} />
      </mesh>
      <mesh>
        <circleGeometry args={[2.4, 48]} />
        <meshBasicMaterial color="#2DD4BF" transparent opacity={0.04} />
      </mesh>
    </group>
  );
}

/* ── Floating holo side panels ── */
function SidePanel({ position, rotation, title, accent, type, floatSpeed }: {
  position: [number, number, number]; rotation: [number, number, number];
  title: string; accent: string; type: "bars" | "spark"; floatSpeed: number;
}) {
  const tex = useMemo(() => drawSidePanel(title, accent, type), [title, accent, type]);
  return (
    <Float speed={floatSpeed} rotationIntensity={0.15} floatIntensity={0.5}>
      <mesh position={position} rotation={rotation}>
        <planeGeometry args={[1.1, 1.375]} />
        <meshBasicMaterial map={tex} transparent side={THREE.DoubleSide} toneMapped={false} />
        <Edges color={accent} threshold={15}>
          <lineBasicMaterial color={accent} transparent opacity={0.7} />
        </Edges>
      </mesh>
    </Float>
  );
}

/* ── Ambient particles around the laptop ── */
function OrbitParticles() {
  const ref = useRef<THREE.Points>(null);
  const count = 150;
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const palette = [[0.18, 0.83, 0.75], [0.55, 0.36, 0.96], [0.93, 0.29, 0.6]];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2.5 + Math.random() * 3;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 4;
      pos[i * 3 + 2] = Math.sin(a) * r;
      const c = palette[Math.floor(Math.random() * palette.length)];
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    }
    return { positions: pos, colors: col };
  }, []);

  useFrame((state) => {
    if (ref.current) ref.current.rotation.y = state.clock.elapsedTime * 0.05;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.03} vertexColors transparent opacity={0.7} sizeAttenuation />
    </points>
  );
}

export default function LaptopScene() {
  return (
    <div className="w-full h-full" style={{ cursor: "grab" }}>
      <Canvas camera={{ position: [0, 0.9, 4.6], fov: 42 }} dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.35} />
          <directionalLight position={[4, 6, 5]} intensity={0.7} color="#ffffff" />
          <pointLight position={[-4, 2, 3]} intensity={0.5} color="#8B5CF6" />
          <pointLight position={[4, -1, 2]} intensity={0.4} color="#2DD4BF" />

          <Laptop />
          <OrbitParticles />

          <SidePanel position={[-2.7, 0.3, -0.4]} rotation={[0, 0.5, 0]}
            title="TOP PRODUK" accent="#8B5CF6" type="bars" floatSpeed={1.4} />
          <SidePanel position={[2.7, 0.5, -0.4]} rotation={[0, -0.5, 0]}
            title="PROFIT" accent="#2DD4BF" type="spark" floatSpeed={1.1} />

          <EffectComposer>
            <Bloom intensity={0.7} luminanceThreshold={0.25} mipmapBlur />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
