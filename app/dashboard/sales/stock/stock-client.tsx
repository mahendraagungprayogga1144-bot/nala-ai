"use client";

import { useState } from "react";
import { MODULE_INPUT } from "../../components/module-form-styles";

type Product = { id: string; name: string; stock: number };
type Staff = { id: string; nama: string };
type Hand = {
  salesId: string;
  salesName: string;
  productId: string;
  productName: string;
  qty: number;
  warehouseStock: number;
};
type Issue = {
  id: string;
  salesName: string;
  productName: string;
  qty: number;
  direction: "issue" | "return";
  note: string | null;
  createdAt: string;
};

const LIGHT = {
  card: "rounded-2xl border border-[#E8E8E4] bg-white p-4 shadow-[0_8px_24px_rgba(17,17,17,0.04)]",
  title: "text-sm font-bold text-[#111]",
  muted: "text-xs text-[#6B6B6B]",
  label: "text-xs font-semibold text-[#6B6B6B]",
  row: "rounded-xl border border-[#E8E8E4] px-3 py-2.5",
  name: "text-sm font-semibold text-[#111]",
  accent: "#C5A358",
  input: "mt-1 w-full rounded-xl border border-[#E8E8E4] bg-[#FAFAF8] px-3 py-2.5 text-sm text-[#111]",
  primaryBtn: "rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-40",
  ghostBtn: "rounded-xl border border-[#E8E8E4] px-4 py-2 text-sm font-bold text-[#111] disabled:opacity-40",
  err: "mt-2 text-sm text-rose-600",
  ok: "mt-2 text-sm text-emerald-700",
};

const DARK = {
  card: "rounded-2xl border border-white/10 bg-white/[0.03] p-4",
  title: "text-sm font-bold text-[#F0EFF8]",
  muted: "text-xs text-[#8B8AA0]",
  label: "text-xs font-semibold text-[#8B8AA0]",
  row: "rounded-xl border border-white/10 px-3 py-2.5",
  name: "text-sm font-semibold text-[#F0EFF8]",
  accent: "#2DD4BF",
  input: `${MODULE_INPUT} mt-1`,
  primaryBtn: "rounded-xl bg-[#2DD4BF] px-4 py-2 text-sm font-bold text-[#0B0B12] disabled:opacity-40",
  ghostBtn: "rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-[#F0EFF8] disabled:opacity-40",
  err: "mt-2 text-sm text-rose-400",
  ok: "mt-2 text-sm text-emerald-400",
};

