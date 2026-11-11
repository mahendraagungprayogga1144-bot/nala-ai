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

export default function StockClient({
  canEdit,
  hand: initialHand,
  issues: initialIssues,
  products,
  staff,
}: {
  canEdit: boolean;
  hand: Hand[];
  issues: Issue[];
  products: Product[];
  staff: Staff[];
}) {
  const [hand, setHand] = useState(initialHand);
  const [issues, setIssues] = useState(initialIssues);
  const [warehouse, setWarehouse] = useState(products);
  const [salesId, setSalesId] = useState(staff[0]?.id || "");
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [qty, setQty] = useState("5");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function submit(action: "issue" | "return") {
    setBusy(true);
    setError("");
    setOk("");
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
      setOk(
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
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-sm font-bold text-[#F0EFF8]">Stok gudang</h2>
        <p className="mt-1 text-xs text-[#8B8AA0]">Ini stok di gudang. Berkurang saat sales ambil barang.</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {warehouse.map((p) => (
            <li key={p.id} className="rounded-xl border border-white/10 px-3 py-2.5">
              <p className="text-sm font-semibold text-[#F0EFF8]">{p.name}</p>
              <p className="text-xs text-[#8B8AA0]">
                Gudang: <span className="font-bold text-[#2DD4BF]">{p.stock} pcs</span>
              </p>
            </li>
          ))}
          {!warehouse.length && <p className="text-sm text-[#8B8AA0]">Belum ada produk katalog.</p>}
        </ul>
      </section>

      {canEdit ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-sm font-bold text-[#F0EFF8]">Ambil / kembalikan</h2>
          <p className="mt-1 text-xs text-[#8B8AA0]">
            Contoh: stok di tangan 2, ambil 5 dari gudang → di tangan jadi 7. Saat jual, stok di tangan yang berkurang.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold text-[#8B8AA0]">
              Sales
              <select className={`${MODULE_INPUT} mt-1`} value={salesId} onChange={(e) => setSalesId(e.target.value)}>
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-[#8B8AA0]">
              Produk
              <select className={`${MODULE_INPUT} mt-1`} value={productId} onChange={(e) => setProductId(e.target.value)}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (gudang {warehouse.find((w) => w.id === p.id)?.stock ?? p.stock})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-semibold text-[#8B8AA0]">
              Jumlah
              <input
                className={`${MODULE_INPUT} mt-1`}
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </label>
            <label className="text-xs font-semibold text-[#8B8AA0]">
              Catatan
              <input
                className={`${MODULE_INPUT} mt-1`}
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
              className="rounded-xl bg-[#2DD4BF] px-4 py-2 text-sm font-bold text-[#0B0B12] disabled:opacity-40"
            >
              {busy ? "Menyimpan…" : "Ambil dari gudang"}
            </button>
            <button
              type="button"
              disabled={busy || !salesId || !productId}
              onClick={() => void submit("return")}
              className="rounded-xl border border-white/15 px-4 py-2 text-sm font-bold text-[#F0EFF8] disabled:opacity-40"
            >
              Kembalikan ke gudang
            </button>
          </div>
          {error ? <p className="mt-2 text-sm text-rose-400">{error}</p> : null}
          {ok ? <p className="mt-2 text-sm text-emerald-400">{ok}</p> : null}
        </section>
      ) : (
        <p className="rounded-xl border border-white/10 px-3 py-2 text-sm text-[#8B8AA0]">
          Sales hanya melihat stok di tangan. Minta owner/leader mencatat ambil gudang.
        </p>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="text-sm font-bold text-[#F0EFF8]">Stok di tangan sales</h2>
        <ul className="mt-3 space-y-2">
          {hand.map((row) => (
            <li
              key={`${row.salesId}-${row.productId}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-semibold text-[#F0EFF8]">
                  {row.salesName} · {row.productName}
                </p>
                <p className="text-xs text-[#8B8AA0]">Gudang sisa {row.warehouseStock} pcs</p>
              </div>
              <p className="text-lg font-bold tabular-nums text-[#2DD4BF]">{row.qty} pcs</p>
            </li>
          ))}
          {!hand.length && (
            <p className="text-sm text-[#8B8AA0]">Belum ada barang di tangan. Catat ambil dari gudang dulu.</p>
          )}
        </ul>
      </section>

      {canEdit ? (
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="text-sm font-bold text-[#F0EFF8]">Riwayat ambil / kembali</h2>
          <ul className="mt-3 space-y-2">
            {issues.map((row) => (
              <li key={row.id} className="rounded-xl border border-white/10 px-3 py-2 text-sm">
                <p className="font-semibold text-[#F0EFF8]">
                  {row.direction === "issue" ? "Ambil" : "Kembali"} · {row.salesName} · {row.productName} ×{row.qty}
                </p>
                <p className="text-xs text-[#8B8AA0]">
                  {new Date(row.createdAt).toLocaleString("id-ID")}
                  {row.note ? ` · ${row.note}` : ""}
                </p>
              </li>
            ))}
            {!issues.length && <p className="text-sm text-[#8B8AA0]">Belum ada riwayat.</p>}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
