"use client";
import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import { FNB_NAV_BOTTOM_OFFSET } from "../lib/mobile-layout";

const BTN_GRAD = { background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" } as const;

export default function FnbMobileActionBar({
  label,
  onClick,
  icon: Icon = Plus,
}: {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
}) {
  return (
    <div
      className="fixed inset-x-0 z-40 border-t border-white/[0.08] bg-[#0D0D1A] px-3 py-2 md:hidden"
      style={{ bottom: FNB_NAV_BOTTOM_OFFSET }}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold active:scale-[0.99]"
        style={BTN_GRAD}
      >
        <Icon size={18} />
        {label}
      </button>
    </div>
  );
}
