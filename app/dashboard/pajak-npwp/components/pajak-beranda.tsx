"use client";
import { useMemo } from "react";
import { DollarSign, TrendingUp, CheckCircle, AlertTriangle, Clock, Shield } from "lucide-react";
import type { NpwpProfile, OmzetBulanan } from "../page";

const BATAS_UMKM = 4_800_000_000;
const BATAS_PKP = 500_000_000;
const BULAN = ["", "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function fmtRp(n: number) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }

export default function PajakBeranda({
  npwp, tahun, omzetTahunIni, totalPphTerutang, totalPphDibayar, omzetPerBulan,
}: {
  npwp: NpwpProfile | null; tahun: number; omzetTahunIni: number;
  totalPphTerutang: number; totalPphDibayar: number; omzetPerBulan: OmzetBulanan[];
}) {
  const pphEstimasi = omzetTahunIni * 0.005;
  const kurangBayar = Math.max(0, pphEstimasi - totalPphDibayar);
  const pctOmzet = Math.min((omzetTahunIni / BATAS_UMKM) * 100, 100);

  const statusColor = omzetTahunIni >= BATAS_UMKM ? "#EC4899" : omzetTahunIni >= BATAS_PKP ? "#F59E0B" : "#2DD4BF";
  const statusLabel = omzetTahunIni >= BATAS_UMKM
    ? "Lewat batas UMKM — konsultasi akuntan"
    : omzetTahunIni >= BATAS_PKP
      ? "Mendekati batas PKP (Rp500jt)"
      : "Tarif UMKM 0,5% berlaku";

  const reminders = useMemo(() => {
    const now = new Date();
    const items: { label: string; date: string; urgent: boolean }[] = [];
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 15);
    const daysToSetor = Math.ceil((nextMonth.getTime() - now.getTime()) / 86_400_000);
    items.push({
      label: `Setoran PPh Final bulan ${BULAN[now.getMonth() + 1]}`,
      date: `${nextMonth.getDate()} ${BULAN[nextMonth.getMonth() + 1]} ${nextMonth.getFullYear()}`,
      urgent: daysToSetor <= 7,
    });
    const sptDate = new Date(tahun + 1, 2, 31);
    const daysToSpt = Math.ceil((sptDate.getTime() - now.getTime()) / 86_400_000);
    items.push({
      label: "Lapor SPT Tahunan",
      date: `31 Maret ${tahun + 1}`,
      urgent: daysToSpt <= 30,
    });
    return items;
  }, [tahun]);

  const cards = [
    { label: "Omzet Tahun Ini", value: fmtRp(omzetTahunIni), icon: DollarSign, color: "#2DD4BF" },
    { label: "PPh Terutang (est)", value: fmtRp(pphEstimasi), icon: TrendingUp, color: "#A78BFA" },
    { label: "Sudah Dibayar", value: fmtRp(totalPphDibayar), icon: CheckCircle, color: "#4ADE80" },
    { label: "Kurang Bayar", value: fmtRp(kurangBayar), icon: AlertTriangle, color: kurangBayar > 0 ? "#F43F5E" : "#4ADE80" },
  ];

  return (
    <div>
      {/* NPWP info */}
      {npwp && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-white/[0.08] p-4" style={{ background: "#0D0D1A" }}>
          <Shield size={18} className="text-[#2DD4BF]" />
          <div>
            <p className="text-sm font-semibold">{npwp.nama_wp || "—"}</p>
            <p className="text-xs text-[#8B8AA0]">NPWP: {npwp.npwp || "—"} · {npwp.jenis_usaha || "—"} {npwp.klu ? `· KLU: ${npwp.klu}` : ""}</p>
          </div>
        </div>
      )}

      {!npwp && (
        <div className="mb-5 rounded-2xl border border-dashed border-[#F59E0B]/30 bg-[#F59E0B]/5 p-4 text-center text-sm text-[#F59E0B]">
          Belum ada data NPWP. Isi di tab Riwayat.
        </div>
      )}

      {/* KPI cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(c => (
          <div key={c.label} className="rounded-2xl border p-4" style={{ borderColor: c.color + "33", background: "#0D0D1A" }}>
            <div className="mb-2 flex items-center gap-2">
              <c.icon size={14} style={{ color: c.color }} />
              <p className="text-[10px] uppercase tracking-wide text-[#8B8AA0]">{c.label}</p>
            </div>
            <p className="font-bold text-lg" style={{ color: c.color, fontFamily: "'JetBrains Mono', monospace" }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Progress bar — omzet vs batas UMKM */}
      <div className="mb-6 rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Omzet {tahun} vs Batas UMKM (Rp4,8M)</p>
          <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: statusColor + "22", color: statusColor }}>
            {pctOmzet.toFixed(1)}%
          </span>
        </div>
        <div className="h-4 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pctOmzet}%`, background: `linear-gradient(90deg, ${statusColor}, ${statusColor}88)` }} />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: statusColor }} />
          <p className="text-xs" style={{ color: statusColor }}>{statusLabel}</p>
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-[#5A5B7A]">
          <span>{fmtRp(omzetTahunIni)}</span>
          <span>{fmtRp(BATAS_UMKM)}</span>
        </div>
      </div>

      {/* Omzet per bulan */}
      <div className="mb-6 rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Rekap Omzet per Bulan {tahun}</p>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {omzetPerBulan.map(o => (
            <div key={o.bulan} className="rounded-xl border border-white/[0.06] bg-[#0A0A12]/60 p-2 text-center">
              <p className="text-[10px] text-[#5A5B7A]">{BULAN[o.bulan]}</p>
              <p className="font-mono text-xs font-semibold text-[#2DD4BF]">{o.total > 0 ? fmtRp(o.total) : "—"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Reminder */}
      <div className="rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">
          <Clock size={12} className="inline mr-1" /> Reminder Pajak
        </p>
        <div className="space-y-2">
          {reminders.map(r => (
            <div key={r.label} className="flex items-center gap-3 rounded-xl border p-3"
              style={{ borderColor: r.urgent ? "rgba(244,63,94,.3)" : "rgba(255,255,255,.06)", background: r.urgent ? "rgba(244,63,94,.05)" : "transparent" }}>
              {r.urgent ? <AlertTriangle size={14} className="text-[#F43F5E]" /> : <Clock size={14} className="text-[#5A5B7A]" />}
              <div className="flex-1">
                <p className="text-sm font-medium">{r.label}</p>
                <p className="text-[10px] text-[#5A5B7A]">Jatuh tempo: {r.date}</p>
              </div>
              {r.urgent && <span className="rounded-full bg-[#F43F5E]/15 px-2 py-0.5 text-[9px] font-semibold text-[#F43F5E]">Segera!</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
