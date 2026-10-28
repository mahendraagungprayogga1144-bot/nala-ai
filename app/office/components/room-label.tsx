"use client";

import { useEffect, useMemo } from "react";
import { Billboard } from "@react-three/drei";
import * as THREE from "three";

function makeLabelTexture(title: string, subtitle: string, accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 768;
  canvas.height = subtitle ? 220 : 160;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D tidak tersedia");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "rgba(11, 14, 20, 0.88)";
  const radius = 28;
  const right = canvas.width - 16;
  const bottom = canvas.height - 16;
  ctx.beginPath();
  ctx.moveTo(16 + radius, 16);
  ctx.arcTo(right, 16, right, bottom, radius);
  ctx.arcTo(right, bottom, 16, bottom, radius);
  ctx.arcTo(16, bottom, 16, 16, radius);
  ctx.arcTo(16, 16, right, 16, radius);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = accent;
  ctx.fillRect(16, 16, 10, bottom - 16);

  ctx.fillStyle = "#F8FAFC";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 54;
  ctx.font = `700 ${size}px Geist, sans-serif`;
  while (ctx.measureText(title).width > canvas.width - 90 && size > 28) {
    size -= 2;
    ctx.font = `700 ${size}px Geist, sans-serif`;
  }
  ctx.fillText(title, canvas.width / 2 + 6, subtitle ? 78 : canvas.height / 2);

  if (subtitle) {
    ctx.fillStyle = accent;
    ctx.font = "600 36px Geist, sans-serif";
    ctx.fillText(subtitle, canvas.width / 2 + 6, 148);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export default function FaceLabel({
  title,
  subtitle = "",
  accent = "#F8FAFC",
  position,
  width = 2.7,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  position: readonly [number, number, number];
  width?: number;
}) {
  const texture = useMemo(() => makeLabelTexture(title, subtitle, accent), [title, subtitle, accent]);

  useEffect(() => () => texture.dispose(), [texture]);

  const height = subtitle ? width * (220 / 768) : width * (160 / 768);

  return (
    <Billboard position={position} follow>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} />
      </mesh>
    </Billboard>
  );
}
