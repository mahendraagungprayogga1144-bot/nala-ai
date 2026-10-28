"use client";

import { Canvas } from "@react-three/fiber";
import { NoToneMapping } from "three";
import { STATIONS } from "@/lib/office/layout";
import type { OfficeAgent, OfficeViewMode, WorkRoomId } from "@/lib/office/types";
import OfficeAgentMesh from "./components/office-agent";
import { PingPongTable, WorkDesk } from "./components/office-furniture";
import OfficeStructure from "./components/office-structure";
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
  const preset = mode === "2d" ? { position: [0, 20, 0.02] as const, zoom: 50 } : { position: [13.5, 12, 13.5] as const, zoom: 36 };

  return (
    <div className="absolute inset-0">
      <Canvas
        orthographic
        shadows={false}
        dpr={antialias ? [1, maxDpr] : 1}
        camera={{ position: [...preset.position], zoom: preset.zoom, near: -40, far: 90 }}
        gl={{
          antialias,
          alpha: false,
          stencil: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = false;
          gl.toneMapping = NoToneMapping;
          gl.setClearColor("#0b0e14", 1);
        }}
      >
        <ambientLight intensity={0.72} />
        <hemisphereLight color="#fff7ed" groundColor="#b45309" intensity={0.4} />
        <directionalLight position={[8, 14, 6]} intensity={0.48} />
        <OfficeStructure />
        <PingPongTable />
        {WORK_ROOMS.map((room) => {
          const agent = agents.find((item) => item.room === room);
          return <WorkDesk key={room} station={STATIONS[room]} status={agent?.status ?? "idle"} />;
        })}
        {agents.map((agent) => (
          <OfficeAgentMesh
            key={agent.id}
            agent={agent}
            selected={agent.id === selectedId}
            reduceMotion={reduceMotion}
            onSelect={onSelect}
          />
        ))}
        <ViewRig mode={mode} resetToken={resetToken} />
      </Canvas>
    </div>
  );
}
