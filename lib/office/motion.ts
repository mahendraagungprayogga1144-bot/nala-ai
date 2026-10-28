import type { Vec2 } from "./layout";

/** Yaw Three.js supaya sumbu depan (-Z) mengarah dari `from` ke `to`. */
export function yawToward(from: Vec2, to: Vec2) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  return Math.atan2(-dx, -dz);
}

export function loopPoint(points: readonly Vec2[], progress: number) {
  const count = points.length;
  if (count === 0) return { x: 0, z: 0, yaw: 0 };
  if (count === 1) return { x: points[0][0], z: points[0][1], yaw: 0 };

  const wrapped = ((progress % 1) + 1) % 1;
  const scaled = wrapped * count;
  const index = Math.floor(scaled) % count;
  const raw = scaled - Math.floor(scaled);
  const t = raw * raw * (3 - 2 * raw);
  const from = points[index];
  const to = points[(index + 1) % count];

  return {
    x: from[0] + (to[0] - from[0]) * t,
    z: from[1] + (to[1] - from[1]) * t,
    yaw: yawToward(from, to),
  };
}
