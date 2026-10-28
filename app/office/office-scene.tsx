"use client";

import { Canvas } from "@react-three/fiber";
import { NoToneMapping } from "three";
import { crewSpot, PANTRY_PARK, STATIONS } from "@/lib/office/layout";
import type { OfficeAgent, OfficeViewMode, WorkRoomId } from "@/lib/office/types";
import OfficeAgentMesh from "./components/office-agent";
import { PingPongTable, WorkDesk } from "./components/office-furniture";
import OfficeStructure from "./components/office-structure";
import FaceLabel from "./components/room-label";
import ViewRig from "./components/view-rig";

const WORK_ROOMS: readonly WorkRoomId[] = ["sales", "ops", "founder"];

export default function OfficeScene({
  agents,
  selectedId,
  onSelect,
  mode,
  resetToken,
  maxDpr,
  antialias,
  reduceMotion,
}: {
  agents: OfficeAgent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  mode: OfficeViewMode;
  resetToken: number;
  maxDpr: number;
  antialias: boolean;
  reduceMotion: boolean;
}) {
  const selected = agents.find((agent) => agent.id === selectedId) ?? null;
  const anchor = selected
      ? selected.place === "hall"
      ? crewSpot(selected.id)
      : selected.at_pantry
        ? PANTRY_PARK
        : STATIONS[selected.room].chair
    : null;
  const focus = anchor ? ([anchor[0] + 1.6, 0.2, anchor[1] + 1.6] as const) : null;

  return (
    <div className="absolute inset-0">
      <Canvas
        orthographic
        shadows={false}
        dpr={antialias ? [1, maxDpr] : 1}
        camera={{
          position: mode === "2d" ? [0, 20, 0.02] : [13.5, 12, 13.5],
          zoom: mode === "2d" ? 42 : 28,
          near: -40,
          far: 90,
        }}
        gl={{
          antialias,
          alpha: false,
          stencil: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = false;
          gl.toneMapping = NoToneMapping;
          gl.setClearColor("#FFFFFF", 1);
        }}
      >
        <ambientLight intensity={0.74} />
        <hemisphereLight color="#FFFFFF" groundColor="#F1F5F9" intensity={0.32} />
        <directionalLight position={[8, 16, 6]} intensity={0.7} />
        <OfficeStructure />
        <PingPongTable />
        {WORK_ROOMS.map((room) => {
          const agent = agents.find((item) => item.room === room && item.place !== "hall");
          return <WorkDesk key={room} station={STATIONS[room]} status={agent?.status ?? "idle"} />;
        })}
        {agents
          .filter((agent) => agent.at_pantry)
          .map((agent) => (
            <FaceLabel
              key={`${agent.id}-desk`}
              title="Meja kosong"
              subtitle={`${agent.name} ada di Pantry`}
              accent={agent.color}
              position={[STATIONS[agent.room].chair[0], 1.15, STATIONS[agent.room].chair[1]]}
              width={2.4}
            />
          ))}
        {agents.map((agent) => (
          <OfficeAgentMesh
            key={agent.id}
            agent={agent}
            selected={agent.id === selectedId}
            reduceMotion={reduceMotion}
            onSelect={onSelect}
          />
        ))}
        <ViewRig mode={mode} resetToken={resetToken} focus={focus} />
      </Canvas>
    </div>
  );
}
