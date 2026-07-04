"use client";
import { useCallback } from "react";
import { ClipboardList, Download } from "lucide-react";

const PTKP_UMKM = 500_000_000;

function fmtRp(n: number) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }

export default function PajakLaporan({
  tahun, totalPemasukan, totalPengeluaran, omzetTahunIni,
}: { tahun: number; totalPemasukan: number; totalPengeluaran: number; omzetTahunIni: number }) {
  const labaBersih = totalPemasukan - totalPengeluaran;
  const omzetKenaPajak = Math.max(0, omzetTahunIni - PTKP_UMKM);
  const pphTerutang = omzetKenaPajak * 0.005;

  const rows = [
    { label: "Total Pemasukan (Omzet Bruto)", value: totalPemasukan, color: "#2DD4BF" },
    { label: "PTKP UMKM (Bebas Pajak)", value: -Math.min(omzetTahunIni, PTKP_UMKM), color: "#4ADE80" },
    { label: "Omzet Kena Pajak", value: omzetKenaPajak, color: "#FBBF24", bold: true },
    { label: "Total Pengeluaran Usaha", value: -totalPengeluaran, color: "#F43F5E" },
    { label: "Laba Bersih Usaha", value: labaBersih, color: labaBersih >= 0 ? "#4ADE80" : "#F43F5E", bold: true },
    { label: "Estimasi PPh Final Terutang (0,5% dari omzet kena pajak)", value: pphTerutang, color: "#A78BFA" },
  ];

  const exportPdf = useCallback(() => {
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Laporan Laba Rugi ${tahun}</title>
<style>body{font-family:sans-serif;padding:40px;color:#333}
h1{font-size:20px;border-bottom:2px solid #2DD4BF;padding-bottom:8px}
table{width:100%;border-collapse:collapse;margin-top:20px}
td{padding:10px 12px;border-bottom:1px solid #eee}
.right{text-align:right;font-family:monospace;font-size:14px}
.bold{font-weight:bold}
.footer{margin-top:30px;font-size:11px;color:#888}
</style></head><body>
<h1>Laporan Laba Rugi Sederhana — Tahun ${tahun}</h1>
<p style="color:#666;font-size:13px">Untuk keperluan SPT Tahunan</p>
<table>
${rows.map(r => `<tr><td${r.bold ? ' class="bold"' : ""}>${r.label}</td><td class="right${r.bold ? " bold" : ""}">${r.value < 0 ? "-" : ""}Rp${Math.abs(r.value).toLocaleString("id-ID")}</td></tr>`).join("")}
</table>
<div class="footer">
<p>Dokumen ini dihasilkan otomatis oleh Gercep AI — Pajak NPWP Center</p>
<p>Tanggal cetak: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
<p>Catatan: Ini adalah estimasi. Untuk pelaporan resmi, konsultasikan dengan akuntan.</p>
</div>
</body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank");
    setTimeout(() => { w?.print(); }, 500);
  }, [tahun, rows]);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList size={18} className="text-[#2DD4BF]" />
          <h2 className="text-sm font-semibold">Laporan Laba Rugi Sederhana — {tahun}</h2>
        </div>
        <button type="button" onClick={exportPdf} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#2DD4BF] to-[#8B5CF6] px-4 py-2 text-xs font-bold text-white">
          <Download size={14} /> Export PDF
        </button>
      </div>

      <p className="mb-4 text-xs text-[#5A5B7A]">Data diambil otomatis dari transaksi bisnis (scope: bisnis)</p>

      <div className="rounded-2xl border border-white/[0.08] overflow-hidden" style={{ background: "#0D0D1A" }}>
        {rows.map((r, i) => (
          <div key={r.label} className={"flex items-center justify-between px-5 py-4" + (i < rows.length - 1 ? " border-b border-white/[0.06]" : "")}
            style={r.bold ? { background: "rgba(255,255,255,.02)" } : undefined}>
            <p className={"text-sm " + (r.bold ? "font-semibold" : "text-[#8B8AA0]")}>{r.label}</p>
            <p className={"text-sm " + (r.bold ? "font-bold text-lg" : "")} style={{ color: r.color, fontFamily: "'JetBrains Mono', monospace" }}>
              {r.value < 0 ? "-" : ""}{fmtRp(Math.abs(r.value))}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-white/[0.06] bg-[#0A0A12]/60 p-4 text-xs text-[#5A5B7A]">
        <p>Catatan: Laporan ini menggunakan data transaksi yang tersedia. Untuk SPT resmi, pastikan semua transaksi sudah tercatat lengkap dan konsultasikan dengan akuntan publik.</p>
      </div>
    </div>
  );
}
