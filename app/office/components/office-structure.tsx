"use client";

import { FLOOR, ROOMS, WALL, WALLS } from "@/lib/office/layout";
import RoomLabel from "./room-label";

const WALL_COLOR = "#F7F4EF";
const SITE = "#FFFFFF";

const WINDOW_SLOTS_X = [-5.4, -2.7, 0, 2.7, 5.4] as const;
const WINDOW_SLOTS_Z = [-3.5, 0, 3.5] as const;

type Opening = {
  position: readonly [number, number, number];
  size: readonly [number, number, number];
};

function facadeWindows(): Opening[] {
  const y = FLOOR.top + 0.64;
  const openings: Opening[] = [];
  for (const x of WINDOW_SLOTS_X) {
    openings.push({ position: [x, y, -6.3], size: [1.2, 0.48, 0.05] });
    openings.push({ position: [x, y, 6.3], size: [1.2, 0.48, 0.05] });
  }
  for (const z of WINDOW_SLOTS_Z) {
    openings.push({ position: [-8.2, y, z], size: [0.05, 0.48, 1.05] });
    openings.push({ position: [8.2, y, z], size: [0.05, 0.48, 1.05] });
  }
  return openings;
}

const WINDOWS = facadeWindows();

export default function OfficeStructure() {
  return (
    <group>
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[36, 0.06, 28]} />
        <meshLambertMaterial color={SITE} />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <boxGeometry args={[FLOOR.width + 0.7, 0.08, FLOOR.depth + 0.7]} />
        <meshLambertMaterial color="#D5DEE8" />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[FLOOR.width, 0.12, FLOOR.depth]} />
        <meshLambertMaterial color="#F7F5F2" />
      </mesh>

      {ROOMS.map((room) => (
        <group key={room.id}>
          <mesh position={[room.center[0], FLOOR.top + 0.02, room.center[1]]}>
            <boxGeometry args={[room.size[0], 0.025, room.size[1]]} />
            <meshLambertMaterial color={room.floor} />
          </mesh>
          <RoomLabel
            title={room.label}
            position={[room.center[0], 1.72, room.center[1]]}
            width={room.label.length > 12 ? 3.15 : 2.45}
          />
        </group>
      ))}

      {WALLS.map((wall) => (
        <mesh
          key={`${wall.axis}-${wall.center[0]}-${wall.center[1]}`}
          position={[wall.center[0], FLOOR.top + WALL.height / 2, wall.center[1]]}
        >
          <boxGeometry
            args={
              wall.axis === "x"
                ? [wall.length, WALL.height, WALL.thickness]
                : [WALL.thickness, WALL.height, wall.length]
            }
          />
          <meshLambertMaterial color={WALL_COLOR} />
        </mesh>
      ))}

      {WINDOWS.map((opening) => (
        <mesh key={opening.position.join(",")} position={opening.position}>
          <boxGeometry args={opening.size} />
          <meshLambertMaterial color="#7DD3FC" />
        </mesh>
      ))}
    </group>
  );
}
