"use client";
import { KASIR } from "../lib/kasir-theme";

export function FnbGradientLine() {
  return <div className="h-[2px] shrink-0" style={{ background: KASIR.gradient.headerLine }} />;
}

export const FNB_VIVID_CARD =
  "overflow-hidden rounded-2xl border border-[#2DD4BF]/25 bg-[#13131F]/95 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-md";

export default function FnbVividShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative w-full min-w-0 max-w-full max-md:-mx-3 max-md:px-3 max-md:pb-[calc(56px+env(safe-area-inset-bottom))] max-md:pt-1 md:mx-0 md:px-0 md:pb-0 md:pt-0"
      style={{ background: KASIR.bg.mesh }}
    >
      {children}
    </div>
  );
}
