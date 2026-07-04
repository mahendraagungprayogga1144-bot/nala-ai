"use client";
import { useState, useMemo } from "react";
import { Calculator } from "lucide-react";
import type { MpParsedOrder } from "../page";

const PLATFORMS = [
  { id: "Shopee", label: "Shopee", color: "#F97316", feePct: 0.05 },
  { id: "TikTok Shop", label: "TikTok Shop", color: "#EC4899", feePct: 0.045 },
  { id: "Tokopedia", label: "Tokopedia", color: "#22C55E", feePct: 0.04 },
] as const;

function fmtRp(n: number) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }
function roundUp(n: number, step = 500) { return Math.ceil(n / step) * step; }

export default function MpPriceCalculator({
  parsedOrders,
}: { parsedOrders: MpParsedOrder[] }) {
  const [hpp, setHpp] = useState("");
  const [packaging, setPackaging] = useState("");
  const [adBudget, setAdBudget] = useState("");
  const [estOrders, setEstOrders] = useState("100");
  const [targetMargin, setTargetMargin] = useState("30");

  const hppN = Number(hpp) || 0;
  const packN = Number(packaging) || 0;
  const adN = Number(adBudget) || 0;
  const ordN = Number(estOrders) || 1;
  const marginN = Number(targetMargin) / 100 || 0.3;
  const adPerUnit = adN / ordN;
  const totalModal = hppN + packN + adPerUnit;

  const results = useMemo(() => {
    return PLATFORMS.map(p => {
      const bep = totalModal > 0 ? totalModal / (1 - p.feePct) : 0;
      const idealRaw = totalModal > 0 ? totalModal / (1 - p.feePct - marginN) : 0;
      const ideal = roundUp(idealRaw);
      const feeAmount = ideal * p.feePct;
      const profitPerUnit = ideal - totalModal - feeAmount;
      const profitTotal = profitPerUnit * ordN;

      return {
        ...p,
        bep: roundUp(bep),
        idealRaw,
        ideal,
        feeAmount,
        profitPerUnit,
        profitTotal,
      };
    });
  }, [totalModal, marginN, ordN]);

  const marginWarnings = useMemo(() => {
    if (parsedOrders.length === 0 || totalModal === 0) return [];
    const prodMap: Record<string, { nama: string; avgDana: number; count: number }> = {};
    parsedOrders.forEach(o => {
      const key = o.nama_produk || "Unknown";
      if (!prodMap[key]) prodMap[key] = { nama: key, avgDana: 0, count: 0 };
      prodMap[key].avgDana += Number(o.dana_diterima);
      prodMap[key].count++;
    });
    return Object.values(prodMap)
      .map(p => ({ ...p, avgDana: p.avgDana / p.count }))
      .filter(p => p.avgDana < totalModal)
      .sort((a, b) => a.avgDana - b.avgDana)
      .slice(0, 5);
  }, [parsedOrders, totalModal]);

  const inputCls = "w-full rounded-xl border border-white/[0.08] bg-[#0A0A12] px-3 py-2.5 text-sm text-[#F0EFF8] outline-none focus:border-[#2DD4BF]/40 transition-colors";

  return (
    <div>
      <div className="mb-5 flex items-center gap-2">
        <Calculator size={18} className="text-[#2DD4BF]" />
        <h2 className="text-sm font-semibold" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>Kalkulator Harga Ideal</h2>
      </div>

      {/* Input form */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-[#8B8AA0]">HPP per unit (Rp)</label>
          <input className={inputCls} type="number" placeholder="15000" value={hpp} onChange={e => setHpp(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-[#8B8AA0]">Biaya Packaging (Rp)</label>
          <input className={inputCls} type="number" placeholder="2000" value={packaging} onChange={e => setPackaging(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-[#8B8AA0]">Budget Iklan / bulan (Rp)</label>
          <input className={inputCls} type="number" placeholder="150000" value={adBudget} onChange={e => setAdBudget(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-[#8B8AA0]">Estimasi Order / bulan</label>
          <input className={inputCls} type="number" placeholder="100" value={estOrders} onChange={e => setEstOrders(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-[10px] uppercase tracking-wide text-[#8B8AA0]">Target Margin (%)</label>
          <input className={inputCls} type="number" placeholder="30" value={targetMargin} onChange={e => setTargetMargin(e.target.value)} />
        </div>
        <div className="flex flex-col justify-end">
          <div className="rounded-xl border border-[#2DD4BF]/20 bg-[#2DD4BF]/5 p-2.5 text-xs">
            <p className="text-[#8B8AA0]">Total Modal / unit</p>
            <p className="font-bold text-[#2DD4BF]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtRp(totalModal)}</p>
            {adPerUnit > 0 && <p className="text-[10px] text-[#5A5B7A]">Iklan/unit: {fmtRp(adPerUnit)}</p>}
          </div>
        </div>
      </div>

      {/* Results — 3 platform columns */}
      {totalModal > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {results.map(r => {
            const profitColor = r.profitPerUnit > 0 ? "#4ADE80" : r.profitPerUnit === 0 ? "#FBBF24" : "#F43F5E";
            return (
              <div key={r.id} className="rounded-2xl border p-5" style={{ borderColor: r.color + "33", background: "#0D0D1A" }}>
                <div className="mb-4 flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full" style={{ background: r.color }} />
                  <p className="text-sm font-semibold" style={{ color: r.color }}>{r.label}</p>
                  <span className="ml-auto rounded-full border px-2 py-0.5 text-[9px] font-medium" style={{ borderColor: r.color + "44", color: r.color }}>
                    Fee {(r.feePct * 100).toFixed(1)}%
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[#8B8AA0]">Harga BEP</p>
                    <p className="text-lg font-bold text-[#FBBF24]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{fmtRp(r.bep)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-[#8B8AA0]">Harga Ideal (margin {targetMargin}%)</p>
                    <p className="text-xl font-bold" style={{ color: profitColor, fontFamily: "'JetBrains Mono', monospace" }}>{fmtRp(r.ideal)}</p>
                  </div>
                  <div className="rounded-xl border border-white/[0.06] bg-[#0A0A12]/60 p-3 text-xs">
                    <div className="flex justify-between mb-1"><span className="text-[#8B8AA0]">Fee platform</span><span className="text-[#F43F5E]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>-{fmtRp(r.feeAmount)}</span></div>
                    <div className="flex justify-between mb-1"><span className="text-[#8B8AA0]">Profit / unit</span><span style={{ color: profitColor, fontFamily: "'JetBrains Mono', monospace" }}>{fmtRp(r.profitPerUnit)}</span></div>
                    <div className="flex justify-between border-t border-white/[0.06] pt-1 mt-1"><span className="text-[#8B8AA0]">Profit {ordN} order</span><span className="font-bold" style={{ color: profitColor, fontFamily: "'JetBrains Mono', monospace" }}>{fmtRp(r.profitTotal)}</span></div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Margin warnings from CSV data */}
      {marginWarnings.length > 0 && (
        <div className="mt-6 rounded-2xl border border-[#F43F5E]/30 bg-[#F43F5E]/5 p-4">
          <p className="mb-2 text-xs font-semibold text-[#F43F5E]">⚠ Produk dengan margin minus (dari data CSV)</p>
          <div className="space-y-1">
            {marginWarnings.map(w => (
              <div key={w.nama} className="flex items-center justify-between text-xs">
                <span className="truncate max-w-[200px] text-[#8B8AA0]">{w.nama}</span>
                <span className="text-[#F43F5E]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  Dana: {fmtRp(w.avgDana)} &lt; Modal: {fmtRp(totalModal)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
