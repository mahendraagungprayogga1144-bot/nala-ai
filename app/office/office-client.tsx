"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import OfficeHud from "./components/office-hud";
import OfficePlanFallback from "./components/office-plan-fallback";
import { useOfficeCrew } from "./hooks/use-office-crew";
import { useOfficeGraphics } from "./hooks/use-office-graphics";
import type { OfficeViewMode } from "@/lib/office/types";

const OfficeScene = dynamic(() => import("./office-scene"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">Menyiapkan kantor…</div>
  ),
});

export default function OfficeClient({
  businessId,
  businessName,
}: {
  businessId: string;
  businessName: string;
}) {
  const snapshot = useOfficeCrew(businessId);
  const graphics = useOfficeGraphics();
  const [modeOverride, setModeOverride] = useState<OfficeViewMode | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mode: OfficeViewMode | null =
    modeOverride ?? (!graphics.ready ? null : graphics.weak || !graphics.webgl ? "2d" : "3d");

  const selected = snapshot.agents.find((agent) => agent.id === selectedId) ?? null;

  return (
    <div className="relative h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] overflow-hidden bg-[#0b0e14] text-slate-100 md:h-dvh">
      {mode && graphics.webgl ? (
        <OfficeScene
          agents={snapshot.agents}
          selectedId={selectedId}
          onSelect={setSelectedId}
          mode={mode}
          resetToken={resetToken}
          maxDpr={graphics.maxDpr}
          antialias={!graphics.weak}
          reduceMotion={graphics.reduceMotion}
        />
      ) : null}
      {graphics.ready && !graphics.webgl ? (
        <OfficePlanFallback agents={snapshot.agents} selectedId={selectedId} onSelect={setSelectedId} />
      ) : null}
      {!graphics.ready ? (
        <div className="absolute inset-0 grid place-items-center text-sm text-slate-400">Menyiapkan kantor…</div>
      ) : null}
      {mode ? (
        <OfficeHud
          snapshot={snapshot}
          businessName={businessName}
          selected={selected}
          mode={mode}
          webgl={graphics.webgl}
          weak={graphics.weak}
          onSelect={setSelectedId}
          onMode={setModeOverride}
          onReset={() => {
            setSelectedId(null);
            setResetToken((token) => token + 1);
          }}
        />
      ) : null}
    </div>
  );
}
