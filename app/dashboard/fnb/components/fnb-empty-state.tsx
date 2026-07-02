"use client";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export default function FnbEmptyState({
  icon: Icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  actionHref,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
        <Icon size={24} className="text-[#5A5B7A]" />
      </div>
      <p className="mb-1 text-sm font-medium text-[#F0EFF8]">{title}</p>
      {subtitle && <p className="mb-4 max-w-xs text-xs leading-relaxed text-[#5A5B7A]">{subtitle}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="rounded-xl px-4 py-2.5 text-xs font-semibold"
          style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}
        >
          {actionLabel}
        </button>
      )}
      {actionLabel && actionHref && !onAction && (
        <Link
          href={actionHref}
          className="rounded-xl px-4 py-2.5 text-xs font-semibold"
          style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
