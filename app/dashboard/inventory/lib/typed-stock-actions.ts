import type { SupabaseClient } from "@supabase/supabase-js";
import { todayWib } from "@/lib/date";
import { trackClientEvent } from "@/lib/admin/track-event";

export type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  stock: number;
  min_stock: number;
  price: number | null;
  cost: number | null;
  category: string | null;
  photo_url: string | null;
  unit?: string | null;
};

export type ProductAttr = {
  product_id: string;
  expiry_date?: string | null;
  min_order_qty?: number | null;
  wholesale_price?: number | null;
};

export type StockMovementRow = {
  id: string;
  type: string;
  reason: string | null;
  quantity: number;
  note: string | null;
  profit_loss: number | null;
  created_at: string;
  movement_date?: string | null;
  products?: { name: string } | null;
};

export type AttrsMode = "none" | "expiry" | "wholesale";

export type AddProductInput = {
  userId: string;
  businessId?: string;
  name: string;
  sku?: string | null;
  category?: string | null;
  stock: number;
  minStock: number;
  price?: number | null;
  cost?: number | null;
  unit?: string | null;
  buyCategory: string;
  attrsMode?: AttrsMode;
  expiryDate?: string | null;
  moq?: number | null;
  wholesalePrice?: number | null;
};

export type MoveStockInput = {
  userId: string;
  businessId?: string;
  product: ProductRow;
  mode: "masuk" | "keluar" | "jual";
  qty: number;
  date?: string;
  note?: string | null;
  reason?: string | null;
  sellPrice?: number | null;
  buyCategory: string;
  sellCategory: string;
};

function isSellReason(reason: string | null | undefined) {
  return !!reason && (reason === "terjual" || reason.startsWith("terjual") || reason === "dijual");
}

export async function upsertProductAttrs(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    businessId: string;
    productId: string;
    expiryDate?: string | null;
    moq?: number | null;
    wholesalePrice?: number | null;
  },
) {
  const { error } = await supabase.from("module_product_attrs").upsert(
    {
      user_id: opts.userId,
      business_id: opts.businessId,
      product_id: opts.productId,
      expiry_date: opts.expiryDate ?? null,
      min_order_qty: opts.moq ?? null,
      wholesale_price: opts.wholesalePrice ?? null,
    },
    { onConflict: "business_id,product_id" },
  );
  return error;
}

export async function deleteProductAttrs(supabase: SupabaseClient, productId: string) {
  await supabase.from("module_product_attrs").delete().eq("product_id", productId);
}

export async function addProduct(supabase: SupabaseClient, input: AddProductInput) {
  const { data, error } = await supabase
    .from("products")
    .insert({
      user_id: input.userId,
      business_id: input.businessId,
      name: input.name.trim(),
      sku: input.sku || null,
      category: input.category || null,
      stock: input.stock,
      min_stock: input.minStock,
      price: input.price ?? null,
      cost: input.cost ?? null,
      unit: input.unit || null,
    })
    .select("id")
    .single();

  if (error) return { error, id: null as string | null };

  const id = data?.id as string;
  if (id && input.businessId && input.attrsMode && input.attrsMode !== "none") {
    await upsertProductAttrs(supabase, {
      userId: input.userId,
      businessId: input.businessId,
      productId: id,
      expiryDate: input.attrsMode === "expiry" ? input.expiryDate : null,
      moq: input.attrsMode === "wholesale" ? input.moq : null,
      wholesalePrice: input.attrsMode === "wholesale" ? input.wholesalePrice : null,
    });
  }

  if (id && input.cost && input.stock > 0) {
    const date = todayWib();
    await supabase.from("transactions").insert({
      user_id: input.userId,
      business_id: input.businessId,
      type: "pengeluaran",
      scope: "bisnis",
      category: input.buyCategory,
      description: `Stok awal ${input.name.trim()} (${input.stock} ${input.unit || "pcs"})`,
      amount: input.cost * input.stock,
      transaction_date: date,
    });
    await supabase.from("stock_movements").insert({
      user_id: input.userId,
      product_id: id,
      type: "masuk",
      quantity: input.stock,
      note: "Stok awal",
      movement_date: date,
    });
  }

  return { error: null, id };
}

