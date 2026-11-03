"use client";

import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment } from "@react-three/drei";
import { ACESFilmicToneMapping, SRGBColorSpace } from "three";
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
        shadows
        dpr={[1, maxDpr]}
        camera={{
          position: mode === "2d" ? [0, 20, 0.02] : [12.8, 11.2, 12.8],
          zoom: mode === "2d" ? 44 : 30,
          near: -40,
          far: 90,
        }}
        gl={{
          antialias: true,
          alpha: false,
          stencil: false,
          powerPreference: "high-performance",
          logarithmicDepthBuffer: true,
        }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.12;
          gl.outputColorSpace = SRGBColorSpace;
          gl.setClearColor("#E4DDF4", 1);
        }}
      >
        <fog attach="fog" args={["#E4DDF4", 22, 48]} />
        <ambientLight intensity={0.42} />
        <hemisphereLight color="#FFF8F0" groundColor="#B8C0D0" intensity={0.55} />
        <directionalLight
          castShadow
          position={[7, 16, 5]}
          intensity={1.15}
          color="#FFF4E5"
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0002}
        />
        <directionalLight position={[-6, 9, -4]} intensity={0.4} color="#DDD6FE" />
        <pointLight position={[0, 2.4, 0]} intensity={0.7} distance={16} color="#FDE68A" />
        <pointLight position={[-4.5, 2.1, 3.4]} intensity={0.35} distance={8} color="#FBBF24" />
        <pointLight position={[4.5, 2.1, -3.4]} intensity={0.3} distance={8} color="#A5B4FC" />
        {!reduceMotion ? <Environment preset="apartment" environmentIntensity={0.28} /> : null}
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
        <ContactShadows position={[0, 0.04, 0]} opacity={0.42} scale={28} blur={2.4} far={8} resolution={1024} color="#1E1B4B" />
        <ViewRig mode={mode} resetToken={resetToken} focus={focus} />
      </Canvas>
    </div>
  );
}
