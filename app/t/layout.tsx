import type { ReactNode } from "react";
import FieldScrollUnlock from "./field-scroll-unlock";
import FieldAppGuard from "./field-app-guard";

/**
 * Shell khusus link lapangan (/t/...) biar Chrome HP bisa di-scroll
 * + kunci app Cap agar tidak masuk Gercep OS internal.
 */
export default function FieldLinkLayout({ children }: { children: ReactNode }) {
  return (
    <div className="henima-field-shell min-h-[100dvh] bg-[#F7F7F5] text-[#111111]">
      <FieldScrollUnlock />
      <FieldAppGuard />
      {children}
    </div>
  );
}
