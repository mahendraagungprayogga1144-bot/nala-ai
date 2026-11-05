"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Briefcase,
  Brain,
  ClipboardList,
  Database,
  LayoutDashboard,
  LineChart,
  MessageSquare,
  Settings,
  Target,
  ArrowLeft,
  UserRound,
  Lightbulb,
  ShieldCheck,
} from "lucide-react";
import { MENTOR_NAV, MASTER_MENTOR_BASE } from "@/lib/master-mentor/types";
import { useMentorLocale } from "./mentor-locale-provider";

const ICONS: Record<string, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  chat: MessageSquare,
  portfolio: Briefcase,
  memory: Database,
  "memory-owner": UserRound,
  "memory-business": Briefcase,
  "memory-financial": LineChart,
  "memory-decisions": ClipboardList,
  "memory-strategy": Target,
  "memory-learning": Lightbulb,
  "memory-candidates": ShieldCheck,
  strategy: Target,
  financial: LineChart,
  journal: BookOpen,
  settings: Settings,
};

export default function MentorNav({
  ownerName,
  onNavigate,
}: {
  ownerName: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { t } = useMentorLocale();

  const isActive = (href: string) => {
    if (href === MASTER_MENTOR_BASE) return pathname === MASTER_MENTOR_BASE;
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const labelFor = (id: string, fallback: string) => t.nav[id] || fallback;

  return (
    <aside className="flex h-full w-full flex-col border-r border-[#E5E7EB] bg-white">
      <div className="border-b border-[#E5E7EB] px-5 py-5">
        <p className="text-[11px] font-semibold tracking-[0.14em] text-[#9CA3AF] uppercase">
          HENIMA AI
        </p>
        <h1 className="mt-1 text-base font-semibold text-[#111827]">{t.brandSubtitle}</h1>
        <p className="mt-1 text-xs text-[#6B7280]">{t.signedInAs(ownerName)}</p>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {MENTOR_NAV.map((item) => {
          const Icon = ICONS[item.id] || Brain;
          const active = isActive(item.href) && !item.children;
          const parentActive = item.children?.some((c) => isActive(c.href));
          return (
            <div key={item.id} className="mb-1">
              <Link
                href={item.href}
                prefetch
                onClick={() => onNavigate?.()}
                className={[
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active || (parentActive && item.id === "memory")
                    ? "bg-[#111827] text-white"
                    : "text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]",
                ].join(" ")}
              >
                <Icon size={16} strokeWidth={1.75} />
                <span className="font-medium">{labelFor(item.id, item.label)}</span>
              </Link>
              {item.children ? (
                <div className="mt-0.5 space-y-0.5 border-l border-[#E5E7EB] ml-5 pl-2">
                  {item.children.map((child) => {
                    const ChildIcon = ICONS[child.id] || Database;
                    const childActive = isActive(child.href);
                    return (
                      <Link
                        key={child.id}
                        href={child.href}
                        prefetch
                        onClick={() => onNavigate?.()}
                        className={[
                          "flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-colors",
                          childActive
                            ? "bg-[#F3F4F6] font-medium text-[#111827]"
                            : "text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]",
                        ].join(" ")}
                      >
                        <ChildIcon size={14} strokeWidth={1.75} />
                        {labelFor(child.id, child.label)}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-[#E5E7EB] p-3">
        <Link
          href="/dashboard/owner"
          onClick={() => onNavigate?.()}
          className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[#6B7280] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
        >
          <ArrowLeft size={15} strokeWidth={1.75} />
          {t.backToGercep}
        </Link>
      </div>
    </aside>
  );
}
