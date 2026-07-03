"use client";
import { FileText, CheckCircle2, AlertCircle } from "lucide-react";
import ModuleHeader from "../components/module-header";

const BULAN = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export default function PajakClient({
  businessName, bulan, tahun, omzet, pemasukan, pengeluaran, txCount,
}: {
  businessName: string; bulan: number; tahun: number;
  omzet: number; pemasukan: number; pengeluaran: number; txCount: number;
}) {
  const fmt = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");
  const labaKotor = pemasukan - pengeluaran;
  const pphEstimasi = Math.max(0, labaKotor * 0.005);

  const checklist = [
    { ok: omzet > 0, label: "Rekap omzet bulan berjalan" },
    { ok: txCount >= 3, label: "Transaksi tercatat di Keuangan Bisnis" },
    { ok: pengeluaran > 0, label: "Pengeluaran operasional tercatat" },
    { ok: false, label: "Upload faktur pembelian (coming soon)" },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
      <ModuleHeader
        icon={FileText}
        title="Pajak NPWP Center"
        subtitle={`${businessName} · ${BULAN[bulan]} ${tahun}`}
        status="beta"
        chatHint="Tanya rekap pajak di Gercep Chat"
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: "Omzet bulan ini", v: fmt(omzet), c: "#2DD4BF" },
          { l: "Pemasukan", v: fmt(pemasukan), c: "#38BDF8" },
          { l: "Pengeluaran", v: fmt(pengeluaran), c: "#EC4899" },
          { l: "Est. PPh 0,5%", v: fmt(pphEstimasi), c: "#F59E0B" },
        ].map(k => (
          <div key={k.l} className="rounded-2xl border border-white/[0.08] bg-[#0D0D1A] p-4">
            <p className="text-[10px] uppercase tracking-wide text-[#8B8AA0]">{k.l}</p>
            <p className="mt-1 font-mono text-sm font-bold" style={{ color: k.c }}>{k.v}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/[0.08] bg-[#0D0D1A] p-5">
        <h2 className="mb-3 text-sm font-semibold">Checklist lapor pajak</h2>
        <div className="flex flex-col gap-2">
          {checklist.map(c => (
            <div key={c.label} className="flex items-center gap-2 text-sm">
              {c.ok ? <CheckCircle2 size={16} className="text-[#2DD4BF]" /> : <AlertCircle size={16} className="text-[#5A5B7A]" />}
              <span className={c.ok ? "text-[#F0EFF8]" : "text-[#8B8AA0]"}>{c.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-[#5A5B7A]">
          Data diambil otomatis dari Keuangan Bisnis + kasir. Untuk pelaporan resmi, konsultasikan dengan konsultan pajak.
        </p>
      </div>
    </div>
  );
}
