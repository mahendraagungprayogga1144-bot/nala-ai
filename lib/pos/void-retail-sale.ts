import type { SupabaseClient } from "@supabase/supabase-js";

export type VoidResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Void a retail_kasir sale: restore stock, mark order voided, adjust open shift.
 * Does not touch Keuangan Bisnis (retail sales were never synced).
 */
export async function voidRetailSale(
  supabase: SupabaseClient,
  opts: {
    orderId: string;
    userId: string;
    businessId: string;
    shiftId?: string | null;
  },
): Promise<VoidResult> {
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, total, catatan, source, status")
    .eq("id", opts.orderId)
    .eq("business_id", opts.businessId)
    .eq("user_id", opts.userId)
    .maybeSingle();

  if (orderErr || !order) {
    return { ok: false, error: orderErr?.message || "Order tidak ditemukan" };
  }
  if (order.source && order.source !== "retail_kasir") {
    return { ok: false, error: "Hanya transaksi AI Kasir yang bisa dibatalkan di sini" };
  }
  if (order.status === "voided" || (order.catatan || "").startsWith("[VOID]")) {
    return { ok: false, error: "Transaksi sudah dibatalkan" };
  }

  const { data: items, error: itemsErr } = await supabase
    .from("order_items")
    .select("product_id, qty")
    .eq("order_id", opts.orderId);

  if (itemsErr) {
    return { ok: false, error: "Gagal baca item: " + itemsErr.message };
  }

  for (const item of items || []) {
    if (!item.product_id) continue;
    const qty = Number(item.qty) || 0;
    if (qty <= 0) continue;

    const { data: prod } = await supabase
      .from("products")
      .select("id, stock")
      .eq("id", item.product_id)
      .maybeSingle();

    if (!prod) continue;

    const newStock = (Number(prod.stock) || 0) + qty;
    const { error: stockErr } = await supabase
      .from("products")
      .update({ stock: newStock })
      .eq("id", item.product_id);

    if (stockErr) {
      return { ok: false, error: "Gagal kembalikan stok: " + stockErr.message };
    }

    await supabase.from("stock_movements").insert({
      user_id: opts.userId,
      product_id: item.product_id,
      type: "masuk",
      reason: "void_kasir",
      quantity: qty,
      note: `Void order ${opts.orderId.slice(0, 8)}`,
      profit_loss: 0,
      movement_date: new Date().toISOString().slice(0, 10),
    });
  }

  const note = order.catatan || "AI Kasir retail";
  const { error: updErr } = await supabase
    .from("orders")
    .update({
      status: "voided",
      catatan: note.startsWith("[VOID]") ? note : `[VOID] ${note}`,
      total: 0,
      laba: 0,
    })
    .eq("id", opts.orderId);

  if (updErr) {
    // Fallback if status column missing
    const { error: fallbackErr } = await supabase
      .from("orders")
      .update({
        catatan: note.startsWith("[VOID]") ? note : `[VOID] ${note}`,
        total: 0,
        laba: 0,
      })
      .eq("id", opts.orderId);
    if (fallbackErr) {
      return { ok: false, error: "Gagal tandai void: " + (updErr.message || fallbackErr.message) };
    }
  }

  if (opts.shiftId) {
    const { data: shift } = await supabase
      .from("kasir_shifts")
      .select("total_transaksi, total_order")
      .eq("id", opts.shiftId)
      .maybeSingle();
    if (shift) {
      await supabase
        .from("kasir_shifts")
        .update({
          total_transaksi: Math.max(0, Number(shift.total_transaksi) - Number(order.total)),
          total_order: Math.max(0, Number(shift.total_order) - 1),
        })
        .eq("id", opts.shiftId);
    }
  }

  return { ok: true };
}
