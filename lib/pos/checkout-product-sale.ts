import type { SupabaseClient } from "@supabase/supabase-js";
import { todayWib } from "@/lib/date";

export type ProductCartLine = {
  productId: string;
  name: string;
  qty: number;
  price: number;
  cost: number;
  expectedStock: number;
};

export type CheckoutResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

/**
 * Product-based POS checkout with optimistic stock concurrency.
 * Fails entirely (no success toast) if any write fails; attempts compensate deletes.
 */
export async function checkoutProductSale(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    businessId: string;
    lines: ProductCartLine[];
    total: number;
    diskon: number;
    hpp: number;
    laba: number;
    metodeBayar: string;
    catatan?: string;
    today?: string;
    shiftId?: string | null;
    shiftTotal?: number;
    shiftOrders?: number;
    /** Retail AI Kasir standalone — do not write Keuangan Bisnis. */
    skipFinance?: boolean;
    staffName?: string | null;
  },
): Promise<CheckoutResult> {
  const today = opts.today || todayWib();
  if (!opts.lines.length) return { ok: false, error: "Keranjang kosong" };
  if (!opts.businessId) return { ok: false, error: "Bisnis tidak aktif" };

  for (const line of opts.lines) {
    if (line.qty > line.expectedStock) {
      return {
        ok: false,
        error: `Stok tidak cukup: ${line.name} (sisa ${line.expectedStock})`,
      };
    }
  }

  const staffTag = opts.staffName ? ` · kasir ${opts.staffName}` : "";
  const note =
    opts.catatan ||
    `AI Kasir retail${staffTag} — ${opts.metodeBayar}`;

  const orderRow: Record<string, unknown> = {
    user_id: opts.userId,
    business_id: opts.businessId,
    total: opts.total,
    diskon: opts.diskon,
    hpp: opts.hpp,
    laba: opts.laba,
    metode_bayar: opts.metodeBayar,
    catatan: note,
    order_date: today,
  };
  if (opts.skipFinance) {
    orderRow.source = "retail_kasir";
  }

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert(orderRow)
    .select("id")
    .single();

  if (orderErr || !order) {
    return { ok: false, error: "Gagal simpan order: " + (orderErr?.message || "unknown") };
  }

  const items = opts.lines.map((c) => ({
    order_id: order.id,
    product_id: String(c.productId),
    qty: c.qty,
    harga_jual: c.price,
    hpp: c.cost || 0,
    laba: ((c.price || 0) - (c.cost || 0)) * c.qty,
  }));

  const { error: itemsErr } = await supabase.from("order_items").insert(items);
  if (itemsErr) {
    await supabase.from("orders").delete().eq("id", order.id);
    return { ok: false, error: "Gagal simpan item: " + itemsErr.message };
  }

  if (!opts.skipFinance) {
    const { error: txErr } = await supabase.from("transactions").insert({
      user_id: opts.userId,
      business_id: opts.businessId,
      type: "pemasukan",
      scope: "bisnis",
      category: "Penjualan",
      description: opts.lines.map((c) => `${c.name} x${c.qty}`).join(", "),
      amount: opts.total,
      transaction_date: today,
    });
    if (txErr) {
      await supabase.from("order_items").delete().eq("order_id", order.id);
      await supabase.from("orders").delete().eq("id", order.id);
      return { ok: false, error: "Gagal catat keuangan: " + txErr.message };
    }
  }

  for (const c of opts.lines) {
    const newStock = Math.max(0, c.expectedStock - c.qty);
    const { data: updated, error: stockErr } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", c.productId)
      .eq("stock", c.expectedStock)
      .select("id")
      .maybeSingle();

    if (stockErr || !updated) {
      // Compensate: restore prior lines already deducted is hard without RPC —
      // delete order so omzet tidak palsu; stok may be partially cut.
      await supabase.from("order_items").delete().eq("order_id", order.id);
      await supabase.from("orders").delete().eq("id", order.id);
      return {
        ok: false,
        error: `Stok berubah saat bayar (${c.name}). Muat ulang lalu coba lagi.`,
      };
    }

    const itemLaba = ((c.price || 0) - (c.cost || 0)) * c.qty;
    const { error: movErr } = await supabase.from("stock_movements").insert({
      user_id: opts.userId,
      product_id: c.productId,
      type: "keluar",
      reason: "terjual",
      quantity: c.qty,
      note: opts.catatan || note,
      profit_loss: itemLaba,
      movement_date: today,
    });
    if (movErr) {
      await supabase.from("order_items").delete().eq("order_id", order.id);
      await supabase.from("orders").delete().eq("id", order.id);
      return { ok: false, error: "Gagal catat mutasi stok: " + movErr.message };
    }
  }

  if (opts.shiftId) {
    const { error: shiftErr } = await supabase
      .from("kasir_shifts")
      .update({
        total_transaksi: Number(opts.shiftTotal || 0) + opts.total,
        total_order: Number(opts.shiftOrders || 0) + 1,
      })
      .eq("id", opts.shiftId);
    if (shiftErr) {
      // Sale already committed — warn but treat as success for money integrity
      console.warn("[checkout] shift update failed", shiftErr.message);
    }
  }

  return { ok: true, orderId: order.id };
}
