import type { OfficeRoomId, WorkRoomId } from "./types";

export type Vec2 = readonly [number, number];

export const FLOOR = { width: 16.2, depth: 12.4, top: 0.08 } as const;

export const WALL = { height: 1.05, thickness: 0.12 } as const;

export type RoomLayout = {
  id: OfficeRoomId;
  label: string;
  center: Vec2;
  size: Vec2;
  floor: string;
};

export const ROOMS: readonly RoomLayout[] = [
  { id: "sales", label: "Ruang Sales", center: [-4.55, -3.6], size: [6.8, 4.85], floor: "#D7E6F5" },
  { id: "ops", label: "Ruang Operasional", center: [4.55, -3.6], size: [6.8, 4.85], floor: "#DCE8E3" },
  { id: "founder", label: "Ruang Founder", center: [-4.55, 3.6], size: [6.8, 4.85], floor: "#F0E2CC" },
  { id: "pantry", label: "Pantry", center: [4.55, 3.6], size: [6.8, 4.85], floor: "#F6EFE6" },
];

export type WallSegment = {
  center: Vec2;
  length: number;
  axis: "x" | "z";
};

/** Dinding setengah tinggi. Celah di sudut dalam = pintu ke selasar. */
export const WALLS: readonly WallSegment[] = [
  { center: [0, -6.2], length: 16.2, axis: "x" },
  { center: [0, 6.2], length: 16.2, axis: "x" },
  { center: [-8.1, 0], length: 12.4, axis: "z" },
  { center: [8.1, 0], length: 12.4, axis: "z" },
  { center: [-1.05, -3.95], length: 4.4, axis: "z" },
  { center: [-1.05, 3.95], length: 4.4, axis: "z" },
  { center: [1.05, -3.95], length: 4.4, axis: "z" },
  { center: [1.05, 3.95], length: 4.4, axis: "z" },
  { center: [-4.9, -1.05], length: 6.3, axis: "x" },
  { center: [4.9, -1.05], length: 6.3, axis: "x" },
  { center: [-4.9, 1.05], length: 6.3, axis: "x" },
  { center: [4.9, 1.05], length: 6.3, axis: "x" },
];

export type Station = {
  room: WorkRoomId;
  desk: Vec2;
  chair: Vec2;
};

export const STATIONS: Record<WorkRoomId, Station> = {
  sales: { room: "sales", desk: [-6.3, -4.55], chair: [-6.3, -3.5] },
  ops: { room: "ops", desk: [6.3, -4.55], chair: [6.3, -3.5] },
  founder: { room: "founder", desk: [-6.3, 4.55], chair: [-6.3, 3.5] },
};

export const PANTRY_TABLE: Vec2 = [4.55, 3.55];

/** Titik statis di pantry untuk perangkat yang mematikan animasi. */
export const PANTRY_PARK: Vec2 = [2.45, 3.55];

export function roomById(id: OfficeRoomId) {
  const room = ROOMS.find((item) => item.id === id);
  if (!room) throw new Error(`Ruangan tidak dikenal: ${id}`);
  return room;
}

/** Jalur Monitor Sales: meja -> selasar -> mengitari meja pingpong -> kembali. */
export function salesPantryLoop(chair: Vec2): Vec2[] {
  return [
    chair,
    [-1.45, -1.55],
    [0, 0],
    [1.55, 1.5],
    [2.45, 2.15],
    [2.45, 5.15],
    [6.55, 5.15],
    [6.55, 2.15],
    [1.55, 1.5],
    [0, 0],
    [-1.45, -1.55],
  ];
}
