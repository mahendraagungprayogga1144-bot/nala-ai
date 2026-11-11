import type { Actor } from "./types";
import { ForbiddenError, SalesError } from "./types";
import type { SalesDb } from "./db";
import { writeAudit } from "./audit";
import { listProducts } from "./staff-service";
import { assertCanAccessStaff, loadTeamIds } from "./authz";

async function ensureStaffAccess(db: SalesDb, actor: Actor, salesId: string) {
  const teamIds = await loadTeamIds(db, actor);
  assertCanAccessStaff(actor, salesId, teamIds);
}

export type HandStockRow = {
  salesId: string;
  salesName: string;
  productId: string;
  productName: string;
  qty: number;
  warehouseStock: number;
};

export type StockIssueRow = {
  id: string;
  salesId: string;
  salesName: string;
  productId: string;
  productName: string;
  qty: number;
  direction: "issue" | "return";
  note: string | null;
  createdAt: string;
};

function moneyQty(n: number) {
  return Math.max(0, Math.round(Number(n) || 0));
}

/** Ambil barang dari gudang ke tangan sales. */
export async function issueStockToSales(
  db: SalesDb,
  actor: Actor,
  input: { salesId: string; productId: string; qty: number; note?: string | null },
) {
  if (actor.role === "SALES") throw new ForbiddenError("Hanya owner/leader yang mencatat ambil gudang.");
  const qty = moneyQty(input.qty);
  if (qty <= 0) throw new SalesError("Jumlah ambil harus lebih dari 0.", "qty_invalid");

  await ensureStaffAccess(db, actor, input.salesId);

  const products = await listProducts(db, actor.businessId);
  const product = products.find((p) => p.id === input.productId);
  if (!product) throw new SalesError("Produk tidak ditemukan di katalog sales.", "product_invalid");

  const { data: warehouse, error: whErr } = await db
    .from("products")
    .select("id, stock")
    .eq("id", input.productId)
    .eq("business_id", actor.businessId)
    .maybeSingle();
  if (whErr || !warehouse) throw new SalesError(whErr?.message || "Produk gudang tidak ditemukan.", "product_invalid");

  const whStock = moneyQty(Number(warehouse.stock || 0));
  if (whStock < qty) {
    throw new SalesError(
      `Stok gudang ${product.name} hanya ${whStock} pcs. Tidak cukup ambil ${qty}.`,
      "warehouse_insufficient",
    );
  }

  const { data: hand } = await db
    .from("module_sales_hand_stock")
    .select("id, qty")
    .eq("business_id", actor.businessId)
    .eq("sales_id", input.salesId)
    .eq("product_id", input.productId)
    .maybeSingle();

  const nextHand = moneyQty(Number(hand?.qty || 0)) + qty;
  const nextWh = whStock - qty;

  const { error: upWh } = await db.from("products").update({ stock: nextWh }).eq("id", input.productId);
  if (upWh) throw new SalesError(upWh.message, "warehouse_update");

  if (hand?.id) {
    const { error } = await db
      .from("module_sales_hand_stock")
      .update({ qty: nextHand, updated_at: new Date().toISOString() })
      .eq("id", hand.id);
    if (error) throw new SalesError(error.message, "hand_update");
  } else {
    const { error } = await db.from("module_sales_hand_stock").insert({
      business_id: actor.businessId,
      sales_id: input.salesId,
      product_id: input.productId,
      qty: nextHand,
    });
    if (error) throw new SalesError(error.message, "hand_insert");
  }

  const { data: log, error: logErr } = await db
    .from("module_sales_stock_issues")
    .insert({
      business_id: actor.businessId,
      sales_id: input.salesId,
      product_id: input.productId,
      qty,
      direction: "issue",
      note: input.note?.trim() || null,
      created_by: actor.staffId,
    })
    .select("id")
    .single();
  if (logErr) throw new SalesError(logErr.message, "issue_log");

  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "ISSUE_STOCK",
    entityType: "hand_stock",
    entityId: log.id,
    newValue: { salesId: input.salesId, productId: input.productId, qty, warehouse: nextWh, hand: nextHand },
  });

  return { warehouseStock: nextWh, handStock: nextHand, productName: product.name };
}

