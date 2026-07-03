"use client";
import { useState } from "react";
import Link from "next/link";
import { Percent } from "lucide-react";
import ModuleHeader from "../components/module-header";

type Row = { id: string; nama: string; orderCount: number; omzet: number };

export default function TimKomisiClient({
  businessName, businessType, rows,
}: {
  businessName: string; businessType: string | null; rows: Row[];
}) {
  const [komisiPct, setKomisiPct] = useState("5");

  const pct = Number(komisiPct) || 0;

  if (businessType !== "kuliner") {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 text-center sm:px-8">
        <ModuleHeader icon={Percent} title="Tim dan Komisi Karyawan" subtitle={businessName} status="beta" />
        <p className="text-sm text-[#8B8AA0]">
          Rekap komisi per karyawan tersedia penuh untuk bisnis <strong className="text-[#2DD4BF]">Kuliner</strong> (data dari kasir).
        </p>
        <Link href="/dashboard/bisnis" className="mt-4 inline-block text-sm text-[#2DD4BF]">Kelola bisnis →</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
      <ModuleHeader
        icon={Percent}
        title="Tim dan Komisi Karyawan"
        subtitle={`${businessName} · penjualan hari ini`}
        status="beta"
      />

      <div className="mb-6 flex items-center gap-3">
        <label className="text-xs text-[#8B8AA0]">Komisi (%)</label>
        <input
          type="number"
          value={komisiPct}
          onChange={e => setKomisiPct(e.target.value)}
          className="w-20 rounded-lg border border-white/10 bg-[#0A0A12] px-2 py-1.5 text-sm font-mono focus:border-[#2DD4BF]/50 focus:outline-none"
        />
        <Link href="/dashboard/fnb/karyawan" className="ml-auto text-xs text-[#2DD4BF]">Kelola karyawan →</Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-center text-sm text-[#8B8AA0]">Belum ada penjualan hari ini.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map(r => {
            const komisi = Math.round(r.omzet * (pct / 100));
            return (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0D0D1A] px-4 py-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#A78BFA]/15 text-[10px] font-bold text-[#A78BFA]">
                  {r.nama.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.nama}</p>
                  <p className="text-[10px] text-[#8B8AA0]">{r.orderCount} order · omzet Rp{r.omzet.toLocaleString("id-ID")}</p>
                </div>
                <p className="font-mono text-sm font-semibold text-[#F59E0B]">Rp{komisi.toLocaleString("id-ID")}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
