"use client";
import { useState, useMemo } from "react";
import { Calculator } from "lucide-react";
import type { OmzetBulanan } from "../page";

const BULAN_NAMES = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const BATAS_UMKM = 4_800_000_000;
const PPH_RATE = 0.005;

function fmtRp(n: number) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }

export default function PajakKalkulator({
  tahun, omzetPerBulan, omzetTahunIni,
}: { tahun: number; omzetPerBulan: OmzetBulanan[]; omzetTahunIni: number }) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [manualOmzet, setManualOmzet] = useState("");

  const omzetBulanIni = useMemo(() => {
    if (manualOmzet) return Number(manualOmzet) || 0;
    const found = omzetPerBulan.find(o => o.bulan === selectedMonth);
    return found?.total || 0;
  }, [selectedMonth, omzetPerBulan, manualOmzet]);

  const omzetKumulatif = useMemo(() => {
    return omzetPerBulan.filter(o => o.bulan <= selectedMonth).reduce((s, o) => s + o.total, 0)
      + (manualOmzet ? Number(manualOmzet) || 0 : 0)
      - (omzetPerBulan.find(o => o.bulan === selectedMonth)?.total || 0);
  }, [selectedMonth, omzetPerBulan, manualOmzet]);

  const finalOmzetKumulatif = omzetKumulatif + omzetBulanIni;
  const pphBulanIni = omzetBulanIni * PPH_RATE;
  const pphTahunIni = finalOmzetKumulatif * PPH_RATE;
  const sisaBatas = Math.max(0, BATAS_UMKM - finalOmzetKumulatif);
  const masihUmkm = finalOmzetKumulatif < BATAS_UMKM;

  const inputCls = "w-full rounded-xl border border-white/[0.08] bg-[#0A0A12] px-3 py-2.5 text-sm text-[#F0EFF8] outline-none focus:border-[#2DD4BF]/40 transition-colors";

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <Calculator size={18} className="text-[#2DD4BF]" />
        <h2 className="text-sm font-semibold">Kalkulator PPh Final UMKM (PP 55/2022)</h2>
      </div>

      {/* Input */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3 rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-[#8B8AA0]">Bulan</label>
          <select className={inputCls} value={selectedMonth} onChange={e => { setSelectedMonth(Number(e.target.value)); setManualOmzet(""); }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>{BULAN_NAMES[m]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-[#8B8AA0]">Omzet bulan ini (Rp)</label>
          <input className={inputCls} type="number" placeholder={fmtRp(omzetPerBulan.find(o => o.bulan === selectedMonth)?.total || 0)}
            value={manualOmzet} onChange={e => setManualOmzet(e.target.value)} />
          <p className="mt-1 text-[10px] text-[#5A5B7A]">Otomatis dari transaksi, atau isi manual</p>
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-[#8B8AA0]">Omzet kumulatif {tahun}</label>
          <div className="rounded-xl border border-[#2DD4BF]/20 bg-[#2DD4BF]/5 p-2.5">
            <p className="font-bold text-[#2DD4BF]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtRp(finalOmzetKumulatif)}</p>
          </div>
        </div>
      </div>

      {/* Output */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#A78BFA]/20 p-5" style={{ background: "#0D0D1A" }}>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-[#8B8AA0]">PPh Final {BULAN_NAMES[selectedMonth]}</p>
          <p className="mb-1 text-xs text-[#5A5B7A]">{fmtRp(omzetBulanIni)} × 0,5%</p>
          <p className="text-2xl font-bold text-[#A78BFA]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtRp(pphBulanIni)}</p>
        </div>

        <div className="rounded-2xl border border-[#2DD4BF]/20 p-5" style={{ background: "#0D0D1A" }}>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-[#8B8AA0]">PPh Final Tahun {tahun} (kumulatif)</p>
          <p className="mb-1 text-xs text-[#5A5B7A]">{fmtRp(finalOmzetKumulatif)} × 0,5%</p>
          <p className="text-2xl font-bold text-[#2DD4BF]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtRp(pphTahunIni)}</p>
        </div>

        <div className="rounded-2xl border p-5 sm:col-span-2" style={{ borderColor: masihUmkm ? "rgba(45,212,191,.2)" : "rgba(236,72,153,.2)", background: "#0D0D1A" }}>
          <p className="mb-1 text-[10px] uppercase tracking-wide text-[#8B8AA0]">Sisa Omzet Sebelum Tarif Normal</p>
          <p className="text-xl font-bold" style={{ color: masihUmkm ? "#2DD4BF" : "#EC4899", fontFamily: "'JetBrains Mono', monospace" }}>
            {masihUmkm ? fmtRp(sisaBatas) : "Rp0"}
          </p>
          <div className="mt-3 flex items-center gap-2 rounded-xl p-2" style={{ background: masihUmkm ? "rgba(45,212,191,.08)" : "rgba(236,72,153,.08)" }}>
            <span className="h-2 w-2 rounded-full" style={{ background: masihUmkm ? "#2DD4BF" : "#EC4899" }} />
            <p className="text-xs font-medium" style={{ color: masihUmkm ? "#2DD4BF" : "#EC4899" }}>
              {masihUmkm ? "Masih tarif UMKM 0,5%" : "Sudah lewat batas Rp4,8M — konsultasi akuntan"}
            </p>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="mt-5 rounded-xl border border-white/[0.06] bg-[#0A0A12]/60 p-4 text-xs text-[#5A5B7A]">
        <p className="font-semibold text-[#8B8AA0] mb-1">Dasar hukum:</p>
        <p>PP No. 55 Tahun 2022 — UMKM dengan omzet ≤ Rp4,8M/tahun dikenakan PPh Final 0,5% dari omzet bruto. Omzet s.d. Rp500jt/tahun bebas pajak (PTKP UMKM).</p>
      </div>
    </div>
  );
}
