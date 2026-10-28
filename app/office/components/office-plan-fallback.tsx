"use client";

import type { CSSProperties } from "react";
import { crewSpot, FLOOR, PANTRY_PARK, PANTRY_TABLE, ROOMS, STATIONS } from "@/lib/office/layout";
import { DIVISION_LABEL } from "@/lib/office/present";
import type { OfficeAgent } from "@/lib/office/types";

function worldStyle(x: number, z: number, width: number, depth: number): CSSProperties {
  const left = ((x - width / 2 + FLOOR.width / 2) / FLOOR.width) * 100;
  const top = ((z - depth / 2 + FLOOR.depth / 2) / FLOOR.depth) * 100;
  return {
    left: `${left}%`,
    top: `${top}%`,
    width: `${(width / FLOOR.width) * 100}%`,
    height: `${(depth / FLOOR.depth) * 100}%`,
  };
}

export default function OfficePlanFallback({
  agents,
  selectedId,
  onSelect,
}: {
  agents: OfficeAgent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="absolute inset-0 grid place-items-center p-4 pt-24 md:p-28">
      <div
        className="relative aspect-[16.2/12.4] w-full max-w-3xl overflow-hidden rounded-2xl border border-[#E2E8F0] bg-[#F7F5F2] shadow-[0_18px_50px_rgba(15,23,42,0.08)]"
      >
        {ROOMS.map((room) => (
          <div
            key={room.id}
            className="absolute"
            style={{ ...worldStyle(room.center[0], room.center[1], room.size[0], room.size[1]), background: room.floor }}
          >
            <span className="absolute left-2 top-2 text-[10px] font-semibold text-[#1c1917] sm:text-xs">{room.label}</span>
          </div>
        ))}
        <div
          className="absolute rounded-sm bg-[#1B7F4A]"
          style={worldStyle(PANTRY_TABLE[0], PANTRY_TABLE[1], 1.15, 1.85)}
          aria-hidden
        />
        {agents.map((agent) => {
          const spot = agent.place === "hall" ? crewSpot(agent.id) : agent.at_pantry ? PANTRY_PARK : STATIONS[agent.room].chair;
          const left = ((spot[0] + FLOOR.width / 2) / FLOOR.width) * 100;
          const top = ((spot[1] + FLOOR.depth / 2) / FLOOR.depth) * 100;
          const selected = agent.id === selectedId;
          return (
            <button
              key={agent.id}
              type="button"
              title={agent.name}
              aria-pressed={selected}
              onClick={() => onSelect(agent.id)}
              className="absolute flex w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <span
                className="grid h-8 w-8 place-items-center rounded-full border-2 text-[10px] font-bold text-[#0b0e14]"
                style={{ background: agent.color, borderColor: selected ? "#2DD4BF" : "#0b0e14" }}
              >
                {agent.name.slice(0, 1)}
              </span>
              <span className="mt-0.5 max-w-16 truncate rounded bg-[#0b0e14]/90 px-1 text-[9px] font-bold text-white">{agent.name}</span>
              <span className="text-[8px] font-semibold leading-none" style={{ color: agent.color }}>
                {DIVISION_LABEL[agent.division]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
