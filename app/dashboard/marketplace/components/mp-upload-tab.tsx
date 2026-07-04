"use client";
import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Upload, FileText, Trash2, Check, AlertTriangle } from "lucide-react";
import { parseFile, type ParseResult } from "../lib/csv-parser";
import type { MpReport } from "../page";

const PLATFORM_TABS = [
  { id: "Shopee", color: "#F97316", label: "Shopee" },
  { id: "TikTok Shop", color: "#EC4899", label: "TikTok Shop" },
  { id: "Tokopedia", color: "#22C55E", label: "Tokopedia" },
] as const;

function fmtRp(n: number) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }

export default function MpUploadTab({
  userId, reports,
}: { userId: string; reports: MpReport[] }) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [activePlatform, setActivePlatform] = useState("Shopee");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [saved, setSaved] = useState(false);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setSaved(false);
    try {
      const parsed = await parseFile(file, activePlatform);
      setResult(parsed);
    } catch {
      alert("Gagal parse file. Pastikan format CSV/Excel sesuai.");
    }
    setLoading(false);
  }, [activePlatform]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const saveToSupabase = async () => {
    if (!result || result.orders.length === 0) return;
    setLoading(true);
    const { data: report, error: re } = await supabase.from("marketplace_reports").insert({
      user_id: userId,
      platform: result.platform, periode: result.periode,
      total_omzet: result.totalOmzet, total_fee: result.totalFee,
      dana_diterima: result.danaDiterima,
      raw_data: { orderCount: result.orders.length },
    }).select().single();

    if (re || !report) { alert(re?.message || "Gagal simpan"); setLoading(false); return; }

    const rows = result.orders.map(o => ({
      report_id: report.id,
      order_id: o.order_id, platform: o.platform,
      tanggal: o.tanggal, nama_produk: o.nama_produk, sku: o.sku,
      harga_jual: o.harga_jual,
      fee_total: o.fee_komisi + o.fee_admin + o.fee_layanan + o.fee_payment,
      dana_diterima: o.dana_diterima, status: o.status,
    }));

    const BATCH = 200;
    for (let i = 0; i < rows.length; i += BATCH) {
      await supabase.from("marketplace_orders").insert(rows.slice(i, i + BATCH));
    }

    setLoading(false);
    setSaved(true);
    router.refresh();
  };

  const deleteReport = async (id: string) => {
    if (!confirm("Hapus laporan ini?")) return;
    await supabase.from("marketplace_reports").delete().eq("id", id);
    router.refresh();
  };

  const pc = PLATFORM_TABS.find(p => p.id === activePlatform)!;

  return (
    <div>
      <div className="mb-5 flex gap-2">
        {PLATFORM_TABS.map(p => (
          <button
            key={p.id} type="button"
            onClick={() => { setActivePlatform(p.id); setResult(null); setSaved(false); }}
            className="rounded-xl px-4 py-2 text-xs font-semibold transition-colors"
            style={{
              background: activePlatform === p.id ? p.color + "22" : "transparent",
              color: activePlatform === p.id ? p.color : "#5A5B7A",
              border: `1px solid ${activePlatform === p.id ? p.color + "44" : "rgba(255,255,255,.08)"}`,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className="cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-colors"
        style={{
          borderColor: dragging ? pc.color : "rgba(255,255,255,.1)",
          background: dragging ? pc.color + "08" : "#0D0D1A",
        }}
      >
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onFileChange} />
        <Upload size={32} className="mx-auto mb-3" style={{ color: pc.color }} />
        <p className="text-sm font-medium">Drag & drop file CSV/Excel {pc.label}</p>
        <p className="mt-1 text-xs text-[#5A5B7A]">atau klik untuk pilih file</p>
      </div>

      {loading && <p className="mt-4 text-center text-sm text-[#8B8AA0] animate-pulse">Memproses file...</p>}

      {result && result.orders.length > 0 && (
        <div className="mt-6">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total Omzet", value: fmtRp(result.totalOmzet), color: "#2DD4BF" },
              { label: "Total Fee Platform", value: fmtRp(result.totalFee), color: "#F43F5E" },
              { label: "Dana Diterima Bersih", value: fmtRp(result.danaDiterima), color: "#A78BFA" },
              { label: "Jumlah Order", value: String(result.orders.length), color: pc.color },
            ].map(c => (
              <div key={c.label} className="rounded-2xl border p-4" style={{ borderColor: c.color + "33", background: "#0D0D1A" }}>
                <p className="text-[10px] uppercase tracking-wide text-[#8B8AA0]">{c.label}</p>
                <p className="mt-1 font-bold" style={{ color: c.color, fontFamily: "'JetBrains Mono', monospace" }}>{c.value}</p>
              </div>
            ))}
          </div>

          {result.orders.some(o => o.dana_diterima < o.harga_jual * 0.5) && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 p-3 text-xs text-[#F59E0B]">
              <AlertTriangle size={14} />
              <span>Ada produk dengan margin sangat rendah! Cek tab <strong>Kalkulator Harga</strong> untuk optimasi.</span>
            </div>
          )}

          {!saved ? (
            <button type="button" onClick={saveToSupabase} disabled={loading} className="gercep-gradient-btn w-full cursor-pointer rounded-xl py-3 text-sm font-bold transition-opacity hover:opacity-90">
              {loading ? "Menyimpan..." : "Simpan Laporan ke Database"}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-[#4ADE80]/10 border border-[#4ADE80]/30 py-3 text-sm font-semibold text-[#4ADE80]">
              <Check size={16} /> Tersimpan!
            </div>
          )}

          <div className="mt-5 overflow-x-auto rounded-2xl border border-white/[0.08]" style={{ background: "#0D0D1A" }}>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-[9px] uppercase tracking-wider text-[#5A5B7A]">
                  <th className="p-3">Order ID</th>
                  <th className="p-3">Produk</th>
                  <th className="p-3 text-right">Harga Jual</th>
                  <th className="p-3 text-right">Fee</th>
                  <th className="p-3 text-right">Dana Diterima</th>
                  <th className="p-3">Tanggal</th>
                </tr>
              </thead>
              <tbody>
                {result.orders.slice(0, 20).map((o, i) => (
                  <tr key={i} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <td className="p-3 font-mono text-[#8B8AA0]">{o.order_id || "—"}</td>
                    <td className="p-3 max-w-[200px] truncate">{o.nama_produk || "—"}</td>
                    <td className="p-3 text-right" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtRp(o.harga_jual)}</td>
                    <td className="p-3 text-right text-[#F43F5E]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtRp(o.fee_komisi + o.fee_admin + o.fee_layanan + o.fee_payment)}</td>
                    <td className="p-3 text-right text-[#2DD4BF]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtRp(o.dana_diterima)}</td>
                    <td className="p-3 text-[#5A5B7A]">{o.tanggal || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.orders.length > 20 && <p className="border-t border-white/[0.06] py-2 text-center text-[10px] text-[#5A5B7A]">+ {result.orders.length - 20} order lainnya</p>}
          </div>
        </div>
      )}

      {result && result.orders.length === 0 && (
        <div className="mt-6 rounded-2xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 p-6 text-center text-sm text-[#F59E0B]">
          Tidak ditemukan order selesai di file ini. Pastikan file sesuai format {activePlatform}.
        </div>
      )}

      {reports.length > 0 && (
        <div className="mt-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Riwayat Upload</p>
          <div className="space-y-2">
            {reports.map(r => {
              const ptab = PLATFORM_TABS.find(p => p.id === r.platform);
              return (
                <div key={r.id} className="group flex items-center gap-3 rounded-xl border border-white/[0.08] p-3" style={{ background: "#0D0D1A" }}>
                  <FileText size={16} style={{ color: ptab?.color || "#8B8AA0" }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{r.platform}</p>
                    <p className="text-[10px] text-[#5A5B7A]">{r.periode || "—"} · {new Date(r.created_at).toLocaleDateString("id-ID")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-[#2DD4BF]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtRp(Number(r.dana_diterima))}</p>
                    <p className="text-[10px] text-[#5A5B7A]">Omzet {fmtRp(Number(r.total_omzet))}</p>
                  </div>
                  <button type="button" onClick={() => deleteReport(r.id)} className="opacity-0 group-hover:opacity-100 text-[#5A5B7A] hover:text-[#F43F5E] transition-opacity">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
