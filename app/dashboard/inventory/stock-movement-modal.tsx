"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeftRight, X } from "lucide-react";
import type { BusinessConfig } from "./business-config";

export default function StockMovementModal({ productId, userId, businessId, currentStock, price, cost, productName, config }: { productId: string; userId: string; businessId?: string; currentStock: number; price: number | null; cost: number | null; productName?: string; config: BusinessConfig }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"masuk" | "keluar">("keluar");
  const [reason, setReason] = useState(config.alasanKeluar[0]?.value || "terjual");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  const qty = Number(quantity) || 0;
  const isSell = reason === "terjual";
  const isLoss = ["retur", "rusak", "mati", "sakit", "terpakai"].includes(reason);
  const profitPreview = type === "keluar" && isSell && price && cost
    ? (price - cost) * qty
    : type === "keluar" && isLoss && cost
    ? -cost * qty
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qty <= 0) return;
    setLoading(true);

    const newStock = type === "masuk" ? currentStock + qty : Math.max(0, currentStock - qty);
    const profitLoss = type === "keluar" ? profitPreview : 0;

    const { error: stockError } = await supabase.from("products").update({ stock: newStock }).eq("id", productId);
    if (stockError) { alert("Gagal update stok: " + stockError.message); setLoading(false); return; }

    const { error: moveError } = await supabase.from("stock_movements").insert({
      user_id: userId,
      product_id: productId,
      type,
      reason: type === "keluar" ? reason : null,
      quantity: qty,
      note: note || null,
      profit_loss: profitLoss,
      movement_date: date,
    });
    if (moveError) { alert("Gagal catat pergerakan: " + moveError.message); setLoading(false); return; }

    if (type === "keluar" && isSell && price) {
      await supabase.from("transactions").insert({
        user_id: userId,
        business_id: businessId,
        type: "pemasukan",
        scope: "bisnis",
        category: "Penjualan",
        description: `${config.alasanKeluar.find(a => a.value === "terjual")?.label || "Terjual"} ${productName || "produk"} (${qty} ${config.satuanLabel}) - via Inventory`,
        amount: price * qty,
        transaction_date: date,
      });
    } else if (type === "keluar" && isLoss && cost) {
      await supabase.from("transactions").insert({
        user_id: userId,
        business_id: businessId,
        type: "pengeluaran",
        scope: "bisnis",
        category: "Kerugian Stok",
        description: `${config.alasanKeluar.find(a => a.value === reason)?.label || reason} ${productName || "produk"} (${qty} ${config.satuanLabel}) - via Inventory`,
        amount: cost * qty,
        transaction_date: date,
      });
    }

    setLoading(false);
    setOpen(false);
    setQuantity("");
    setNote("");
    router.refresh();
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-[#8B8AA0] hover:text-[#2DD4BF] transition-colors p-1">
        <ArrowLeftRight size={14} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[min(92dvh,560px)] w-full max-w-sm flex-col gap-3 overflow-y-auto overscroll-contain rounded-t-2xl border border-white/10 bg-[#0F0F1A] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
          >
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium">Catat Pergerakan {config.stokLabel}</h3>
              <button type="button" onClick={() => setOpen(false)} className="text-[#8B8AA0]"><X size={16} /></button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setType("masuk")} className={"py-2 rounded-lg text-sm font-medium border " + (type === "masuk" ? "bg-[#2DD4BF]/15 border-[#2DD4BF]/40 text-[#2DD4BF]" : "border-white/10 text-[#8B8AA0]")}>
                {config.stokLabel} Masuk
              </button>
              <button type="button" onClick={() => setType("keluar")} className={"py-2 rounded-lg text-sm font-medium border " + (type === "keluar" ? "bg-[#EC4899]/15 border-[#EC4899]/40 text-[#EC4899]" : "border-white/10 text-[#8B8AA0]")}>
                {config.stokLabel} Keluar
              </button>
            </div>

            {type === "keluar" && (
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="px-4 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] text-sm focus:outline-none focus:border-[#2DD4BF]/50">
                {config.alasanKeluar.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            )}

            <input type="number" required min="1" placeholder={`Jumlah (${config.satuanLabel})`} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="px-4 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50" />

            <div>
              <label className="text-[11px] text-[#8B8AA0] mb-1 block">Tanggal transaksi</label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().split("T")[0]} className="w-full px-4 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] text-sm focus:outline-none focus:border-[#2DD4BF]/50" style={{ colorScheme: "dark" }} />
            </div>

            <input type="text" placeholder="Catatan (opsional)" value={note} onChange={(e) => setNote(e.target.value)} className="px-4 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50" />

            {type === "keluar" && qty > 0 && cost && (
              <div className={"rounded-lg px-3 py-2 text-sm font-mono " + (profitPreview >= 0 ? "bg-[#2DD4BF]/10 text-[#2DD4BF]" : "bg-[#EC4899]/10 text-[#EC4899]")}>
                {profitPreview >= 0 ? "Untung" : "Rugi"} Rp{Math.abs(profitPreview).toLocaleString("id-ID")}
              </div>
            )}

            {type === "keluar" && (
              <p className="text-[10px] text-[#8B8AA0] -mt-1">Otomatis kecatat juga di Keuangan Bisnis</p>
            )}

            <button type="submit" disabled={loading} className="py-2.5 rounded-lg bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] text-[#0A0A12] font-semibold disabled:opacity-50 mt-1">
              {loading ? "Menyimpan..." : "Simpan"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
