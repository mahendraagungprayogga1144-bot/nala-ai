"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { PANTRY_PARK, PANTRY_TABLE, STATIONS, salesPantryLoop } from "@/lib/office/layout";
import { loopPoint, yawToward } from "@/lib/office/motion";
import { STATUS_LABEL } from "@/lib/office/present";
import type { OfficeAgent } from "@/lib/office/types";
import FaceLabel from "./room-label";

const WALK_SECONDS = 18;

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
  const armL = useRef<Mesh>(null);
  const armR = useRef<Mesh>(null);
  const beacon = useRef<Mesh>(null);
  const station = STATIONS[agent.room];
  const path = useMemo(() => salesPantryLoop(station.chair), [station]);
  const seated = !agent.at_pantry;
  const face = yawToward(station.chair, station.desk);

  useEffect(() => () => {
    document.body.style.cursor = "";
  }, []);

  useFrame(({ clock }) => {
    const group = root.current;
    if (!group) return;
    const t = clock.elapsedTime;

    if (agent.at_pantry) {
        if (reduceMotion) {
        group.position.set(PANTRY_PARK[0], 0, PANTRY_PARK[1]);
        group.rotation.y = yawToward(PANTRY_PARK, PANTRY_TABLE);
        if (armL.current && armR.current) {
          armL.current.rotation.x = 0;
          armR.current.rotation.x = 0;
        }
      } else {
        const sample = loopPoint(path, (t % WALK_SECONDS) / WALK_SECONDS);
        group.position.set(sample.x, Math.abs(Math.sin(t * 10)) * 0.045, sample.z);
        group.rotation.y = sample.yaw;
        if (armL.current && armR.current) {
          armL.current.rotation.x = Math.sin(t * 10) * 0.45;
          armR.current.rotation.x = Math.sin(t * 10 + Math.PI) * 0.45;
        }
      }
      return;
    }

    const yaw = yawToward(station.chair, station.desk);
    const bob = agent.status === "working" && !reduceMotion ? Math.sin(t * 3) * 0.02 : 0;
    const shake = agent.status === "error" && !reduceMotion ? Math.sin(t * 16) * 0.01 : 0;
    group.position.set(station.chair[0] + shake, bob, station.chair[1]);
    group.rotation.y = yaw;

    if (agent.status === "working" && armL.current && armR.current && !reduceMotion) {
      armL.current.rotation.x = -1.05 + Math.sin(t * 8) * 0.4;
      armR.current.rotation.x = -1.05 + Math.sin(t * 8 + 1.15) * 0.4;
    }

    if (beacon.current && agent.status === "error") {
      const pulse = 1 + Math.sin(t * 6) * 0.18;
      beacon.current.scale.setScalar(pulse);
    }
  });

  return (
    <group
      ref={root}
      position={agent.at_pantry ? [PANTRY_PARK[0], 0, PANTRY_PARK[1]] : [station.chair[0], 0, station.chair[1]]}
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
      <group>
        <mesh position={[0, seated ? 0.78 : 0.42, 0]}>
          <capsuleGeometry args={[0.16, 0.32, 2, 8]} />
          <meshLambertMaterial color={agent.color} />
        </mesh>
        <mesh position={[0, seated ? 1.16 : 0.86, 0]}>
          <sphereGeometry args={[0.15, 10, 8]} />
          <meshLambertMaterial color="#F6D7B8" />
        </mesh>
        <mesh ref={armL} position={[-0.22, seated ? 0.9 : 0.58, 0]} rotation={[-1.05, 0, 0.15]}>
          <cylinderGeometry args={[0.045, 0.04, 0.28, 6]} />
          <meshLambertMaterial color={agent.color} />
        </mesh>
        <mesh ref={armR} position={[0.22, seated ? 0.9 : 0.58, 0]} rotation={[-1.05, 0, -0.15]}>
          <cylinderGeometry args={[0.045, 0.04, 0.28, 6]} />
          <meshLambertMaterial color={agent.color} />
        </mesh>
        {agent.status === "error" ? (
          <mesh ref={beacon} position={[0, 1.4, 0]}>
            <sphereGeometry args={[0.06, 8, 6]} />
            <meshBasicMaterial color="#F43F5E" />
          </mesh>
        ) : null}
        <FaceLabel
          title={agent.name}
          subtitle={STATUS_LABEL[agent.status]}
          accent={agent.status === "error" ? "#FB7185" : agent.color}
          position={[0, seated ? 1.72 : 1.38, 0]}
          width={2.15}
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
