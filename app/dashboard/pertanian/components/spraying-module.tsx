"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Download, FileSpreadsheet, FileText } from "lucide-react";
import type { SprayingRecord } from "../lib/types";
import { SPRAYING_TYPES, inputCls, cardCls, fmtRp } from "../lib/constants";
import { insertKeuanganPengeluaran } from "../lib/agri-sync";
import { todayWib } from "@/lib/date";
import { exportSprayingCSV, exportSprayingExcel, exportSprayingPDF } from "../lib/export";

type Props = { records: SprayingRecord[]; userId: string; businessId: string; compact?: boolean };

export default function SprayingModule({ records, userId, businessId, compact }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const [fTanggal, setFTanggal] = useState(todayWib());
  const [fNama, setFNama] = useState("");
  const [fJenis, setFJenis] = useState(SPRAYING_TYPES[0]);
  const [fDosis, setFDosis] = useState("");
  const [fLuas, setFLuas] = useState("");
  const [fBiaya, setFBiaya] = useState("");
  const [fOperator, setFOperator] = useState("");
  const [fCatatan, setFCatatan] = useState("");

  const filtered = records.filter(r => {
    if (filterFrom && r.tanggal < filterFrom) return false;
    if (filterTo && r.tanggal > filterTo) return false;
    return true;
  });

  const handleSave = async () => {
    if (!fNama) return;
    setLoading(true);
    await supabase.from("agri_spraying_records").insert({
      user_id: userId, business_id: businessId, tanggal: fTanggal,
      nama_produk: fNama, jenis_produk: fJenis, dosis: fDosis || null,
      luas_area: fLuas ? Number(fLuas) : null, biaya: fBiaya ? Number(fBiaya) : 0,
      operator: fOperator || null, catatan: fCatatan || null,
    });
    if (Number(fBiaya) > 0) {
      await insertKeuanganPengeluaran(supabase, {
        userId, businessId,
        category: "Pestisida",
        description: `Semprot ${fNama} (${fJenis}) — Pertanian`,
        amount: Number(fBiaya),
        tanggal: fTanggal,
      });
    }
    setLoading(false);
    setFNama(""); setFDosis(""); setFLuas(""); setFBiaya(""); setFOperator(""); setFCatatan("");
    setShowForm(false);
    router.refresh();
  };

  const handleDelete = async (r: SprayingRecord) => {
    if (!confirm("Hapus riwayat?")) return;
    await supabase.from("agri_spraying_records").delete().eq("id", r.id);
    if (Number(r.biaya) > 0) {
      await supabase.from("transactions").delete()
        .eq("business_id", businessId)
        .eq("user_id", userId)
        .eq("type", "pengeluaran")
        .eq("amount", r.biaya)
        .eq("transaction_date", r.tanggal)
        .ilike("description", "%Pertanian%");
    }
    router.refresh();
  };

  return (
    <div className="space-y-4">
      {!compact && (
      <>
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-2">
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className={`${inputCls} w-auto`} />
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className={`${inputCls} w-auto`} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportSprayingCSV(filtered)} className="flex items-center gap-1 px-3 py-2 rounded-xl border border-white/10 text-xs text-[#8B8AA0] hover:text-white"><Download size={13} /> CSV</button>
          <button type="button" onClick={() => exportSprayingExcel(filtered)} className="flex items-center gap-1 px-3 py-2 rounded-xl border border-white/10 text-xs text-[#8B8AA0] hover:text-white"><FileSpreadsheet size={13} /> Excel</button>
          <button type="button" onClick={() => exportSprayingPDF(filtered)} className="flex items-center gap-1 px-3 py-2 rounded-xl border border-white/10 text-xs text-[#8B8AA0] hover:text-white"><FileText size={13} /> PDF</button>
          <button type="button" onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white"><Plus size={14} /> Catat Semprot</button>
        </div>
      </div>

      {showForm && (
        <div className={`${cardCls} p-5 fade-up`}>
          <h3 className="text-sm font-semibold mb-4">Catat Penyemprotan</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className={inputCls} type="date" value={fTanggal} onChange={e => setFTanggal(e.target.value)} />
            <input className={inputCls} placeholder="Nama Produk *" value={fNama} onChange={e => setFNama(e.target.value)} />
            <select className={inputCls} value={fJenis} onChange={e => setFJenis(e.target.value)}>
              {SPRAYING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className={inputCls} placeholder="Dosis" value={fDosis} onChange={e => setFDosis(e.target.value)} />
            <input className={inputCls} type="number" placeholder="Luas Area (ha)" value={fLuas} onChange={e => setFLuas(e.target.value)} />
            <input className={inputCls} type="number" placeholder="Biaya (Rp)" value={fBiaya} onChange={e => setFBiaya(e.target.value)} />
            <input className={inputCls} placeholder="Operator" value={fOperator} onChange={e => setFOperator(e.target.value)} />
            <textarea className={inputCls} rows={2} placeholder="Catatan" value={fCatatan} onChange={e => setFCatatan(e.target.value)} />
          </div>
          <div className="flex gap-2 mt-4">
            <button type="button" onClick={handleSave} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Menyimpan..." : "Simpan"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl border border-white/10 text-sm text-[#8B8AA0]">Batal</button>
          </div>
        </div>
      )}
      </>
      )}

      <div className={`${cardCls} overflow-hidden`}>
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#8B8AA0]">{compact ? "Belum ada data. Buka tab Catat untuk tambah." : "Belum ada riwayat penyemprotan."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-white/[0.06] text-[#8B8AA0] text-xs">
                <th className="text-left p-3">Tanggal</th><th className="text-left p-3">Produk</th><th className="text-left p-3">Jenis</th>
                <th className="text-left p-3">Dosis</th><th className="text-left p-3">Luas</th><th className="text-right p-3">Biaya</th><th className="p-3"></th>
              </tr></thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="p-3">{new Date(r.tanggal).toLocaleDateString("id-ID")}</td>
                    <td className="p-3">{r.nama_produk}</td>
                    <td className="p-3 text-[#8B8AA0]">{r.jenis_produk}</td>
                    <td className="p-3 text-[#8B8AA0]">{r.dosis || "—"}</td>
                    <td className="p-3">{r.luas_area ? `${r.luas_area} ha` : "—"}</td>
                    <td className="p-3 text-right font-mono">{fmtRp(Number(r.biaya || 0))}</td>
                    <td className="p-3"><button type="button" onClick={() => handleDelete(r)} className="text-[#8B8AA0] hover:text-red-400"><Trash2 size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
