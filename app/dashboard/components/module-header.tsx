import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { MessageCircle } from "lucide-react";

export default function ModuleHeader({
  icon: Icon,
  title,
  subtitle,
  status,
  chatHint,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  status?: "live" | "beta";
  chatHint?: string;
}) {
  return (
    <div className="mb-6">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Icon size={22} className="text-[#2DD4BF]" />
        <h1 className="text-xl font-semibold sm:text-2xl">{title}</h1>
        {status === "beta" && (
          <span className="rounded-full border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-2 py-0.5 text-[10px] font-medium text-[#F59E0B]">
            Beta
          </span>
        )}
      </div>
      {subtitle && <p className="text-sm text-[#8B8AA0]">{subtitle}</p>}
      {chatHint && (
        <Link
          href={`/dashboard/chat`}
          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#2DD4BF]/25 bg-[#2DD4BF]/10 px-3 py-2 text-xs font-medium text-[#2DD4BF] hover:bg-[#2DD4BF]/15"
        >
          <MessageCircle size={14} />
          {chatHint}
        </Link>
      )}
    </div>
  );
}
