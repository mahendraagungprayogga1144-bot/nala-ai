"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2 } from "lucide-react";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../components/module-form-styles";
import { fmtRp } from "../components/biz-hub-shell";
import { moveStock, type ProductRow } from "../inventory/lib/typed-stock-actions";
import { todayWib } from "@/lib/date";

type Order = {
  id: string;
  pelanggan: string;
  kendaraan: string;
  keluhan: string | null;
  biaya_jasa: number | null;
  spare_part: string | null;
  spare_product_id?: string | null;
  spare_qty?: number | null;
  status: string;
};

const STATUS = ["antrian", "proses", "selesai", "batal"] as const;

export default function BengkelClient({
  businessId,
  userId,
  orders,
  products,
}: {
  businessId: string;
  userId: string;
  orders: Order[];
  products: ProductRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    pelanggan: "",
    kendaraan: "",
    keluhan: "",
    biaya_jasa: "",
    spare_product_id: "",
    spare_qty: "1",
    spare_note: "",
  });

  const productById = useMemo(() => {
    const m = new Map<string, ProductRow>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pelanggan.trim() || !form.kendaraan.trim()) return;
    setLoading(true);
    const prod = form.spare_product_id ? productById.get(form.spare_product_id) : null;
    const qty = Math.max(0, Number(form.spare_qty) || 0);
    const spareLabel = prod
      ? `${prod.name} x${qty || 1}`
      : form.spare_note.trim() || null;

    const { error } = await supabase.from("module_workshop_orders").insert({
      user_id: userId,
      business_id: businessId,
      pelanggan: form.pelanggan.trim(),
      kendaraan: form.kendaraan.trim(),
      keluhan: form.keluhan || null,
      biaya_jasa: Number(form.biaya_jasa) || 0,
      spare_part: spareLabel,
      spare_product_id: prod?.id || null,
      spare_qty: prod ? qty || 1 : 0,
      status: "antrian",
    });
    setLoading(false);
    if (error) {
      // Fallback if spare columns not migrated yet
      if (/spare_product_id|spare_qty|column/i.test(error.message)) {
        const retry = await supabase.from("module_workshop_orders").insert({
          user_id: userId,
          business_id: businessId,
          pelanggan: form.pelanggan.trim(),
          kendaraan: form.kendaraan.trim(),
          keluhan: form.keluhan || null,
          biaya_jasa: Number(form.biaya_jasa) || 0,
          spare_part: spareLabel,
          status: "antrian",
        });
        if (retry.error) {
          alert(retry.error.message + "\n\nJalankan migrasi 20260724_biz_type_modules.sql / workshop_spare_product di Supabase.");
          return;
        }
      } else {
        alert(error.message + "\n\nJalankan migrasi 20260724_biz_type_modules.sql di Supabase.");
        return;
      }
    }
    setForm({
      pelanggan: "",
      kendaraan: "",
      keluhan: "",
      biaya_jasa: "",
      spare_product_id: "",
      spare_qty: "1",
      spare_note: "",
    });
    setOpen(false);
    router.refresh();
  };

  const setStatus = async (order: Order, status: string) => {
    if (status === order.status) return;
    setLoading(true);

    if (status === "selesai" && order.status !== "selesai") {
      const productId = order.spare_product_id;
      const qty = Number(order.spare_qty) || 0;
      if (productId && qty > 0) {
        const { data: prodRow } = await supabase
          .from("products")
          .select("id, name, sku, stock, min_stock, price, cost, category, photo_url, unit")
          .eq("id", productId)
          .maybeSingle();
        if (prodRow) {
          const result = await moveStock(supabase, {
            userId,
            businessId,
            product: prodRow as ProductRow,
            mode: "keluar",
            qty,
            date: todayWib(),
            note: `Servis ${order.kendaraan} — ${order.pelanggan}`,
            reason: "terpakai",
            buyCategory: "Pembelian Spare Part",
            sellCategory: "Penjualan Spare Part",
          });
          if (result.error) {
            setLoading(false);
            alert("Gagal potong stok spare: " + result.error);
            return;
          }
        }
      }

      const jasa = Number(order.biaya_jasa) || 0;
      if (jasa > 0) {
        const { error: txErr } = await supabase.from("transactions").insert({
          user_id: userId,
          business_id: businessId,
          type: "pemasukan",
          scope: "bisnis",
          category: "Jasa Bengkel",
          description: `Servis ${order.kendaraan} — ${order.pelanggan}`,
          amount: jasa,
          transaction_date: todayWib(),
        });
        if (txErr) {
          setLoading(false);
          alert("Status belum diubah — keuangan jasa gagal: " + txErr.message);
          return;
        }
      }
    }

    const { error } = await supabase
      .from("module_workshop_orders")
      .update({ status })
      .eq("id", order.id);
    setLoading(false);
    if (error) alert(error.message);
    router.refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus order bengkel ini?")) return;
    await supabase.from("module_workshop_orders").delete().eq("id", id);
    router.refresh();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[#8B8AA0]">Antrian & riwayat servis — spare dari inventory otomatis keluar saat selesai</p>
        <button type="button" onClick={() => setOpen((v) => !v)} className={MODULE_BTN + " inline-flex items-center gap-1.5"}>
          <Plus size={14} /> Order baru
        </button>
      </div>

      {open && (
        <form onSubmit={save} className={MODULE_CARD + " mb-4 flex flex-col gap-2"}>
          <input className={MODULE_INPUT} placeholder="Nama pelanggan" value={form.pelanggan} onChange={(e) => setForm({ ...form, pelanggan: e.target.value })} required />
          <input className={MODULE_INPUT} placeholder="Kendaraan (mis. Honda Beat B 1234 XX)" value={form.kendaraan} onChange={(e) => setForm({ ...form, kendaraan: e.target.value })} required />
          <input className={MODULE_INPUT} placeholder="Keluhan" value={form.keluhan} onChange={(e) => setForm({ ...form, keluhan: e.target.value })} />
          <input className={MODULE_INPUT} type="number" placeholder="Biaya jasa (Rp)" value={form.biaya_jasa} onChange={(e) => setForm({ ...form, biaya_jasa: e.target.value })} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select
              className={MODULE_INPUT}
              value={form.spare_product_id}
              onChange={(e) => setForm({ ...form, spare_product_id: e.target.value })}
            >
              <option value="">Spare part dari stok (opsional)</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — stok {p.stock}
                </option>
              ))}
            </select>
            <input
              className={MODULE_INPUT}
              type="number"
              min={1}
              placeholder="Qty spare"
              value={form.spare_qty}
              onChange={(e) => setForm({ ...form, spare_qty: e.target.value })}
              disabled={!form.spare_product_id}
            />
          </div>
          {!form.spare_product_id && (
            <input
              className={MODULE_INPUT}
              placeholder="Catatan spare (teks, jika belum di inventory)"
              value={form.spare_note}
              onChange={(e) => setForm({ ...form, spare_note: e.target.value })}
            />
          )}
          {products.length === 0 && (
            <p className="text-[11px] text-[#F59E0B]">Belum ada spare di Inventory — isi rak dulu agar stok bisa dipotong otomatis.</p>
          )}
          <button type="submit" disabled={loading} className={MODULE_BTN}>{loading ? "Menyimpan..." : "Masuk antrian"}</button>
        </form>
      )}

      {orders.length === 0 ? (
        <div className={MODULE_CARD + " text-center text-sm text-[#8B8AA0]"}>Belum ada order. Tambah kendaraan yang masuk bengkel.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <div key={o.id} className={MODULE_CARD}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[#F0EFF8]">{o.kendaraan}</p>
                  <p className="text-xs text-[#8B8AA0]">{o.pelanggan}{o.keluhan ? ` · ${o.keluhan}` : ""}</p>
                  {o.spare_part && <p className="mt-0.5 text-xs text-[#8B8AA0]">Part: {o.spare_part}</p>}
                  <p className="mt-1 text-sm text-[#2DD4BF]">{fmtRp(Number(o.biaya_jasa || 0))}</p>
                </div>
                <button type="button" onClick={() => remove(o.id)} className="text-[#5A5B7A] hover:text-[#EC4899]"><Trash2 size={14} /></button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {STATUS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={loading}
                    onClick={() => setStatus(o, s)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] capitalize ${
                      o.status === s ? "bg-[#2DD4BF]/20 text-[#2DD4BF]" : "bg-white/5 text-[#8B8AA0]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
