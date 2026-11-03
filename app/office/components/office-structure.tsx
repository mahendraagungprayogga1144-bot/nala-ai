"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { FLOOR, ROOMS, WALL, WALLS } from "@/lib/office/layout";
import RoomLabel from "./room-label";

const WALL_COLOR = "#F4F0FF";
const SITE = "#F3F0F8";

const WINDOW_SLOTS_X = [-5.4, -2.7, 0, 2.7, 5.4] as const;
const WINDOW_SLOTS_Z = [-3.5, 0, 3.5] as const;

type Opening = {
  position: readonly [number, number, number];
  size: readonly [number, number, number];
};

function facadeWindows(): Opening[] {
  const y = FLOOR.top + 0.82;
  const openings: Opening[] = [];
  for (const x of WINDOW_SLOTS_X) {
    openings.push({ position: [x, y, -6.3], size: [1.25, 0.62, 0.05] });
    openings.push({ position: [x, y, 6.3], size: [1.25, 0.62, 0.05] });
  }
  for (const z of WINDOW_SLOTS_Z) {
    openings.push({ position: [-8.2, y, z], size: [0.05, 0.62, 1.1] });
    openings.push({ position: [8.2, y, z], size: [0.05, 0.62, 1.1] });
  }
  return openings;
}

const WINDOWS = facadeWindows();

function makeHenimaWallTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak tersedia");
  ctx.fillStyle = "#1E1B4B";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const glow = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  glow.addColorStop(0, "#7C3AED");
  glow.addColorStop(1, "#38BDF8");
  ctx.fillStyle = glow;
  ctx.font = "800 180px Geist, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#A78BFA";
  ctx.shadowBlur = 42;
  ctx.fillText("Henima", canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function makeHenimaHoloTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak tersedia");
  ctx.clearRect(0, 0, 1024, 1024);
  const ring = ctx.createRadialGradient(512, 512, 60, 512, 512, 480);
  ring.addColorStop(0, "rgba(56,189,248,0.6)");
  ring.addColorStop(0.55, "rgba(124,58,237,0.3)");
  ring.addColorStop(1, "rgba(124,58,237,0)");
  ctx.fillStyle = ring;
  ctx.fillRect(0, 0, 1024, 1024);
  ctx.fillStyle = "#E0F2FE";
  ctx.font = "800 168px Geist, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "#38BDF8";
  ctx.shadowBlur = 48;
  ctx.fillText("Henima", 512, 512);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function makeFloorGrain(base: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak tersedia");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const a = 0.02 + Math.random() * 0.05;
    ctx.fillStyle = `rgba(30,27,75,${a})`;
    ctx.fillRect(x, y, 1.2, 1.2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 6);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function HenimaWallSign({
  position,
  rotationY = 0,
}: {
  position: readonly [number, number, number];
  rotationY?: number;
}) {
  const texture = useMemo(() => makeHenimaWallTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={[2.4, 1.05]} />
      <meshBasicMaterial map={texture} transparent />
    </mesh>
  );
}

function HenimaLobbyHologram() {
  const texture = useMemo(() => makeHenimaHoloTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group position={[0, FLOOR.top + 0.95, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.72, 0]}>
        <circleGeometry args={[1.35, 48]} />
        <meshBasicMaterial color="#7C3AED" transparent opacity={0.18} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.55, 32, 32]} />
        <meshBasicMaterial color="#38BDF8" transparent opacity={0.22} />
      </mesh>
      <mesh position={[0, 0, 0.02]}>
        <planeGeometry args={[2.2, 2.2]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[2.2, 2.2]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}

function RoomFloor({
  center,
  size,
  color,
  label,
}: {
  center: readonly [number, number];
  size: readonly [number, number];
  color: string;
  label: string;
}) {
  const grain = useMemo(() => makeFloorGrain(color), [color]);
  useEffect(() => () => grain.dispose(), [grain]);
  return (
    <group>
      <mesh position={[center[0], FLOOR.top + 0.02, center[1]]} receiveShadow>
        <boxGeometry args={[size[0], 0.025, size[1]]} />
        <meshStandardMaterial map={grain} color={color} roughness={0.82} />
      </mesh>
      <mesh position={[center[0], FLOOR.top + WALL.height - 0.08, center[1]]}>
        <boxGeometry args={[size[0] * 0.35, 0.04, 0.18]} />
        <meshStandardMaterial color="#FFF7ED" emissive="#FDE68A" emissiveIntensity={0.55} roughness={0.35} />
      </mesh>
      <RoomLabel title={label} position={[center[0], 2.05, center[1]]} width={label.length > 12 ? 3.15 : 2.45} />
    </group>
  );
}

export default function OfficeStructure() {
  const siteGrain = useMemo(() => makeFloorGrain("#F3F0F8"), []);
  const plankGrain = useMemo(() => makeFloorGrain("#F7F5F2"), []);
  useEffect(
    () => () => {
      siteGrain.dispose();
      plankGrain.dispose();
    },
    [siteGrain, plankGrain],
  );

  return (
    <group>
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <boxGeometry args={[36, 0.06, 28]} />
        <meshStandardMaterial map={siteGrain} color={SITE} roughness={0.92} />
      </mesh>
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[FLOOR.width + 0.7, 0.08, FLOOR.depth + 0.7]} />
        <meshStandardMaterial color="#D5DEE8" roughness={0.85} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[FLOOR.width, 0.12, FLOOR.depth]} />
        <meshStandardMaterial map={plankGrain} color="#F7F5F2" roughness={0.78} />
      </mesh>

      {ROOMS.map((room) => (
        <RoomFloor key={room.id} center={room.center} size={room.size} color={room.floor} label={room.label} />
      ))}

      {WALLS.map((wall) => (
        <mesh
          key={`${wall.axis}-${wall.center[0]}-${wall.center[1]}`}
          position={[wall.center[0], FLOOR.top + WALL.height / 2, wall.center[1]]}
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={
              wall.axis === "x"
                ? [wall.length, WALL.height, WALL.thickness]
                : [WALL.thickness, WALL.height, wall.length]
            }
          />
          <meshStandardMaterial color={WALL_COLOR} roughness={0.88} metalness={0.02} />
        </mesh>
      ))}

      {WINDOWS.map((opening) => (
        <mesh key={opening.position.join(",")} position={opening.position}>
          <boxGeometry args={opening.size} />
          <meshStandardMaterial color="#BAE6FD" emissive="#7DD3FC" emissiveIntensity={0.45} roughness={0.15} metalness={0.2} transparent opacity={0.85} />
        </mesh>
      ))}

      {/* Brand dinding + hologram lobby: Henima (bukan AI). */}
      <HenimaWallSign position={[-4.55, FLOOR.top + 0.78, -0.98]} />
      <HenimaWallSign position={[-4.55, FLOOR.top + 0.78, 0.98]} rotationY={Math.PI} />
      <HenimaWallSign position={[4.55, FLOOR.top + 0.78, -0.98]} />
      <HenimaWallSign position={[4.55, FLOOR.top + 0.78, 0.98]} rotationY={Math.PI} />
      <HenimaLobbyHologram />
    </group>
  );
}