/** Kembalikan barang dari tangan sales ke gudang. */
export async function returnStockFromSales(
  db: SalesDb,
  actor: Actor,
  input: { salesId: string; productId: string; qty: number; note?: string | null },
) {
  if (actor.role === "SALES") throw new ForbiddenError("Hanya owner/leader yang mencatat pengembalian.");
  const qty = moneyQty(input.qty);
  if (qty <= 0) throw new SalesError("Jumlah kembali harus lebih dari 0.", "qty_invalid");
  await ensureStaffAccess(db, actor, input.salesId);

  const products = await listProducts(db, actor.businessId);
  const product = products.find((p) => p.id === input.productId);
  if (!product) throw new SalesError("Produk tidak ditemukan.", "product_invalid");

  const { data: hand } = await db
    .from("module_sales_hand_stock")
    .select("id, qty")
    .eq("business_id", actor.businessId)
    .eq("sales_id", input.salesId)
    .eq("product_id", input.productId)
    .maybeSingle();

  const handQty = moneyQty(Number(hand?.qty || 0));
  if (!hand?.id || handQty < qty) {
    throw new SalesError(
      `Stok di tangan sales hanya ${handQty} pcs. Tidak cukup kembalikan ${qty}.`,
      "hand_insufficient",
    );
  }

  const { data: warehouse } = await db
    .from("products")
    .select("id, stock")
    .eq("id", input.productId)
    .eq("business_id", actor.businessId)
    .maybeSingle();
  if (!warehouse) throw new SalesError("Produk gudang tidak ditemukan.", "product_invalid");

  const nextHand = handQty - qty;
  const nextWh = moneyQty(Number(warehouse.stock || 0)) + qty;

  const { error: upWh } = await db.from("products").update({ stock: nextWh }).eq("id", input.productId);
  if (upWh) throw new SalesError(upWh.message, "warehouse_update");

  const { error: upHand } = await db
    .from("module_sales_hand_stock")
    .update({ qty: nextHand, updated_at: new Date().toISOString() })
    .eq("id", hand.id);
  if (upHand) throw new SalesError(upHand.message, "hand_update");

  const { data: log, error: logErr } = await db
    .from("module_sales_stock_issues")
    .insert({
      business_id: actor.businessId,
      sales_id: input.salesId,
      product_id: input.productId,
      qty,
      direction: "return",
      note: input.note?.trim() || null,
      created_by: actor.staffId,
    })
    .select("id")
    .single();
  if (logErr) throw new SalesError(logErr.message, "return_log");

  await writeAudit(db, actor, {
    businessId: actor.businessId,
    action: "RETURN_STOCK",
    entityType: "hand_stock",
    entityId: log.id,
    newValue: { salesId: input.salesId, productId: input.productId, qty, warehouse: nextWh, hand: nextHand },
  });

  return { warehouseStock: nextWh, handStock: nextHand, productName: product.name };
}

/**
 * Setelah jual sukses lewat RPC (yang masih potong gudang):
 * jika sales punya tracking hand stock untuk produk itu,
 * kembalikan gudang dan potong stok di tangan.
 */
export async function settleSaleAgainstHandStock(
  db: SalesDb,
  actor: Actor,
  lines: { productId: string; quantity: number }[],
) {
  for (const line of lines) {
    const qty = moneyQty(line.quantity);
    if (qty <= 0) continue;

    const { data: hand } = await db
      .from("module_sales_hand_stock")
      .select("id, qty")
      .eq("business_id", actor.businessId)
      .eq("sales_id", actor.staffId)
      .eq("product_id", line.productId)
      .maybeSingle();

    // Belum pernah ambil gudang untuk SKU ini → biarkan potongan gudang dari RPC.
    if (!hand?.id) continue;

    const handQty = moneyQty(Number(hand.qty || 0));
    if (handQty < qty) {
      const wh = await readWarehouse(db, actor.businessId, line.productId);
      await db
        .from("products")
        .update({ stock: moneyQty(wh) + qty })
        .eq("id", line.productId)
        .eq("business_id", actor.businessId);
      throw new SalesError(
        `Stok di tangan tidak cukup (${handQty} pcs). Ambil dulu dari gudang.`,
        "hand_insufficient",
      );
    }

    // Undo potongan gudang dari RPC, lalu potong hand stock.
    const wh = await readWarehouse(db, actor.businessId, line.productId);
    await db
      .from("products")
      .update({ stock: moneyQty(wh) + qty })
      .eq("id", line.productId)
      .eq("business_id", actor.businessId);

    const { error } = await db
      .from("module_sales_hand_stock")
      .update({ qty: handQty - qty, updated_at: new Date().toISOString() })
      .eq("id", hand.id);
    if (error) throw new SalesError(error.message, "hand_settle");
  }
}

