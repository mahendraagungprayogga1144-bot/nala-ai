"use client";

import { FLOOR, ROOMS, WALL, WALLS } from "@/lib/office/layout";
import RoomLabel from "./room-label";

const WOOD = "#A67C52";
const WALL_COLOR = "#F4F0E6";

export default function OfficeStructure() {
  return (
    <group>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[FLOOR.width, 0.12, FLOOR.depth]} />
        <meshLambertMaterial color={WOOD} />
      </mesh>

      {Array.from({ length: 8 }, (_, index) => (
        <mesh key={index} position={[-7 + index * 2, FLOOR.top + 0.004, 0]}>
          <boxGeometry args={[0.035, 0.008, FLOOR.depth - 0.4]} />
          <meshLambertMaterial color="#8C6239" />
        </mesh>
      ))}

      {ROOMS.map((room) => (
        <group key={room.id}>
          <mesh position={[room.center[0], FLOOR.top + 0.02, room.center[1]]}>
            <boxGeometry args={[room.size[0], 0.025, room.size[1]]} />
            <meshLambertMaterial color={room.floor} />
          </mesh>
          <RoomLabel
            text={room.label}
            position={[
              room.center[0] + (room.center[0] > 0 ? -1.35 : 1.35),
              room.center[1] + (room.center[1] > 0 ? -1.45 : 1.45),
            ]}
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
    </group>
  );
}
