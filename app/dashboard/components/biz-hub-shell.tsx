import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import ModuleHeader from "./module-header";
import { MODULE_CARD } from "./module-form-styles";

export type HubLink = { href: string; label: string; desc: string };

export default function BizHubShell({
  icon,
  title,
  subtitle,
  businessName,
  links,
  kpis,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  businessName?: string;
  links?: HubLink[];
  kpis?: { label: string; value: string; color?: string }[];
  children?: React.ReactNode;
}) {
  return (
    <div className="w-full min-w-0 px-3 py-3 sm:px-8 sm:py-8">
      <div className="mb-1 flex items-center justify-between gap-2">
        <ModuleHeader icon={icon} title={title} subtitle={subtitle} status="live" />
        {businessName && (
          <span className="mb-6 max-w-[40%] truncate rounded-full bg-white/5 px-3 py-1 text-xs text-[#8B8AA0]">
            {businessName}
          </span>
        )}
      </div>

      {kpis && kpis.length > 0 && (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className={MODULE_CARD}>
              <p className="text-[11px] text-[#8B8AA0]">{k.label}</p>
              <p className="mt-1 text-lg font-semibold" style={{ color: k.color || "#F0EFF8" }}>
                {k.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {links && links.length > 0 && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-2xl border border-white/[0.08] bg-[#0D0D1A] p-4 transition-colors hover:border-[#2DD4BF]/30"
            >
              <p className="text-sm font-semibold text-[#F0EFF8]">{l.label}</p>
              <p className="mt-1 text-xs text-[#8B8AA0]">{l.desc}</p>
            </Link>
          ))}
        </div>
      )}

      {children}
    </div>
  );
}

export function fmtRp(n: number) {
  return "Rp " + Math.round(n).toLocaleString("id-ID");
}
