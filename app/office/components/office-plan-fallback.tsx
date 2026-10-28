"use client";

import type { CSSProperties } from "react";
import { FLOOR, PANTRY_PARK, PANTRY_TABLE, ROOMS, STATIONS } from "@/lib/office/layout";
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
        className="relative aspect-[16.2/12.4] w-full max-w-3xl overflow-hidden rounded-2xl shadow-[inset_0_0_0_8px_#F4F0E6]"
        style={{ background: "#A67C52" }}
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
          const spot = agent.status === "idle" ? PANTRY_PARK : STATIONS[agent.room].chair;
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
              className="absolute grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 text-[10px] font-bold text-[#0b0e14]"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                background: agent.color,
                borderColor: selected ? "#2DD4BF" : "#0b0e14",
              }}
            >
              {agent.name.slice(0, 1)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
