"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../../components/module-form-styles";
import { todayWib } from "@/lib/date";

type Target = {
  id: string;
  period_type: string;
  quantity_target: number;
  sales_id: string | null;
  effective_from: string;
};

export default function TargetsClient({
  targets,
  staff,
  canEdit,
  daily,
  weekly,
  monthly,
}: {
  targets: Target[];
  staff: { id: string; nama: string }[];
  canEdit: boolean;
  daily: { sold: number; target: number; achievement: number; remaining: number };
  weekly: { sold: number; target: number; achievement: number; remaining: number };
  monthly: { sold: number; target: number; achievement: number; remaining: number; omzet: number };
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    periodType: "monthly",
    quantityTarget: "60",
    salesId: "",
    effectiveFrom: todayWib(),
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/sales/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        quantityTarget: Number(form.quantityTarget),
        salesId: form.salesId || null,
      }),
    });
    router.refresh();
  };

  const card = (title: string, a: { sold: number; target: number; achievement: number; remaining: number }) => (
    <div className={MODULE_CARD}>
      <p className="text-xs text-[#8B8AA0]">{title}</p>
      <p className="mt-1 text-lg font-semibold">
        {a.sold} / {a.target} pcs
      </p>
      <p className="text-sm text-[#2DD4BF]">{a.achievement}% · sisa {a.remaining}</p>
    </div>
  );

  return (
    <>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {card("Harian", daily)}
        {card("Mingguan", weekly)}
        {card("Bulanan", monthly)}
      </div>
      {canEdit && (
        <form onSubmit={save} className={MODULE_CARD + " mb-6 grid gap-3 sm:grid-cols-2"}>
          <select className={MODULE_INPUT} value={form.periodType} onChange={(e) => setForm({ ...form, periodType: e.target.value })}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <input className={MODULE_INPUT} type="number" value={form.quantityTarget} onChange={(e) => setForm({ ...form, quantityTarget: e.target.value })} />
          <select className={MODULE_INPUT} value={form.salesId} onChange={(e) => setForm({ ...form, salesId: e.target.value })}>
            <option value="">Semua sales (default bisnis)</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.nama}</option>
            ))}
          </select>
          <input className={MODULE_INPUT} type="date" value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} />
          <button className={MODULE_BTN + " sm:col-span-2"}>Simpan target</button>
        </form>
      )}
      <div className="space-y-2">
        {targets.map((t) => (
          <div key={t.id} className={MODULE_CARD + " text-sm"}>
            {t.period_type} · {t.quantity_target} pcs · mulai {t.effective_from}
          </div>
        ))}
      </div>
    </>
  );
}