/** Cek stok di tangan sebelum jual (kalau sudah tracking). */
export async function assertHandStockForSale(
  db: SalesDb,
  actor: Actor,
  lines: { productId: string; productName?: string; quantity: number }[],
) {
  for (const line of lines) {
    const qty = moneyQty(line.quantity);
    if (qty <= 0) continue;
    const { data: hand } = await db
      .from("module_sales_hand_stock")
      .select("id, qty")
      .eq("business_id", actor.businessId)
      .eq("sales_id", actor.staffId)
      .eq("product_id", line.productId)
      .maybeSingle();
    if (!hand?.id) continue;
    const handQty = moneyQty(Number(hand.qty || 0));
    if (handQty < qty) {
      throw new SalesError(
        `Stok di tangan untuk ${line.productName || "produk"} hanya ${handQty} pcs. Ambil ke gudang dulu.`,
        "hand_insufficient",
      );
    }
  }
}

async function readWarehouse(db: SalesDb, businessId: string, productId: string) {
  const { data } = await db
    .from("products")
    .select("stock")
    .eq("id", productId)
    .eq("business_id", businessId)
    .maybeSingle();
  return Number(data?.stock || 0);
}

export async function listHandStock(db: SalesDb, actor: Actor, salesId?: string) {
  const sid = salesId || (actor.role === "SALES" ? actor.staffId : undefined);
  if (sid) await ensureStaffAccess(db, actor, sid);

  let q = db
    .from("module_sales_hand_stock")
    .select("sales_id, product_id, qty")
    .eq("business_id", actor.businessId)
    .gt("qty", 0)
    .order("updated_at", { ascending: false });
  if (sid) q = q.eq("sales_id", sid);
  else if (actor.role === "SALES") q = q.eq("sales_id", actor.staffId);

  const { data, error } = await q;
  if (error) {
    if (/module_sales_hand_stock|does not exist|schema cache/i.test(error.message)) {
      return [] as HandStockRow[];
    }
    throw new SalesError(error.message, "hand_list");
  }

  const rows = data || [];
  const salesIds = [...new Set(rows.map((r) => r.sales_id))];
  const productIds = [...new Set(rows.map((r) => r.product_id))];
  const products = await listProducts(db, actor.businessId);
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  const { data: staffRows } = salesIds.length
    ? await db.from("module_sales_staff").select("id, nama").in("id", salesIds)
    : { data: [] as { id: string; nama: string }[] };
  const staffMap = Object.fromEntries((staffRows || []).map((s) => [s.id, s.nama]));

  const warehouseMap: Record<string, number> = {};
  for (const id of productIds) {
    warehouseMap[id] = moneyQty(Number(productMap[id]?.stock || 0));
  }

  return rows.map((r) => ({
    salesId: r.sales_id,
    salesName: staffMap[r.sales_id] || "Sales",
    productId: r.product_id,
    productName: productMap[r.product_id]?.name || "Produk",
    qty: moneyQty(Number(r.qty || 0)),
    warehouseStock: warehouseMap[r.product_id] || 0,
  })) as HandStockRow[];
}

export async function listStockIssues(db: SalesDb, actor: Actor, limit = 30) {
  if (actor.role === "SALES") throw new ForbiddenError();
  const { data, error } = await db
    .from("module_sales_stock_issues")
    .select("id, sales_id, product_id, qty, direction, note, created_at")
    .eq("business_id", actor.businessId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (/module_sales_stock_issues|does not exist|schema cache/i.test(error.message)) {
      return [] as StockIssueRow[];
    }
    throw new SalesError(error.message, "issue_list");
  }

  const rows = data || [];
  const salesIds = [...new Set(rows.map((r) => r.sales_id))];
  const products = await listProducts(db, actor.businessId);
  const productMap = Object.fromEntries(products.map((p) => [p.id, p.name]));
  const { data: staffRows } = salesIds.length
    ? await db.from("module_sales_staff").select("id, nama").in("id", salesIds)
    : { data: [] as { id: string; nama: string }[] };
  const staffMap = Object.fromEntries((staffRows || []).map((s) => [s.id, s.nama]));

  return rows.map((r) => ({
    id: r.id,
    salesId: r.sales_id,
    salesName: staffMap[r.sales_id] || "Sales",
    productId: r.product_id,
    productName: productMap[r.product_id] || "Produk",
    qty: moneyQty(Number(r.qty || 0)),
    direction: r.direction as "issue" | "return",
    note: r.note,
    createdAt: r.created_at,
  })) as StockIssueRow[];
}
