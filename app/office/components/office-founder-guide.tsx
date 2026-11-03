"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { OfficeAlert } from "@/lib/office/types";

type Pose = "calm" | "explain" | "angry";

function poseFor(alert: OfficeAlert | null): Pose {
  if (!alert) return "explain";
  if (alert.tone === "warn") return "angry";
  if (alert.tone === "ok") return "calm";
  return "explain";
}

const POSE_SRC: Record<Pose, string> = {
  calm: "/office-founder-calm.png",
  explain: "/office-founder-explain.png",
  angry: "/office-founder-angry.png",
};

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
  const pose = poseFor(alert);

  return (
    <div
      className={[
        "pointer-events-none absolute bottom-0 left-0 z-20 flex flex-col justify-end overflow-visible",
        compact ? "h-full w-[46%] max-w-[11.5rem]" : "h-full w-[30%] max-w-[270px]",
      ].join(" ")}
    >
      {/* Bubble di atas kepala — tidak nempel ke kantor */}
      <motion.button
        type="button"
        onClick={onOpen}
        className={[
          "pointer-events-auto relative z-30 mb-1 ml-2 text-left",
          compact ? "mr-1 max-w-[10.5rem]" : "ml-3 max-w-[13.5rem]",
        ].join(" ")}
        animate={reduce ? undefined : { y: [0, -3, 0] }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <div
          className={[
            "rounded-2xl px-3 py-2.5 text-white shadow-[0_10px_24px_rgba(40,20,80,0.28)]",
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

      {/* Satu layer orang saja — pose ganti sesuai emosi HR, tanpa ghost/stack */}
      <button
        type="button"
        aria-label="Buka notifikasi HR"
        onClick={onOpen}
        className="pointer-events-auto relative mt-auto flex h-[68%] w-full items-end justify-start overflow-hidden pl-1"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.img
            key={pose}
            src={POSE_SRC[pose]}
            alt=""
            draggable={false}
            className={[
              "origin-bottom select-none object-contain object-bottom drop-shadow-[0_16px_28px_rgba(40,20,80,0.22)]",
              compact ? "h-[100%] max-h-[240px] w-auto" : "h-full w-auto max-w-[100%]",
            ].join(" ")}
            initial={reduce ? false : { opacity: 0, y: 12, scale: 0.98 }}
            animate={
              reduce
                ? { opacity: 1, y: 0, scale: 1 }
                : warn
                  ? { opacity: 1, y: [0, -5, 0, -3, 0], rotate: [0, -1.4, 1.2, 0], scale: 1 }
                  : pose === "explain"
                    ? { opacity: 1, y: [0, -4, 0], rotate: [0, 0.8, 0], scale: 1 }
                    : { opacity: 1, y: [0, -3, 0], scale: 1 }
            }
            exit={reduce ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
            transition={
              warn
                ? { duration: 1.1, repeat: Infinity, ease: "easeInOut", opacity: { duration: 0.25 } }
                : { duration: 3.8, repeat: Infinity, ease: "easeInOut", opacity: { duration: 0.25 }, scale: { duration: 0.25 } }
            }
          />
        </AnimatePresence>
      </button>
    </div>
  );
}
