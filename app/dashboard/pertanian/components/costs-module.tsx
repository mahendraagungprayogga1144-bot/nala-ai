"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2 } from "lucide-react";
import type { ProductionCost } from "../lib/types";
import { COST_CATEGORIES, inputCls, cardCls, fmtRp } from "../lib/constants";
import { insertKeuanganPengeluaran } from "../lib/agri-sync";
import { todayWib } from "@/lib/date";
import { computeHPP } from "../lib/ai-insights";
import type { AgriDashboardData } from "../lib/types";

type Props = { costs: ProductionCost[]; userId: string; businessId: string; dashboardData: AgriDashboardData; compact?: boolean };

export default function CostsModule({ costs, userId, businessId, dashboardData, compact }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fTanggal, setFTanggal] = useState(todayWib());
  const [fKategori, setFKategori] = useState(COST_CATEGORIES[0]);
  const [fDeskripsi, setFDeskripsi] = useState("");
  const [fJumlah, setFJumlah] = useState("");

  const { totalCost, hpp, margin, roi, panenValue } = computeHPP(dashboardData);

  const handleSave = async () => {
    if (!fJumlah) return;
    setLoading(true);
    await supabase.from("agri_production_costs").insert({
      user_id: userId, business_id: businessId, tanggal: fTanggal,
      kategori: fKategori, deskripsi: fDeskripsi || null, jumlah: Number(fJumlah),
    });
    await insertKeuanganPengeluaran(supabase, {
      userId, businessId,
      category: fKategori,
      description: `Biaya ${fKategori}${fDeskripsi ? ": " + fDeskripsi : ""} — Pertanian`,
      amount: Number(fJumlah),
      tanggal: fTanggal,
    });
    setLoading(false); setFDeskripsi(""); setFJumlah(""); setShowForm(false);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus biaya?")) return;
    await supabase.from("agri_production_costs").delete().eq("id", id);
    router.refresh();
  };

  const byCat: Record<string, number> = {};
  costs.forEach(c => { byCat[c.kategori] = (byCat[c.kategori] || 0) + Number(c.jumlah); });

  return (
    <div className="space-y-4">
      {!compact && (
      <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Biaya", value: fmtRp(totalCost), color: "text-red-400" },
          { label: "HPP / unit", value: fmtRp(hpp), color: "text-amber-400" },
          { label: "Margin", value: `${margin.toFixed(1)}%`, color: margin >= 0 ? "text-emerald-400" : "text-red-400" },
          { label: "ROI", value: `${roi.toFixed(1)}%`, color: roi >= 0 ? "text-violet-400" : "text-red-400" },
        ].map(k => (
          <div key={k.label} className={`${cardCls} p-4`}>
            <p className="text-[10px] text-[#8B8AA0] mb-1">{k.label}</p>
            <p className={`text-lg font-semibold font-mono ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <p className="text-xs text-[#8B8AA0]">Nilai panen: {fmtRp(panenValue)} · Gercep menghitung HPP, margin, dan ROI dari biaya + saprotan + penyemprotan.</p>

      <div className="flex justify-end">
        <button type="button" onClick={() => setShowForm(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white">
          <Plus size={14} /> Catat Biaya
        </button>
      </div>

      {showForm && (
        <div className={`${cardCls} p-5 fade-up`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className={inputCls} type="date" value={fTanggal} onChange={e => setFTanggal(e.target.value)} />
            <select className={inputCls} value={fKategori} onChange={e => setFKategori(e.target.value)}>
              {COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className={inputCls} placeholder="Deskripsi" value={fDeskripsi} onChange={e => setFDeskripsi(e.target.value)} />
            <input className={inputCls} type="number" placeholder="Jumlah (Rp) *" value={fJumlah} onChange={e => setFJumlah(e.target.value)} />
          </div>
          <div className="flex gap-2 mt-4">
            <button type="button" onClick={handleSave} disabled={loading} className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-sm font-semibold text-white disabled:opacity-50">{loading ? "Menyimpan..." : "Simpan"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl border border-white/10 text-sm text-[#8B8AA0]">Batal</button>
          </div>
        </div>
      )}
      </>
      )}

      <div className={compact ? "space-y-2" : "grid sm:grid-cols-2 gap-4"}>
        {!compact && (
        <div className={`${cardCls} p-4`}>
          <h4 className="text-xs font-semibold text-[#8B8AA0] mb-3 uppercase tracking-wide">Per Kategori</h4>
          {Object.keys(byCat).length === 0 ? <p className="text-sm text-[#5A5B7A]">Belum ada data</p> : (
            <ul className="space-y-2">{Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
              <li key={cat} className="flex justify-between text-sm"><span>{cat}</span><span className="font-mono">{fmtRp(amt)}</span></li>
            ))}</ul>
          )}
        </div>
        )}
        <div className={`${cardCls} overflow-hidden`}>
          {costs.length === 0 ? <p className="p-6 text-sm text-[#8B8AA0]">{compact ? "Belum ada data. Buka tab Catat untuk tambah." : "Belum ada catatan biaya."}</p> : (
            <div className="divide-y divide-white/[0.06] max-h-64 overflow-y-auto">
              {costs.map(c => (
                <div key={c.id} className="flex items-center gap-2 p-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{c.kategori} — {c.deskripsi || "—"}</p>
                    <p className="text-[10px] text-[#8B8AA0]">{new Date(c.tanggal).toLocaleDateString("id-ID")}</p>
                  </div>
                  <span className="font-mono text-red-300">{fmtRp(Number(c.jumlah))}</span>
                  <button type="button" onClick={() => handleDelete(c.id)} className="text-[#8B8AA0] hover:text-red-400"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
