"use client";
import { useState, useMemo } from "react";
import { Calculator, TrendingUp, Target, AlertCircle } from "lucide-react";

const BTN_GRAD = { background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" } as const;
const inputCls = "w-full px-3 py-2.5 rounded-xl bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50 text-sm";

function fmt(n: number) {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

export default function SmartProfitClient({ businessName, businessType }: { businessName: string; businessType: string | null }) {
  const [modal, setModal] = useState("5000000");
  const [biayaOps, setBiayaOps] = useState("1500000");
  const [hargaJual, setHargaJual] = useState("75000");
  const [hppUnit, setHppUnit] = useState("45000");
  const [targetProfit, setTargetProfit] = useState("2000000");

  const calc = useMemo(() => {
    const m = Number(modal) || 0;
    const ops = Number(biayaOps) || 0;
    const hj = Number(hargaJual) || 0;
    const hpp = Number(hppUnit) || 0;
    const target = Number(targetProfit) || 0;
    const marginUnit = hj > 0 ? ((hj - hpp) / hj) * 100 : 0;
    const labaUnit = hj - hpp;
    const totalFixed = m + ops;
    const breakEvenQty = labaUnit > 0 ? Math.ceil(totalFixed / labaUnit) : 0;
    const breakEvenRevenue = breakEvenQty * hj;
    const qtyForTarget = labaUnit > 0 ? Math.ceil((totalFixed + target) / labaUnit) : 0;
    return { marginUnit, labaUnit, totalFixed, breakEvenQty, breakEvenRevenue, qtyForTarget };
  }, [modal, biayaOps, hargaJual, hppUnit, targetProfit]);

  const typeHint: Record<string, string> = {
    kuliner: "Isi HPP dari resep menu di Master Menu.",
    homeindustry: "HPP otomatis dari resep Produksi.",
    pertanian: "HPP/unit dari biaya produksi ÷ stok panen.",
    ternak: "Modal batch + pakan ÷ ekor terjual.",
  };

  return (
    <div className="px-4 sm:px-8 py-4 sm:py-8 max-w-3xl mx-auto pb-12">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <Calculator size={22} className="text-[#2DD4BF]" />
          <h1 className="text-2xl font-semibold">Smart Profit Calculator</h1>
        </div>
        <p className="text-sm text-[#8B8AA0]">{businessName}{businessType ? ` · ${businessType}` : ""}</p>
        {businessType && typeHint[businessType] && (
          <p className="mt-2 text-xs text-[#5A5B7A] rounded-xl border border-white/[0.06] px-3 py-2" style={{ background: "#0D0D1A" }}>
            💡 {typeHint[businessType]}
          </p>
        )}
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <label className="block">
          <span className="text-xs text-[#8B8AA0] mb-1 block">Modal / investasi awal (Rp)</span>
          <input className={inputCls} type="number" value={modal} onChange={e => setModal(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs text-[#8B8AA0] mb-1 block">Biaya operasional bulanan (Rp)</span>
          <input className={inputCls} type="number" value={biayaOps} onChange={e => setBiayaOps(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs text-[#8B8AA0] mb-1 block">Harga jual per unit (Rp)</span>
          <input className={inputCls} type="number" value={hargaJual} onChange={e => setHargaJual(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs text-[#8B8AA0] mb-1 block">HPP per unit (Rp)</span>
          <input className={inputCls} type="number" value={hppUnit} onChange={e => setHppUnit(e.target.value)} />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs text-[#8B8AA0] mb-1 block">Target profit bersih (Rp)</span>
          <input className={inputCls} type="number" value={targetProfit} onChange={e => setTargetProfit(e.target.value)} />
        </label>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
          <TrendingUp size={18} className="text-[#2DD4BF] mb-2" />
          <p className="text-xs text-[#8B8AA0] mb-1">Margin per unit</p>
          <p className="text-2xl font-mono font-semibold" style={{ color: calc.marginUnit >= 0 ? "#2DD4BF" : "#EC4899" }}>
            {calc.marginUnit.toFixed(1)}%
          </p>
          <p className="text-xs text-[#5A5B7A] mt-1">Laba/unit: {fmt(calc.labaUnit)}</p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
          <Target size={18} className="text-[#8B5CF6] mb-2" />
          <p className="text-xs text-[#8B8AA0] mb-1">Break-even point</p>
          <p className="text-2xl font-mono font-semibold text-[#F0EFF8]">{calc.breakEvenQty} unit</p>
          <p className="text-xs text-[#5A5B7A] mt-1">Omzet BEP: {fmt(calc.breakEvenRevenue)}</p>
        </div>
      </div>

      <div className={`rounded-2xl border p-5 mb-6 ${calc.labaUnit <= 0 ? "border-[#EC4899]/30 bg-[#EC4899]/5" : "border-[#2DD4BF]/30 bg-[#2DD4BF]/5"}`}>
        {calc.labaUnit <= 0 ? (
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="text-[#EC4899] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#EC4899]">HPP ≥ harga jual — naikkan harga atau turunkan biaya dulu.</p>
          </div>
        ) : (
          <>
            <p className="text-sm font-medium text-[#F0EFF8] mb-1">Untuk profit {fmt(Number(targetProfit) || 0)}</p>
            <p className="text-3xl font-mono font-bold text-[#2DD4BF]">{calc.qtyForTarget} unit</p>
            <p className="text-xs text-[#5A5B7A] mt-2">Total biaya tetap: {fmt(calc.totalFixed)} (modal + ops)</p>
          </>
        )}
      </div>

      <p className="text-[10px] text-[#5A5B7A] text-center">
        Kalkulator simulasi — data riil dari modul bisnis kamu otomatis masuk Keuangan & Owner Dashboard.
      </p>
    </div>
  );
}
