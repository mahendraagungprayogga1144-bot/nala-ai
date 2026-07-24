"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowDownToLine, ArrowUpFromLine, X } from "lucide-react";
import { todayWib } from "@/lib/date";
import {
  fmtRp,
  moveStock,
  type ProductRow,
  type StockMovementRow,
  type AttrsMode,
} from "./typed-stock-actions";

export const inputCls =
  "w-full px-3 py-2.5 rounded-xl bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50 text-sm";

export function RecentMovementsStrip({
  movements,
  accent = "#2DD4BF",
}: {
  movements: StockMovementRow[];
  accent?: string;
}) {
  if (!movements?.length) return null;
  return (
    <div className="mb-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0D0D1A]">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: accent }}>
          Riwayat stok
        </p>
        <span className="text-[10px] text-[#5A5B7A]">{movements.length} terakhir</span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {movements.slice(0, 8).map((m) => {
          const isIn = m.type === "masuk";
          return (
            <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  style={{ background: isIn ? `${accent}18` : "rgba(245,158,11,0.12)" }}
                >
                  {isIn ? (
                    <ArrowDownToLine size={12} style={{ color: accent }} />
                  ) : (
                    <ArrowUpFromLine size={12} className="text-[#F59E0B]" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-[#F0EFF8]">
                    {m.products?.name || "Produk"}
                  </p>
                  <p className="truncate text-[10px] text-[#5A5B7A]">
                    {m.note || m.reason || (isIn ? "Masuk" : "Keluar")}
                    {m.movement_date ? ` · ${m.movement_date}` : ""}
                  </p>
                </div>
              </div>
              <p className="shrink-0 font-mono text-xs" style={{ color: isIn ? accent : "#F59E0B" }}>
                {isIn ? "+" : "−"}
                {m.quantity}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type SheetMode = "masuk" | "keluar" | "jual";

export function StockActionSheet({
  mode,
  product,
  onClose,
  userId,
  businessId,
  buyCategory,
  sellCategory,
  reasons,
  attrsMode = "none",
  moq,
  wholesalePrice,
  accent = "#2DD4BF",
  qtyChips,
  defaultReason,
}: {
  mode: SheetMode;
  product: ProductRow;
  onClose: () => void;
  userId: string;
  businessId?: string;
  buyCategory: string;
  sellCategory: string;
  reasons: { value: string; label: string }[];
  attrsMode?: AttrsMode;
  moq?: number | null;
  wholesalePrice?: number | null;
  accent?: string;
  qtyChips?: number[];
  defaultReason?: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const chips =
    qtyChips ||
    (attrsMode === "wholesale"
      ? [1, 5, 10, 20, 50, 100, Number(moq || 0)].filter((n, i, a) => n > 0 && a.indexOf(n) === i)
      : [1, 2, 5, 10, 20]);

  const [qty, setQty] = useState(
    mode === "jual" && attrsMode === "wholesale" && moq ? String(moq) : "1",
  );
  const [date, setDate] = useState(todayWib());
  const [note, setNote] = useState("");
  const [reason, setReason] = useState(defaultReason || reasons[0]?.value || "terjual");
  const [sellPrice, setSellPrice] = useState(
    mode === "jual" && attrsMode === "wholesale" && wholesalePrice != null
      ? String(wholesalePrice)
      : product.price != null
        ? String(product.price)
        : "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sellQty = Number(qty) || 0;
  const sellHarga = Number(sellPrice) || 0;
  const sellModal = Number(product.cost || 0);
  const sellTotal = sellQty * sellHarga;
  const sellLaba = sellQty * (sellHarga - sellModal);

  const btnStyle = { background: `linear-gradient(135deg, ${accent}, #8B5CF6)`, color: "#070711" } as const;

  const submit = async () => {
    if (!qty || Number(qty) <= 0) return;
    setLoading(true);
    setError("");
    const result = await moveStock(supabase, {
      userId,
      businessId,
      product,
      mode,
      qty: Number(qty),
      date,
      note: note || null,
      reason,
      sellPrice: sellPrice ? Number(sellPrice) : null,
      buyCategory,
      sellCategory,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onClose();
    router.refresh();
  };

  const title =
    mode === "masuk" ? "Barang masuk" : mode === "jual" ? "Jual barang" : "Barang keluar";

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#12121f] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/20 sm:hidden" />
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#5A5B7A]">{title}</p>
            <p className="font-semibold text-[#F0EFF8]">{product.name}</p>
            <p className="text-[11px] text-[#8B8AA0]">
              Stok sekarang: {Number(product.stock)} {product.unit || ""}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-[#8B8AA0]">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] text-[#8B8AA0]">Jumlah *</label>
              <input
                className={inputCls}
                type="number"
                min="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-[#8B8AA0]">Tanggal</label>
              <input
                className={inputCls}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ colorScheme: "dark" }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {chips.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setQty(String(n))}
                className="rounded-lg px-2.5 py-1 text-[11px]"
                style={
                  qty === String(n)
                    ? { background: `${accent}33`, color: accent }
                    : { background: "rgba(255,255,255,0.05)", color: "#8B8AA0" }
                }
              >
                {n}
              </button>
            ))}
          </div>

          {mode === "keluar" && (
            <select className={inputCls} value={reason} onChange={(e) => setReason(e.target.value)}>
              {reasons.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          )}

          {mode === "jual" && (
            <div>
              <label className="mb-1 block text-[11px] text-[#8B8AA0]">
                Harga jual / unit
                {attrsMode === "wholesale" ? " (bisa harga grosir)" : ""}
              </label>
              <input
                className={inputCls}
                type="number"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
              />
            </div>
          )}

          <input
            className={inputCls}
            placeholder="Catatan (opsional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />

          {mode === "jual" && sellQty > 0 && sellHarga > 0 && (
            <div
              className="rounded-xl border p-3 text-xs"
              style={{ borderColor: `${accent}33`, background: `${accent}10` }}
            >
              <div className="flex justify-between text-[#8B8AA0]">
                <span>Total jual</span>
                <span className="font-mono text-[#F0EFF8]">{fmtRp(sellTotal)}</span>
              </div>
              <div className="mt-1 flex justify-between text-[#8B8AA0]">
                <span>HPP</span>
                <span className="font-mono">{fmtRp(sellModal * sellQty)}</span>
              </div>
              <div
                className="mt-1 flex justify-between font-semibold"
                style={{ color: sellLaba >= 0 ? accent : "#EC4899" }}
              >
                <span>{sellLaba >= 0 ? "Laba" : "Rugi"}</span>
                <span className="font-mono">{fmtRp(Math.abs(sellLaba))}</span>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-[#EC4899]">{error}</p>}

          <button
            type="button"
            disabled={loading}
            onClick={submit}
            className="w-full rounded-xl py-3.5 text-sm font-semibold disabled:opacity-40"
            style={btnStyle}
          >
            {loading
              ? "Memproses..."
              : mode === "masuk"
                ? "Catat masuk"
                : mode === "jual"
                  ? "Simpan penjualan"
                  : "Catat keluar"}
          </button>
        </div>
      </div>
    </div>
  );
}
