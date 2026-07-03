"use client";
import Link from "next/link";

const STEPS = [
  { step: "1", label: "Stok", sub: "Isi bahan + harga beli", href: "/dashboard/inventory", activeMatch: "/inventory" },
  { step: "2", label: "Menu", sub: "Resep + HPP otomatis", href: "/dashboard/fnb/menu", activeMatch: "/fnb/menu" },
  { step: "3", label: "Kasir", sub: "Jual, stok turun sendiri", href: "/dashboard/fnb/kasir", activeMatch: "/fnb/kasir" },
];

export default function FnbWorkflowSteps({ activePath }: { activePath: string }) {
  return (
    <div className="mb-4 hidden grid-cols-3 gap-2 rounded-2xl border border-white/[0.06] bg-[#0F0F1A]/60 p-3 md:grid">
      {STEPS.map(s => {
        const active = activePath.includes(s.activeMatch);
        const cls = active
          ? "rounded-xl border border-[#2DD4BF]/30 bg-[#2DD4BF]/5 px-2 py-2 text-center"
          : "rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-2 text-center transition-colors hover:border-[#2DD4BF]/30";
        const inner = (
          <>
            <p className="text-[10px] font-bold text-[#2DD4BF]">{s.step}</p>
            <p className="text-[11px] font-medium text-[#F0EFF8]">{s.label}</p>
            <p className="text-[9px] leading-tight text-[#5A5B7A]">{s.sub}</p>
          </>
        );
        return active ? (
          <div key={s.step} className={cls}>{inner}</div>
        ) : (
          <Link key={s.step} href={s.href} className={cls}>{inner}</Link>
        );
      })}
    </div>
  );
}
