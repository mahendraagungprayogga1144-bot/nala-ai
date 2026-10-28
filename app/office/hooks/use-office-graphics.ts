"use client";

import { useEffect, useState } from "react";

export type OfficeGraphics = {
  ready: boolean;
  weak: boolean;
  webgl: boolean;
  maxDpr: number;
  reduceMotion: boolean;
};

const INITIAL: OfficeGraphics = {
  ready: false,
  weak: false,
  webgl: true,
  maxDpr: 1,
  reduceMotion: false,
};

function detectWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function useOfficeGraphics() {
  const [graphics, setGraphics] = useState<OfficeGraphics>(INITIAL);

  useEffect(() => {
    const webgl = detectWebGL();
    const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const read = () => {
      const cores = navigator.hardwareConcurrency;
      const narrow = window.innerWidth < 768;
      const weak = (typeof cores === "number" && cores <= 4) || narrow;
      setGraphics({
        ready: true,
        weak,
        webgl,
        maxDpr: weak ? 1 : 1.5,
        reduceMotion: reduceQuery.matches,
      });
    };

    read();
    window.addEventListener("resize", read);
    reduceQuery.addEventListener("change", read);
    return () => {
      window.removeEventListener("resize", read);
      reduceQuery.removeEventListener("change", read);
    };
  }, []);

  return graphics;
}
