"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { MeshBasicMaterial } from "three";
import { FLOOR, PANTRY_TABLE, type Station } from "@/lib/office/layout";
import type { AgentStatus } from "@/lib/office/types";

const DESK_TOP = 0.74;

function direction(station: Station) {
  const dx = station.desk[0] - station.chair[0];
  const dz = station.desk[1] - station.chair[1];
  const length = Math.hypot(dx, dz) || 1;
  return { x: dx / length, z: dz / length };
}

export function WorkDesk({ station, status }: { station: Station; status: AgentStatus }) {
  const screen = useRef<MeshBasicMaterial>(null);
  const { x: fx, z: fz } = direction(station);
  const [deskX, deskZ] = station.desk;
  const [chairX, chairZ] = station.chair;
  const base = status === "error" ? "#FB7185" : status === "working" ? "#14B8A6" : "#334155";

  useFrame(({ clock }) => {
    const material = screen.current;
    if (!material || status !== "working") return;
    material.color.set(Math.sin(clock.elapsedTime * 3) > 0 ? "#5EEAD4" : "#0F766E");
  });

  const legY = FLOOR.top + 0.31;

  return (
    <group>
      <mesh position={[deskX, DESK_TOP, deskZ]}>
        <boxGeometry args={[1.2, 0.07, 0.64]} />
        <meshLambertMaterial color="#E7D3B4" />
      </mesh>
      {[
        [0.5, 0.24],
        [0.5, -0.24],
        [-0.5, 0.24],
        [-0.5, -0.24],
      ].map(([ox, oz]) => (
        <mesh key={`${ox}-${oz}`} position={[deskX + ox, legY, deskZ + oz]}>
          <boxGeometry args={[0.06, 0.62, 0.06]} />
          <meshLambertMaterial color="#C4B29A" />
        </mesh>
      ))}
      <mesh position={[deskX - fx * 0.12, DESK_TOP + 0.045, deskZ - fz * 0.12]}>
        <boxGeometry args={[0.38, 0.02, 0.14]} />
        <meshLambertMaterial color="#1E293B" />
      </mesh>
      <mesh position={[deskX + fx * 0.16, 1.02, deskZ + fz * 0.16]}>
        <boxGeometry args={[0.56, 0.38, 0.05]} />
        <meshLambertMaterial color="#0F172A" />
      </mesh>
      <mesh position={[deskX + fx * 0.16 - fx * 0.04, 1.02, deskZ + fz * 0.16 - fz * 0.04]}>
        <boxGeometry args={[0.46, 0.28, 0.012]} />
        <meshBasicMaterial ref={screen} color={base} />
      </mesh>
      <mesh position={[deskX + fx * 0.16, 0.78, deskZ + fz * 0.16]}>
        <cylinderGeometry args={[0.03, 0.03, 0.22, 6]} />
        <meshLambertMaterial color="#1E293B" />
      </mesh>

      <mesh position={[chairX, 0.46, chairZ]}>
        <boxGeometry args={[0.42, 0.06, 0.4]} />
        <meshLambertMaterial color="#E2E8F0" />
      </mesh>
      <mesh position={[chairX - fx * 0.18, 0.7, chairZ - fz * 0.18]}>
        <boxGeometry args={[0.42, 0.36, 0.06]} />
        <meshLambertMaterial color="#CBD5E1" />
      </mesh>
      {[
        [0.16, 0.14],
        [0.16, -0.14],
        [-0.16, 0.14],
        [-0.16, -0.14],
      ].map(([ox, oz]) => (
        <mesh key={`c-${ox}-${oz}`} position={[chairX + ox, FLOOR.top + 0.19, chairZ + oz]}>
          <boxGeometry args={[0.045, 0.38, 0.045]} />
          <meshLambertMaterial color="#1E293B" />
        </mesh>
      ))}
    </group>
  );
}

export function PingPongTable() {
  const [x, z] = PANTRY_TABLE;

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, DESK_TOP, 0]}>
        <boxGeometry args={[1.15, 0.06, 1.85]} />
        <meshLambertMaterial color="#1B7F4A" />
      </mesh>
      <mesh position={[0, DESK_TOP + 0.02, 0]}>
        <boxGeometry args={[0.02, 0.012, 1.85]} />
        <meshBasicMaterial color="#ECFDF5" />
      </mesh>
      <mesh position={[0, 0.86, 0]}>
        <boxGeometry args={[1.15, 0.16, 0.03]} />
        <meshLambertMaterial color="#F8FAFC" />
      </mesh>
      {[
        [-0.48, -0.78],
        [0.48, -0.78],
        [-0.48, 0.78],
        [0.48, 0.78],
      ].map(([lx, lz]) => (
        <mesh key={`${lx}-${lz}`} position={[lx, 0.38, lz]}>
          <cylinderGeometry args={[0.035, 0.035, 0.62, 6]} />
          <meshLambertMaterial color="#1E293B" />
        </mesh>
      ))}
      <mesh position={[-0.72, DESK_TOP + 0.04, 0.4]} rotation={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.03, 8]} />
        <meshLambertMaterial color="#DC2626" />
      </mesh>
      <mesh position={[0.74, DESK_TOP + 0.04, -0.42]} rotation={[0, -0.4, 0]}>
        <cylinderGeometry args={[0.14, 0.14, 0.03, 8]} />
        <meshLambertMaterial color="#2563EB" />
      </mesh>
      <mesh position={[0.2, DESK_TOP + 0.06, 0.25]}>
        <sphereGeometry args={[0.045, 8, 6]} />
        <meshLambertMaterial color="#F8FAFC" />
      </mesh>
    </group>
  );
}
