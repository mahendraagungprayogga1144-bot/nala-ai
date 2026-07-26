import type { SupabaseClient } from "@supabase/supabase-js";

/** Map jenis ternak batch → kategori inventory yang dikenali LivestockInventory */
export function hewanInventoryCategory(jenisTernak: string): string {
  const j = jenisTernak.toLowerCase();
  if (j.includes("lele") || j.includes("nila") || j.includes("ikan")) return "Ikan";
  if (j.includes("broiler")) return "Ayam Broiler";
  if (j.includes("kampung") || j.includes("ayam")) return "Ayam Kampung";
  if (j.includes("bebek")) return "Bebek";
  if (j.includes("sapi")) return "Sapi";
  if (j.includes("kambing")) return "Kambing";
  if (j.includes("kelinci")) return "Kelinci";
  if (j.includes("puyuh") || j.includes("burung")) return "Ayam Kampung";
  return jenisTernak;
}

type InvDelta = {
  jenis: string;
  qty: number;
  namaItem: string | null;
  harga: number | null;
  jenisTernak: string;
  /** HPP penuh per ekor (bibit+pakan+obat+ops) ÷ populasi awal. Dipakai saat panen. */
  hppPerEkor?: number | null;
};

/** Apply or reverse inventory effect of one farm transaction. sign: +1 apply, -1 reverse */
export async function syncFarmInventoryDelta(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    businessId: string;
    delta: InvDelta;
    sign: 1 | -1;
  },
) {
  const { userId, businessId, delta, sign } = opts;
  const qty = Math.abs(delta.qty);
  if (qty <= 0) return;
  const signed = qty * sign;

  if (delta.jenis === "bibit") {
    const cat = hewanInventoryCategory(delta.jenisTernak);
    const { data: existing } = await supabase
      .from("products")
      .select("id, stock, cost")
      .eq("business_id", businessId)
      .ilike("name", delta.jenisTernak)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("products")
        .update({
          stock: Math.max(0, Number(existing.stock) + signed),
          cost: sign > 0 ? (delta.harga || existing.cost) : existing.cost,
          category: cat,
        })
        .eq("id", existing.id);
    } else if (sign > 0) {
      await supabase.from("products").insert({
        user_id: userId,
        business_id: businessId,
        name: delta.jenisTernak,
        category: cat,
        stock: qty,
        min_stock: 10,
        cost: delta.harga || null,
      });
    }
    return;
  }

  if ((delta.jenis === "pakan" || delta.jenis === "obat" || delta.jenis === "vitamin") && delta.namaItem) {
    const cat = delta.jenis === "pakan" ? "Pakan" : delta.jenis === "obat" ? "Obat" : "Vitamin";
    const { data: existing } = await supabase
      .from("products")
      .select("id, stock")
      .eq("name", delta.namaItem)
      .eq("business_id", businessId)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("products")
        .update({
          stock: Math.max(0, Number(existing.stock) + signed),
          cost: sign > 0 ? delta.harga || null : undefined,
        })
        .eq("id", existing.id);
    } else if (sign > 0) {
      await supabase.from("products").insert({
        user_id: userId,
        business_id: businessId,
        name: delta.namaItem,
        category: cat,
        stock: qty,
        min_stock: 5,
        cost: delta.harga || null,
      });
    }
    return;
  }

  if (delta.jenis === "mortalitas" || delta.jenis === "panen") {
    const { data: existing } = await supabase
      .from("products")
      .select("id, stock, cost")
      .eq("business_id", businessId)
      .ilike("name", delta.jenisTernak)
      .maybeSingle();
    if (existing) {
      // mortalitas/panen reduce stock on apply → reverse adds back
      const stockDelta = -signed;
      const patch: { stock: number; price?: number | null; cost?: number | null; category?: string } = {
        stock: Math.max(0, Number(existing.stock) + stockDelta),
      };
      if (delta.jenis === "panen" && sign > 0 && delta.harga) patch.price = delta.harga;
      // HPP penuh (bibit+pakan+obat+ops) per ekor, bukan cuma harga bibit.
      if (delta.jenis === "panen" && sign > 0 && delta.hppPerEkor && delta.hppPerEkor > 0) {
        patch.cost = Math.round(delta.hppPerEkor);
      }
      if (sign > 0) patch.category = hewanInventoryCategory(delta.jenisTernak);
      await supabase.from("products").update(patch).eq("id", existing.id);
    }
  }
}
