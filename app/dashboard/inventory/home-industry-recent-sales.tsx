"use client";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { fmtRp } from "./home-industry-calc";

type Sale = { description: string | null; amount: number };

export default function HomeIndustryRecentSales({ sales, today }: { sales: Sale[]; today: string }) {
  if (!sales.length) return null;

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-white/[0.08]" style={{ background: "#0D0D1A" }}>
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <ShoppingBag size={14} className="text-[#2DD4BF]" />
          <p className="text-sm font-medium text-[#F0EFF8]">Penjualan hari ini</p>
        </div>
        <Link href="/dashboard/keuangan-bisnis" className="text-[10px] text-[#2DD4BF] underline">Keuangan →</Link>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {sales.map((s, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-2.5">
            <p className="text-xs text-[#8B8AA0] truncate flex-1 mr-3">{s.description || "Penjualan"}</p>
            <span className="font-mono text-xs font-semibold text-[#2DD4BF]">{fmtRp(Number(s.amount))}</span>
          </div>
        ))}
      </div>
      <p className="px-4 py-2 text-[10px] text-[#5A5B7A]">{today} · WIB</p>
    </div>
  );
}
