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
  compact,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center text-center ${compact ? "px-3 py-4" : "px-6 py-10"}`}>
      {!compact && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]">
          <Icon size={24} className="text-[#5A5B7A]" />
        </div>
      )}
      <p className={`font-medium text-[#F0EFF8] ${compact ? "mb-0.5 text-xs" : "mb-1 text-sm"}`}>{title}</p>
      {subtitle && <p className={`max-w-xs leading-relaxed text-[#5A5B7A] ${compact ? "mb-2 text-[10px]" : "mb-4 text-xs"}`}>{subtitle}</p>}
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
