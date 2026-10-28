"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { PANTRY_PARK, PANTRY_TABLE, STATIONS, WA_SPOT, salesPantryLoop } from "@/lib/office/layout";
import { loopPoint, yawToward } from "@/lib/office/motion";
import { STATUS_LABEL } from "@/lib/office/present";
import type { OfficeAgent } from "@/lib/office/types";
import FaceLabel from "./room-label";

const WALK_SECONDS = 18;
const YELLOW = "#F5C518";
const LEG = "#1E3A5F";
const INK = "#1A1A1A";
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
  const path = useMemo(() => salesPantryLoop(station.chair), [station]);
  const hall = agent.place === "hall";
  const seated = !hall && !agent.at_pantry;
  const face = yawToward(station.chair, station.desk);

  useEffect(() => () => {
    document.body.style.cursor = "";
  }, []);

  useFrame(({ clock }) => {
    const group = root.current;
    if (!group) return;
    const t = clock.elapsedTime;

    const pose = (leftArm: number, rightArm: number, leftLeg: number, rightLeg: number) => {
      if (armL.current) armL.current.rotation.x = leftArm;
      if (armR.current) armR.current.rotation.x = rightArm;
      if (legL.current) legL.current.rotation.x = leftLeg;
      if (legR.current) legR.current.rotation.x = rightLeg;
    };

    if (hall) {
      const bob = !reduceMotion ? Math.sin(t * 2) * 0.015 : 0;
      group.position.set(WA_SPOT[0], bob, WA_SPOT[1]);
      group.rotation.y = 0.6;
      pose(0.15, 0.15, 0, 0);
      return;
    }

    if (agent.at_pantry) {
      if (reduceMotion) {
        group.position.set(PANTRY_PARK[0], 0, PANTRY_PARK[1]);
        group.rotation.y = yawToward(PANTRY_PARK, PANTRY_TABLE);
        pose(0, 0, 0, 0);
      } else {
        const sample = loopPoint(path, (t % WALK_SECONDS) / WALK_SECONDS);
        const swing = Math.sin(t * 10);
        group.position.set(sample.x, Math.abs(swing) * 0.045, sample.z);
        group.rotation.y = sample.yaw;
        pose(swing * 0.7, -swing * 0.7, -swing * 0.55, swing * 0.55);
      }
      return;
    }

    const yaw = yawToward(station.chair, station.desk);
    const bob = agent.status === "working" && !reduceMotion ? Math.sin(t * 3) * 0.02 : 0;
    const shake = agent.status === "error" && !reduceMotion ? Math.sin(t * 16) * 0.01 : 0;
    group.position.set(station.chair[0] + shake, bob, station.chair[1]);
    group.rotation.y = yaw;

    if (agent.status === "working" && !reduceMotion) {
      pose(-1.15 + Math.sin(t * 8) * 0.35, -1.15 + Math.sin(t * 8 + 1.15) * 0.35, 1.2, 1.2);
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
      position={hall ? [WA_SPOT[0], 0, WA_SPOT[1]] : agent.at_pantry ? [PANTRY_PARK[0], 0, PANTRY_PARK[1]] : [station.chair[0], 0, station.chair[1]]}
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
          <mesh position={[0, -0.17, 0]}>
            <boxGeometry args={[0.13, 0.34, 0.14]} />
            <meshLambertMaterial color={LEG} />
          </mesh>
        </group>
        <group ref={legR} position={[0.075, HIP, 0]}>
          <mesh position={[0, -0.17, 0]}>
            <boxGeometry args={[0.13, 0.34, 0.14]} />
            <meshLambertMaterial color={LEG} />
          </mesh>
        </group>
        <mesh position={[0, HIP + 0.045, 0]}>
          <boxGeometry args={[0.28, 0.09, 0.15]} />
          <meshLambertMaterial color={LEG} />
        </mesh>
        <mesh position={[0, HIP + 0.28, 0]}>
          <boxGeometry args={[0.32, 0.34, 0.17]} />
          <meshLambertMaterial color={agent.color} />
        </mesh>
        <mesh position={[0, HIP + 0.28, -0.09]}>
          <boxGeometry args={[0.14, 0.12, 0.02]} />
          <meshLambertMaterial color="#FFFFFF" />
        </mesh>
        <mesh position={[0, HIP + 0.48, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.05, 8]} />
          <meshLambertMaterial color={YELLOW} />
        </mesh>
        <group ref={armL} position={[-0.21, HIP + 0.38, 0]}>
          <mesh position={[0, -0.09, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.18, 8]} />
            <meshLambertMaterial color={agent.color} />
          </mesh>
          <mesh position={[0, -0.2, 0]}>
            <boxGeometry args={[0.07, 0.07, 0.07]} />
            <meshLambertMaterial color={YELLOW} />
          </mesh>
        </group>
        <group ref={armR} position={[0.21, HIP + 0.38, 0]}>
          <mesh position={[0, -0.09, 0]}>
            <cylinderGeometry args={[0.045, 0.045, 0.18, 8]} />
            <meshLambertMaterial color={agent.color} />
          </mesh>
          <mesh position={[0, -0.2, 0]}>
            <boxGeometry args={[0.07, 0.07, 0.07]} />
            <meshLambertMaterial color={YELLOW} />
          </mesh>
        </group>
        <mesh position={[0, HIP + 0.62, 0]}>
          <cylinderGeometry args={[0.135, 0.135, 0.24, 12]} />
          <meshLambertMaterial color={YELLOW} />
        </mesh>
        <mesh position={[0, HIP + 0.765, 0]}>
          <cylinderGeometry args={[0.055, 0.055, 0.05, 8]} />
          <meshLambertMaterial color={YELLOW} />
        </mesh>
        <mesh position={[-0.045, HIP + 0.65, -0.145]}>
          <boxGeometry args={[0.035, 0.035, 0.02]} />
          <meshLambertMaterial color={INK} />
        </mesh>
        <mesh position={[0.045, HIP + 0.65, -0.145]}>
          <boxGeometry args={[0.035, 0.035, 0.02]} />
          <meshLambertMaterial color={INK} />
        </mesh>
        <mesh position={[0, HIP + 0.56, -0.145]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.05, 0.012, 6, 10, Math.PI]} />
          <meshLambertMaterial color={INK} />
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
          subtitle={STATUS_LABEL[agent.status]}
          accent={agent.status === "error" ? "#FB7185" : agent.color}
          position={[0, seated ? 1.62 : 1.42, 0]}
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
