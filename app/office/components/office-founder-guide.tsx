"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { OfficeAlert } from "@/lib/office/types";

export default function OfficeFounderGuide({
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
    <div className={["pointer-events-none absolute inset-y-0 left-0 z-20", compact ? "w-[48%]" : "w-[36%] max-w-[320px]"].join(" ")}>
      {/* Bubble ikut gerak kecil saat jelasin */}
      <motion.button
        type="button"
        onClick={onOpen}
        className={["pointer-events-auto absolute z-30 text-left", compact ? "top-3 left-2 w-[92%] max-w-[12rem]" : "top-[7%] left-[6%] w-[210px]"].join(" ")}
        animate={
          reduce
            ? undefined
            : {
                y: [0, -4, 0, -2, 0],
                rotate: [0, -1.2, 0.8, 0],
              }
        }
        transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
        key={alert?.id || "hello"}
        initial={reduce ? false : { scale: 0.92, opacity: 0.7 }}
        whileInView={reduce ? undefined : { scale: 1, opacity: 1 }}
      >
        <motion.div
          className={[
            "rounded-2xl px-3 py-2.5 text-white shadow-[0_12px_28px_rgba(91,33,182,0.4)]",
            warn
              ? "bg-gradient-to-br from-[#F59E0B] to-[#DC2626]"
              : ok
                ? "bg-gradient-to-br from-[#34D399] to-[#059669]"
                : "bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9]",
            compact ? "px-2.5 py-2" : "",
          ].join(" ")}
          animate={reduce ? undefined : { scale: [1, 1.03, 1] }}
          transition={{ duration: 0.55 }}
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
        </motion.div>
        <div
          className={[
            "ml-5 h-0 w-0 border-t-8 border-r-8 border-t-transparent",
            warn ? "border-r-[#DC2626]" : ok ? "border-r-[#059669]" : "border-r-[#6D28D9]",
          ].join(" ")}
        />
      </motion.button>

      {/* Orang besar: idle + gesture jelasin */}
      <motion.button
        type="button"
        aria-label="Buka notifikasi HR"
        onClick={onOpen}
        className="pointer-events-auto absolute inset-x-0 bottom-0 flex h-[88%] items-end justify-start overflow-visible"
        animate={
          reduce
            ? undefined
            : {
                y: [0, -10, 0, -6, 0],
                rotate: [0, -2.2, 1.6, -1, 0],
                x: [0, 4, -2, 3, 0],
              }
        }
        transition={{ duration: 5.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.img
          src="/office-founder-guide.png"
          alt=""
          draggable={false}
          className={[
            "origin-bottom select-none object-contain drop-shadow-[0_18px_40px_rgba(40,20,80,0.28)]",
            compact ? "h-[92%] max-h-[280px] w-auto" : "h-full w-auto max-w-none",
          ].join(" ")}
          animate={
            reduce
              ? undefined
              : warn
                ? { scale: [1, 1.04, 1], rotate: [0, 2.5, -2, 0] }
                : { scale: [1, 1.02, 1] }
          }
          transition={
            warn
              ? { duration: 0.9, repeat: Infinity, ease: "easeInOut" }
              : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }
          }
          key={alert?.id || "guide"}
        />
      </motion.button>
    </div>
  );
}
