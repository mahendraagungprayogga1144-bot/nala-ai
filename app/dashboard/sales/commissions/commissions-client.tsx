"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../../components/module-form-styles";
import { todayWib } from "@/lib/date";
import { fmtRp } from "@/lib/henima-sales/money";

export default function CommissionsClient({
  total,
  rows,
  canEdit,
}: {
  total: number;
  rows: { id: string; amount: number; role: string; sales_id: string }[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    role: "SALES",
    percentage: "5",
    fixedAmount: "0",
    effectiveFrom: todayWib(),
  });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/sales/commissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: form.role,
        percentage: Number(form.percentage),
        fixedAmount: Number(form.fixedAmount),
        effectiveFrom: form.effectiveFrom,
      }),
    });
    router.refresh();
  };
  return (
    <>
      <div className={MODULE_CARD + " mb-6"}>
        <p className="text-xs text-[#8B8AA0]">Total komisi periode</p>
        <p className="font-mono text-2xl text-[#F59E0B]">{fmtRp(total)}</p>
      </div>
      {canEdit && (
        <form onSubmit={save} className={MODULE_CARD + " mb-6 grid gap-3 sm:grid-cols-2"}>
          <select className={MODULE_INPUT} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="SALES">SALES</option>
            <option value="LEADER">LEADER</option>
          </select>
          <input className={MODULE_INPUT} placeholder="% komisi" value={form.percentage} onChange={(e) => setForm({ ...form, percentage: e.target.value })} />
          <input className={MODULE_INPUT} placeholder="Nominal tetap" value={form.fixedAmount} onChange={(e) => setForm({ ...form, fixedAmount: e.target.value })} />
          <input className={MODULE_INPUT} type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
          <button className={MODULE_BTN + " sm:col-span-2"}>Simpan aturan komisi</button>
        </form>
      )}
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.id} className={MODULE_CARD + " flex justify-between text-sm"}>
            <span>{r.role}</span>
            <span className="font-mono text-[#F59E0B]">{fmtRp(r.amount)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
