import type { ReactNode } from "react";
import FieldScrollUnlock from "./field-scroll-unlock";

/**
 * Shell khusus link lapangan (/t/...) biar Chrome HP bisa di-scroll.
 * Pakai scroll dokumen (bukan nested overflow) — paling andal di Android Chrome.
 */
export default function FieldLinkLayout({ children }: { children: ReactNode }) {
  return (
    <div className="henima-field-shell min-h-[100dvh] bg-[#F7F7F5] text-[#111111]">
      <FieldScrollUnlock />
      {children}
    </div>
  );
}
