"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { crewSpot, hallPatrol, PANTRY_PARK, PANTRY_TABLE, salesPantryLoop, STATIONS } from "@/lib/office/layout";
import { loopPoint, yawToward } from "@/lib/office/motion";
import { DIVISION_LABEL } from "@/lib/office/present";
import type { OfficeAgent } from "@/lib/office/types";
import FaceLabel from "./room-label";

const WALK_SECONDS = 16;
const SKIN = "#E8B896";
const LEG = "#1E293B";
const INK = "#1A1A1A";

const HAIR: Record<string, string> = {
  "laporan-harian": "#1C1917",
  "monitor-sales": "#4C1D95",
  "stok-produksi": "#9A3412",
  "balas-wa": "#14532D",
  "meja-software": "#0C4A6E",
  "divisi-sosmed": "#9D174D",
  "divisi-marketing": "#9F1239",
  "divisi-hr": "#334155",
};
const SIT_LIFT = 0.16;
const HIP = 0.44;

export default function OfficeAgent({
  agent,
  selected,
  reduceMotion,
  onSelect,
}: {
  agent: OfficeAgent;
  selected: boolean;
  reduceMotion: boolean;
  onSelect: (id: string) => void;
}) {
  const root = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const beacon = useRef<Group>(null);
  const station = STATIONS[agent.room];
  const pantryPath = useMemo(() => salesPantryLoop(station.chair), [station]);
  const patrol = useMemo(() => hallPatrol(agent.id), [agent.id]);
  const hall = agent.place === "hall";
  const hallSpot = crewSpot(agent.id);
  const seated = !hall && !agent.at_pantry;
  const hair = HAIR[agent.id] ?? "#292524";
  const face = yawToward(station.chair, station.desk);
  /** Desk agent yang idle/working: sebagian waktu jalan dalam ruang, sebagian kerja di meja. */
  const phaseOffset = useMemo(() => {
    let hash = 0;
    for (const ch of agent.id) hash = (hash + ch.charCodeAt(0) * 17) % 97;
    return hash / 97;
  }, [agent.id]);

  useEffect(
    () => () => {
      document.body.style.cursor = "";
    },
    [],
  );

  useFrame(({ clock }) => {
    const group = root.current;
    if (!group) return;
    const t = clock.elapsedTime + phaseOffset * 20;

    const pose = (leftArm: number, rightArm: number, leftLeg: number, rightLeg: number) => {
      if (armL.current) armL.current.rotation.x = leftArm;
      if (armR.current) armR.current.rotation.x = rightArm;
      if (legL.current) legL.current.rotation.x = leftLeg;
      if (legR.current) legR.current.rotation.x = rightLeg;
    };

    const walkAt = (path: readonly (readonly [number, number])[], seconds: number) => {
      if (reduceMotion) {
        const spot = path[0] || hallSpot;
        group.position.set(spot[0], 0, spot[1]);
        group.rotation.y = 0.4;
        pose(0.1, 0.1, 0, 0);
        return;
      }
      const sample = loopPoint(path, (t % seconds) / seconds);
      const swing = Math.sin(t * 9.5);
      group.position.set(sample.x, Math.abs(swing) * 0.05, sample.z);
      group.rotation.y = sample.yaw;
      pose(swing * 0.75, -swing * 0.75, -swing * 0.6, swing * 0.6);
    };

    if (hall) {
      walkAt(patrol, WALK_SECONDS + phaseOffset * 6);
      return;
    }

    if (agent.at_pantry) {
      walkAt(pantryPath, WALK_SECONDS);
      if (reduceMotion) {
        group.position.set(PANTRY_PARK[0], 0, PANTRY_PARK[1]);
        group.rotation.y = yawToward(PANTRY_PARK, PANTRY_TABLE);
        pose(0, 0, 0, 0);
      }
      return;
    }

    // Di meja: 55% kerja/duduk, 45% jalan keliling ruangan
    const cycle = (t % 22) / 22;
    const shouldWalk = !reduceMotion && cycle > 0.55;

    if (shouldWalk) {
      walkAt(hallPatrol(agent.id), 12);
      return;
    }

    const yaw = yawToward(station.chair, station.desk);
    const bob = agent.status === "working" && !reduceMotion ? Math.sin(t * 3.2) * 0.018 : 0;
    const shake = agent.status === "error" && !reduceMotion ? Math.sin(t * 16) * 0.01 : 0;
    group.position.set(station.chair[0] + shake, bob, station.chair[1]);
    group.rotation.y = yaw;

    if (agent.status === "working" && !reduceMotion) {
      // Mengetik / kerja di laptop
      pose(-1.2 + Math.sin(t * 9) * 0.4, -1.15 + Math.sin(t * 9 + 1.2) * 0.4, 1.2, 1.2);
    } else if (agent.status === "error" && !reduceMotion) {
      pose(-0.7 + Math.sin(t * 5) * 0.2, -0.3, 1.2, 1.2);
    } else {
      pose(-0.45, -0.45, 1.2, 1.2);
    }

    if (beacon.current && agent.status === "error") {
      const pulse = 1 + Math.sin(t * 6) * 0.18;
      beacon.current.scale.setScalar(pulse);
    }
  });

  return (
    <group
      ref={root}
      position={hall ? [hallSpot[0], 0, hallSpot[1]] : agent.at_pantry ? [PANTRY_PARK[0], 0, PANTRY_PARK[1]] : [station.chair[0], 0, station.chair[1]]}
      rotation={[0, face, 0]}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(agent.id);
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      <group position={[0, seated ? SIT_LIFT : 0, 0]}>
        <group ref={legL} position={[-0.075, HIP, 0]}>
          <mesh position={[0, -0.17, 0]} castShadow={false}>
            <capsuleGeometry args={[0.055, 0.22, 4, 8]} />
            <meshStandardMaterial color={LEG} roughness={0.75} />
          </mesh>
        </group>
        <group ref={legR} position={[0.075, HIP, 0]}>
          <mesh position={[0, -0.17, 0]}>
            <capsuleGeometry args={[0.055, 0.22, 4, 8]} />
            <meshStandardMaterial color={LEG} roughness={0.75} />
          </mesh>
        </group>
        <mesh position={[0, HIP + 0.045, 0]}>
          <boxGeometry args={[0.28, 0.09, 0.15]} />
          <meshStandardMaterial color={LEG} roughness={0.8} />
        </mesh>
        <mesh position={[0, HIP + 0.28, 0]}>
          <boxGeometry args={[0.34, 0.36, 0.18]} />
          <meshStandardMaterial color={agent.color} roughness={0.55} metalness={0.05} />
        </mesh>
        <mesh position={[0, HIP + 0.28, -0.095]}>
          <boxGeometry args={[0.14, 0.12, 0.02]} />
          <meshStandardMaterial color="#F8FAFC" roughness={0.4} />
        </mesh>
        <mesh position={[0, HIP + 0.48, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.05, 10]} />
          <meshStandardMaterial color={SKIN} roughness={0.65} />
        </mesh>
        <group ref={armL} position={[-0.22, HIP + 0.38, 0]}>
          <mesh position={[0, -0.09, 0]}>
            <capsuleGeometry args={[0.04, 0.12, 4, 8]} />
            <meshStandardMaterial color={agent.color} roughness={0.55} />
          </mesh>
          <mesh position={[0, -0.2, 0]}>
            <sphereGeometry args={[0.045, 10, 10]} />
            <meshStandardMaterial color={SKIN} roughness={0.65} />
          </mesh>
        </group>
        <group ref={armR} position={[0.22, HIP + 0.38, 0]}>
          <mesh position={[0, -0.09, 0]}>
            <capsuleGeometry args={[0.04, 0.12, 4, 8]} />
            <meshStandardMaterial color={agent.color} roughness={0.55} />
          </mesh>
          <mesh position={[0, -0.2, 0]}>
            <sphereGeometry args={[0.045, 10, 10]} />
            <meshStandardMaterial color={SKIN} roughness={0.65} />
          </mesh>
        </group>
        <mesh position={[0, HIP + 0.62, 0]}>
          <sphereGeometry args={[0.165, 20, 16]} />
          <meshStandardMaterial color={SKIN} roughness={0.55} />
        </mesh>
        <mesh position={[0, HIP + 0.74, 0.02]}>
          <sphereGeometry args={[0.155, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42]} />
          <meshStandardMaterial color={hair} roughness={0.85} />
        </mesh>
        <mesh position={[-0.05, HIP + 0.64, -0.15]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial color={INK} roughness={0.4} />
        </mesh>
        <mesh position={[0.05, HIP + 0.64, -0.15]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshStandardMaterial color={INK} roughness={0.4} />
        </mesh>
        <mesh position={[0, HIP + 0.56, -0.15]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.05, 0.012, 6, 12, Math.PI]} />
          <meshStandardMaterial color={INK} roughness={0.5} />
        </mesh>
        {agent.status === "error" ? (
          <group ref={beacon} position={[0, HIP + 0.86, 0]}>
            <mesh>
              <cylinderGeometry args={[0.045, 0.045, 0.06, 8]} />
              <meshBasicMaterial color="#F43F5E" />
            </mesh>
          </group>
        ) : null}
        <FaceLabel
          title={agent.name}
          subtitle={DIVISION_LABEL[agent.division]}
          accent={agent.color}
          position={[0, seated ? 1.72 : 1.52, 0]}
          width={1.55}
        />
      </group>
      {selected ? (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.28, 0.36, 20]} />
          <meshBasicMaterial color="#2DD4BF" />
        </mesh>
      ) : null}
    </group>
  );
}
