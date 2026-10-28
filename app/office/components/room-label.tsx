"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { FLOOR } from "@/lib/office/layout";

function makeLabelTexture(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak tersedia");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(11, 14, 20, 0.82)";
  ctx.beginPath();
  ctx.moveTo(36, 28);
  ctx.arcTo(604, 28, 604, 132, 28);
  ctx.arcTo(604, 132, 36, 132, 28);
  ctx.arcTo(36, 132, 36, 28, 28);
  ctx.arcTo(36, 28, 604, 28, 28);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#F8FAFC";
  ctx.font = "600 44px Geist, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 320, 80);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export default function RoomLabel({ text, position }: { text: string; position: readonly [number, number] }) {
  const texture = useMemo(() => makeLabelTexture(text), [text]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={[position[0], FLOOR.top + 0.05, position[1]]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[3.15, 0.78]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-4} />
    </mesh>
  );
}