export default function StockClient({
  canEdit,
  hand: initialHand,
  issues: initialIssues,
  products,
  staff,
  variant = "dark",
}: {
  canEdit: boolean;
  hand: Hand[];
  issues: Issue[];
  products: Product[];
  staff: Staff[];
  variant?: "dark" | "light";
}) {
  const ui = variant === "light" ? LIGHT : DARK;
  const [hand, setHand] = useState(initialHand);
  const [issues, setIssues] = useState(initialIssues);
  const [warehouse, setWarehouse] = useState(products);
  const [salesId, setSalesId] = useState(staff[0]?.id || "");
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [qty, setQty] = useState("5");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  async function submit(action: "issue" | "return") {
    setBusy(true);
    setError("");
    setOkMsg("");
    try {
      const res = await fetch("/api/sales/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          salesId,
          productId,
          qty: Number(qty),
          note: note.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan.");
      setHand(json.hand || []);
      setIssues(json.issues || []);
      if (json.result?.warehouseStock != null) {
        setWarehouse((prev) =>
          prev.map((p) =>
            p.id === productId ? { ...p, stock: Number(json.result.warehouseStock) } : p,
          ),
        );
      }
      setOkMsg(
        action === "issue"
          ? `Ambil ${qty} pcs ke tangan sales. Gudang sisa ${json.result?.warehouseStock ?? "—"}.`
          : `Kembali ${qty} pcs ke gudang. Gudang sekarang ${json.result?.warehouseStock ?? "—"}.`,
      );
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className={ui.card}>
        <h2 className={ui.title}>Stok gudang</h2>
        <p className={`mt-1 ${ui.muted}`}>Ini stok di gudang. Berkurang saat sales ambil barang.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {warehouse.map((p) => (
            <li key={p.id} className={ui.row}>
              <p className={ui.name}>{p.name}</p>
              <p className={ui.muted}>
                Gudang:{" "}
                <span className="font-bold" style={{ color: ui.accent }}>
                  {p.stock} pcs
                </span>
              </p>
            </li>
          ))}
          {!warehouse.length && <p className={`text-sm ${ui.muted.replace("text-xs ", "")}`}>Belum ada produk katalog.</p>}
        </ul>
      </section>

      {canEdit ? (
        <section className={ui.card}>
          <h2 className={ui.title}>Ambil / kembalikan</h2>
          <p className={`mt-1 ${ui.muted}`}>
            Contoh: stok di tangan 2, ambil 5 dari gudang → di tangan jadi 7. Saat jual, stok di tangan yang berkurang.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className={ui.label}>
              Sales
              <select className={ui.input} value={salesId} onChange={(e) => setSalesId(e.target.value)}>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama}
                  </option>
                ))}
              </select>
            </label>
            <label className={ui.label}>
              Produk
              <select className={ui.input} value={productId} onChange={(e) => setProductId(e.target.value)}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (gudang {warehouse.find((w) => w.id === p.id)?.stock ?? p.stock})
                  </option>
                ))}
              </select>
            </label>
            <label className={ui.label}>
              Jumlah
              <input
                className={ui.input}
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </label>
            <label className={ui.label}>
              Catatan
              <input
                className={ui.input}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Opsional"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !salesId || !productId}
              onClick={() => void submit("issue")}
              className={ui.primaryBtn}
              style={variant === "light" ? { background: ui.accent } : undefined}
            >
              {busy ? "Menyimpan…" : "Ambil dari gudang"}
            </button>
            <button
              type="button"
              disabled={busy || !salesId || !productId}
              onClick={() => void submit("return")}
              className={ui.ghostBtn}
            >
              Kembalikan ke gudang
            </button>
          </div>
          {error ? <p className={ui.err}>{error}</p> : null}
          {okMsg ? <p className={ui.ok}>{okMsg}</p> : null}
        </section>
      ) : (
        <p className={`${ui.row} text-sm ${ui.muted.replace("text-xs ", "")}`}>
          Sales hanya melihat stok di tangan. Minta owner/leader mencatat ambil gudang.
        </p>
      )}

      <section className={ui.card}>
        <h2 className={ui.title}>Stok di tangan sales</h2>
        <ul className="mt-3 space-y-2">
          {hand.map((row) => (
            <li key={`${row.salesId}-${row.productId}`} className={`flex flex-wrap items-center justify-between gap-2 ${ui.row}`}>
              <div>
                <p className={ui.name}>
                  {row.salesName} · {row.productName}
                </p>
                <p className={ui.muted}>Gudang sisa {row.warehouseStock} pcs</p>
              </div>
              <p className="text-lg font-bold tabular-nums" style={{ color: ui.accent }}>
                {row.qty} pcs
              </p>
            </li>
          ))}
          {!hand.length && (
            <p className={`text-sm ${ui.muted.replace("text-xs ", "")}`}>
              Belum ada barang di tangan. Catat ambil dari gudang dulu.
            </p>
          )}
        </ul>
      </section>

      {canEdit ? (
        <section className={ui.card}>
          <h2 className={ui.title}>Riwayat ambil / kembali</h2>
          <ul className="mt-3 space-y-2">
            {issues.map((row) => (
              <li key={row.id} className={`${ui.row} text-sm`}>
                <p className={ui.name}>
                  {row.direction === "issue" ? "Ambil" : "Kembali"} · {row.salesName} · {row.productName} ×{row.qty}
                </p>
                <p className={ui.muted}>
                  {new Date(row.createdAt).toLocaleString("id-ID")}
                  {row.note ? ` · ${row.note}` : ""}
                </p>
              </li>
            ))}
            {!issues.length && <p className={`text-sm ${ui.muted.replace("text-xs ", "")}`}>Belum ada riwayat.</p>}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
