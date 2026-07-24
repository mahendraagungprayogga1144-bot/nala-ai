"use client";

import { useEffect, useState } from "react";

/** True when homepage should skip heavy 3D (mobile / save-data / reduced motion). */
export function useLightHome() {
  const [light, setLight] = useState(true); // SSR + first paint: assume light (faster mobile)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } })
      .connection;
    const slowNet =
      conn?.saveData === true ||
      conn?.effectiveType === "slow-2g" ||
      conn?.effectiveType === "2g" ||
      conn?.effectiveType === "3g";
    const lowCpu = typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4;

    const compute = () => {
      setLight(mq.matches || reduce.matches || slowNet || lowCpu);
    };
    compute();
    mq.addEventListener("change", compute);
    reduce.addEventListener("change", compute);
    return () => {
      mq.removeEventListener("change", compute);
      reduce.removeEventListener("change", compute);
    };
  }, []);

  return light;
}
