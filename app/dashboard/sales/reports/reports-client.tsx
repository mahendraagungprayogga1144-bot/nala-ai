"use client";
import { useState } from "react";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../../components/module-form-styles";
import { fmtRp } from "@/lib/henima-sales/money";

type Report = {
  range: { label: string };
  totalOrders: number;
  totalQty: number;
  totalRevenue: number;
  aov: number;
  newCustomers: number;
  repeatCustomers: number;
  totalCommission: number;
  byProduct: { name: string; qty: number; omzet: number }[];
  ranking: { salesId: string; nama: string; qty: number; revenue: number; count: number }[];
  servedBy?: { salesId: string; nama: string; qty: number; revenue: number; count: number }[];
  byPay: Record<string, number>;
};

export default function ReportsClient({ initial }: { initial: Report }) {
  const [kind, setKind] = useState("this_month");
  const [rankBy, setRankBy] = useState("quantity");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const qs = new URLSearchParams({ kind, rankBy });
    if (kind === "custom") {
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
    }
    const res = await fetch("/api/reports/sales?" + qs.toString());
    const json = await res.json();
    if (res.ok) setData(json);
    setLoading(false);
  };

  const download = async (format: "pdf" | "csv") => {
    const res = await fetch("/api/reports/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, from, to, rankBy, format }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = format === "csv" ? "henima-laporan.csv" : "henima-laporan.pdf";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <select className={MODULE_INPUT + " max-w-[180px]"} value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="this_week">This week</option>
          <option value="last_week">Last week</option>
          <option value="this_month">This month</option>
          <option value="last_month">Last month</option>
          <option value="custom">Custom</option>
        </select>
        <select className={MODULE_INPUT + " max-w-[160px]"} value={rankBy} onChange={(e) => setRankBy(e.target.value)}>
          <option value="quantity">Rank: pcs</option>
          <option value="revenue">Rank: omzet</option>
          <option value="count">Rank: trx</option>
        </select>
        {kind === "custom" && (
          <>
            <input type="date" className={MODULE_INPUT + " max-w-[160px]"} value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" className={MODULE_INPUT + " max-w-[160px]"} value={to} onChange={(e) => setTo(e.target.value)} />
          </>
        )}
        <button type="button" onClick={load} disabled={loading} className={MODULE_BTN}>
          Terapkan
        </button>
        <button type="button" onClick={() => download("pdf")} className={MODULE_BTN}>
          PDF
        </button>
        <button type="button" onClick={() => download("csv")} className={MODULE_BTN}>
          CSV
        </button>
      </div>
      <p className="mb-4 text-sm text-[#8B8AA0]">{data.range.label}</p>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Total Orders", String(data.totalOrders)],
          ["Total Quantity", String(data.totalQty)],
          ["Total Revenue", fmtRp(data.totalRevenue)],
          ["AOV", fmtRp(data.aov)],
          ["New Customers", String(data.newCustomers)],
          ["Repeat Customers", String(data.repeatCustomers)],
          ["Total Commission", fmtRp(data.totalCommission)],
        ].map(([l, v]) => (
          <div key={l} className={MODULE_CARD}>
            <p className="text-[10px] uppercase text-[#8B8AA0]">{l}</p>
            <p className="font-mono text-sm font-semibold">{v}</p>
          </div>
        ))}
      </div>
      <div className={MODULE_CARD + " mb-4"}>
        <h3 className="mb-2 text-sm font-semibold">Ranking sales</h3>
        {data.ranking.length === 0 ? (
          <p className="text-sm text-[#8B8AA0]">
            {(data.servedBy || []).length
              ? `Dilayani oleh ${(data.servedBy || []).map((s) => s.nama).join(", ")}`
              : "Belum ada penjualan sales pada periode ini."}
          </p>
        ) : (
          data.ranking.map((s, i) => (
            <p key={s.salesId} className="flex justify-between text-sm">
              <span>{i + 1}. {s.nama}</span>
              <span className="font-mono">{s.qty} pcs · {fmtRp(s.revenue)}</span>
            </p>
          ))
        )}
        {(data.servedBy || []).length > 0 && data.ranking.length > 0 && (
          <p className="mt-2 text-sm text-[#8B8AA0]">
            Dilayani oleh {(data.servedBy || []).map((s) => s.nama).join(", ")}
          </p>
        )}
      </div>
      <div className={MODULE_CARD}>
        <h3 className="mb-2 text-sm font-semibold">Produk</h3>
        {data.byProduct.map((p) => (
          <p key={p.name} className="flex justify-between text-sm">
            <span>{p.name}</span>
            <span className="font-mono">{p.qty} pcs · {fmtRp(p.omzet)}</span>
          </p>
        ))}
      </div>
    </>
  );
}
