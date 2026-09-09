"use client";

import { useEffect, useState } from "react";
import { DEMO_FEE_RULES } from "@/lib/gercep-profit/demo";
import type { CalculationBase, FeeRuleInput } from "@/lib/gercep-profit/types";

const inputCls =
  "w-full rounded-xl border border-white/10 bg-[#0A0A12] px-3 py-2 text-sm text-[#F2F1F8] focus:border-[#D4AF37]/50 focus:outline-none";

export default function SettingsClient() {
  const [rules, setRules] = useState<FeeRuleInput[]>(DEMO_FEE_RULES);
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<FeeRuleInput>({
    platform: "TikTok Shop",
    fee_name: "Platform Fee",
    rate: 7.5,
    fixed_fee: 0,
    calculation_base: "NET_REVENUE",
    program_name: "Standard",
    effective_from: new Date().toISOString().slice(0, 10),
    effective_until: null,
    active: true,
  });

  useEffect(() => {
    fetch("/api/profit-engine/fee-rules")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.fee_rules)) setRules(d.fee_rules);
      })
      .catch(() => {});
  }, []);

  async function save() {
    setNote("");
    const res = await fetch("/api/profit-engine/fee-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await res.json();
    if (!res.ok) {
      setNote(data.error || "Gagal menyimpan. Pastikan migration sudah dijalankan.");
      return;
    }
    setNote(data.note || "Fee rule baru disimpan. Rule lama tidak di-overwrite.");
    const list = await fetch("/api/profit-engine/fee-rules").then((r) => r.json());
    if (Array.isArray(list.fee_rules)) setRules(list.fee_rules);
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-[#8B8AA0]">
        Fee tidak di-hardcode. Setiap perubahan membuat versi baru (`effective_from` / `effective_until`)
        supaya order lama tetap memakai tarif pada tanggal order.
      </p>

      <div className="overflow-x-auto rounded-2xl border border-white/[0.07] bg-[#101018]">
        <table className="min-w-full text-left text-xs">
          <thead className="text-[10px] uppercase tracking-[0.12em] text-[#6B6A85]">
            <tr>
              {["Platform", "Fee", "Rate", "Fixed", "Base", "From", "Until", "Active"].map((h) => (
                <th key={h} className="px-3 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={`${r.id || r.fee_name}-${r.effective_from}`} className="border-t border-white/[0.05]">
                <td className="px-3 py-3">{r.platform}</td>
                <td className="px-3 py-3">{r.fee_name}</td>
                <td className="px-3 py-3 font-mono">{r.rate}%</td>
                <td className="px-3 py-3 font-mono">{r.fixed_fee}</td>
                <td className="px-3 py-3">{r.calculation_base}</td>
                <td className="px-3 py-3 font-mono">{r.effective_from}</td>
                <td className="px-3 py-3 font-mono">{r.effective_until || "onward"}</td>
                <td className="px-3 py-3">{r.active ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-white/[0.07] bg-[#101018] p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#7A7998]">New fee version</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-[#8B8AA0]">
            Platform
            <input className={`${inputCls} mt-1`} value={draft.platform} onChange={(e) => setDraft({ ...draft, platform: e.target.value })} />
          </label>
          <label className="text-xs text-[#8B8AA0]">
            Fee name
            <input className={`${inputCls} mt-1`} value={draft.fee_name} onChange={(e) => setDraft({ ...draft, fee_name: e.target.value })} />
          </label>
          <label className="text-xs text-[#8B8AA0]">
            Rate %
            <input className={`${inputCls} mt-1`} type="number" value={draft.rate} onChange={(e) => setDraft({ ...draft, rate: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-[#8B8AA0]">
            Fixed fee
            <input className={`${inputCls} mt-1`} type="number" value={draft.fixed_fee} onChange={(e) => setDraft({ ...draft, fixed_fee: Number(e.target.value) })} />
          </label>
          <label className="text-xs text-[#8B8AA0]">
            Calculation base
            <select
              className={`${inputCls} mt-1`}
              value={draft.calculation_base}
              onChange={(e) => setDraft({ ...draft, calculation_base: e.target.value as CalculationBase })}
            >
              <option value="GROSS_REVENUE">Gross Revenue</option>
              <option value="NET_REVENUE">Net Revenue</option>
              <option value="ITEM_REVENUE">Item Revenue</option>
              <option value="SHIPPING_REVENUE">Shipping Revenue</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="text-xs text-[#8B8AA0]">
            Effective from
            <input className={`${inputCls} mt-1`} type="date" value={draft.effective_from} onChange={(e) => setDraft({ ...draft, effective_from: e.target.value })} />
          </label>
        </div>
        <button
          type="button"
          onClick={save}
          className="mt-4 rounded-xl bg-gradient-to-r from-[#D4AF37] to-[#F5D76E] px-4 py-2.5 text-sm font-semibold text-[#1A1408]"
        >
          Simpan versi fee baru
        </button>
        {note ? <p className="mt-3 text-xs text-[#F5D76E]">{note}</p> : null}
      </div>
    </div>
  );
}
