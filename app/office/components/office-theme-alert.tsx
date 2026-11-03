"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { OfficeAlert } from "@/lib/office/types";

/** Bubble notif di atas artwork tema mock — tanpa karakter kedua yang nutupin kantor. */
export default function OfficeThemeAlert({
  greetName,
  alert,
  alertIndex,
  alertTotal,
  onOpen,
  compact = false,
}: {
  greetName: string;
  alert: OfficeAlert | null;
  alertIndex: number;
  alertTotal: number;
  onOpen: () => void;
  compact?: boolean;
}) {
  const reduce = useReducedMotion();
  const warn = alert?.tone === "warn";
  const ok = alert?.tone === "ok";

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      className={[
        "absolute z-20 text-left",
        compact ? "top-3 left-3 w-[48%] max-w-[11rem]" : "top-[9%] left-[4%] w-[220px] max-w-[28%]",
      ].join(" ")}
      animate={reduce ? undefined : { y: [0, -3, 0] }}
      transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
    >
      <div
        className={[
          "rounded-2xl px-3 py-2.5 text-white shadow-[0_12px_28px_rgba(40,20,80,0.28)]",
          warn
            ? "bg-gradient-to-br from-[#F59E0B] to-[#DC2626]"
            : ok
              ? "bg-gradient-to-br from-[#34D399] to-[#059669]"
              : "bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9]",
          compact ? "px-2.5 py-2" : "",
        ].join(" ")}
      >
        <p className={["font-semibold tracking-wide text-white/80 uppercase", compact ? "text-[9px]" : "text-[10px]"].join(" ")}>
          {alert ? "Notif HR" : "Henima"}
          {alertTotal > 1 ? ` · ${(alertIndex % alertTotal) + 1}/${alertTotal}` : ""}
        </p>
        <p className={["mt-0.5 font-bold leading-snug", compact ? "text-[11px]" : "text-[12px]"].join(" ")}>
          {alert?.title || `Semangat hari ini, ${greetName}!`}
        </p>
        <p className={["mt-0.5 line-clamp-3 leading-snug text-white/90", compact ? "text-[9px]" : "text-[10px]"].join(" ")}>
          {alert?.body || "Henima Agent siap membantu bisnis Anda."}
        </p>
      </div>
      <div
        className={[
          "ml-5 h-0 w-0 border-t-8 border-r-8 border-t-transparent",
          warn ? "border-r-[#DC2626]" : ok ? "border-r-[#059669]" : "border-r-[#6D28D9]",
        ].join(" ")}
      />
    </motion.button>
  );
}
