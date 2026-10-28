"use client";

import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { MOUSE, TOUCH, OrthographicCamera, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { OfficeViewMode } from "@/lib/office/types";

const TARGET = new Vector3(0, 0.35, 0);

const PRESET: Record<OfficeViewMode, { position: Vector3; zoom: number }> = {
  "3d": { position: new Vector3(13.5, 12, 13.5), zoom: 36 },
  "2d": { position: new Vector3(0, 20, 0.02), zoom: 50 },
};

export default function ViewRig({ mode, resetToken }: { mode: OfficeViewMode; resetToken: number }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const blend = useRef(1);

  useLayoutEffect(() => {
    const ctrl = controls.current;
    if (!ctrl) return;
    ctrl.enabled = false;
    ctrl.mouseButtons.LEFT = mode === "2d" ? MOUSE.PAN : MOUSE.ROTATE;
    ctrl.mouseButtons.RIGHT = MOUSE.PAN;
    ctrl.touches.ONE = mode === "2d" ? TOUCH.PAN : TOUCH.ROTATE;
    ctrl.touches.TWO = TOUCH.DOLLY_PAN;
    blend.current = 1;
  }, [mode, resetToken]);

  useFrame((state) => {
    const ctrl = controls.current;
    if (!ctrl || blend.current <= 0) return;
    ctrl.enabled = false;

    const cam = state.camera;
    const preset = PRESET[mode];
    cam.position.lerp(preset.position, 0.16);
    ctrl.target.lerp(TARGET, 0.16);
    if (cam instanceof OrthographicCamera) {
      cam.zoom = cam.zoom + (preset.zoom - cam.zoom) * 0.16;
      cam.updateProjectionMatrix();
    }
    cam.lookAt(ctrl.target);

    if (cam.position.distanceTo(preset.position) < 0.08) {
      cam.position.copy(preset.position);
      ctrl.target.copy(TARGET);
      if (cam instanceof OrthographicCamera) {
        cam.zoom = preset.zoom;
        cam.updateProjectionMatrix();
      }
      cam.lookAt(TARGET);
      blend.current = 0;
      ctrl.enabled = true;
      ctrl.update();
    }
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enableRotate={mode === "3d"}
      enablePan
      enableZoom
      minPolarAngle={mode === "2d" ? 0 : 0.35}
      maxPolarAngle={mode === "2d" ? Math.PI / 2.1 : 1.2}
      minZoom={22}
      maxZoom={90}
      target={[0, 0.35, 0]}
      onStart={() => {
        blend.current = 0;
        const ctrl = controls.current;
        if (ctrl) ctrl.enabled = true;
      }}
    />
  );
}