export async function moveStock(supabase: SupabaseClient, input: MoveStockInput) {
  const q = input.qty;
  if (q <= 0) return { error: "Jumlah harus > 0" };
  if (input.mode !== "masuk" && q > Number(input.product.stock)) {
    return { error: `Stok tidak cukup. Tersedia: ${input.product.stock}` };
  }

  const isIn = input.mode === "masuk";
  const date = input.date || todayWib();
  const newStock = isIn
    ? Number(input.product.stock) + q
    : Math.max(0, Number(input.product.stock) - q);
  const harga = Number(input.sellPrice) || Number(input.product.price) || 0;
  const modal = Number(input.product.cost) || 0;
  const reason = input.mode === "jual" ? "terjual" : input.reason || null;
  const laba =
    !isIn && (input.mode === "jual" || isSellReason(reason)) && harga
      ? (harga - modal) * q
      : !isIn && reason === "rusak" && modal
        ? -modal * q
        : 0;

  const { error: stockErr } = await supabase
    .from("products")
    .update({ stock: newStock })
    .eq("id", input.product.id)
    .eq("stock", Number(input.product.stock));
  if (stockErr) return { error: stockErr.message };

  // Verify row actually updated (optimistic concurrency)
  const { data: verify } = await supabase
    .from("products")
    .select("stock")
    .eq("id", input.product.id)
    .maybeSingle();
  if (verify && Number(verify.stock) !== newStock) {
    return { error: "Stok berubah — muat ulang lalu coba lagi" };
  }

  const { error: movErr } = await supabase.from("stock_movements").insert({
    user_id: input.userId,
    product_id: input.product.id,
    type: isIn ? "masuk" : "keluar",
    reason: isIn ? null : reason,
    quantity: q,
    note: input.note || (input.mode === "jual" ? `Penjualan ${input.product.name}` : null),
    profit_loss: laba,
    movement_date: date,
  });
  if (movErr) {
    await supabase.from("products").update({ stock: Number(input.product.stock) }).eq("id", input.product.id);
    return { error: "Gagal catat mutasi: " + movErr.message };
  }

  if (isIn && modal > 0) {
    const { error: txErr } = await supabase.from("transactions").insert({
      user_id: input.userId,
      business_id: input.businessId,
      type: "pengeluaran",
      scope: "bisnis",
      category: input.buyCategory,
      description: `Beli ${input.product.name} x${q}`,
      amount: modal * q,
      transaction_date: date,
    });
    if (txErr) {
      await supabase.from("products").update({ stock: Number(input.product.stock) }).eq("id", input.product.id);
      return { error: "Stok dibatalkan — keuangan gagal: " + txErr.message };
    }
  } else if (!isIn && (input.mode === "jual" || isSellReason(reason)) && harga > 0) {
    const { error: txErr } = await supabase.from("transactions").insert({
      user_id: input.userId,
      business_id: input.businessId,
      type: "pemasukan",
      scope: "bisnis",
      category: input.sellCategory,
      description: `Jual ${input.product.name} x${q}`,
      amount: harga * q,
      transaction_date: date,
    });
    if (txErr) {
      await supabase.from("products").update({ stock: Number(input.product.stock) }).eq("id", input.product.id);
      return { error: "Stok dibatalkan — keuangan gagal: " + txErr.message };
    }
  }

  if (typeof window !== "undefined") {
    const event =
      input.mode === "jual" || isSellReason(reason)
        ? "inventory_sell"
        : isIn
          ? "inventory_in"
          : "inventory_out";
    trackClientEvent({
      event,
      module: "inventory",
      business_id: input.businessId,
      meta: {
        product_id: input.product.id,
        qty: q,
        mode: input.mode,
        amount: harga * q,
      },
    });
  }

  return { error: null };
}

export function fmtRp(n: number) {
  if (n >= 1_000_000) return "Rp" + (n / 1_000_000).toFixed(1).replace(".0", "") + "jt";
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

export function daysUntil(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((d.getTime() - today.getTime()) / 86400000);
}
