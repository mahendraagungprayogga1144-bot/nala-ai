/**
 * Isi HPP/laba catatan henima_sales yang masih 0 dari modal katalog.
 * Run: npx tsx --env-file=.env.local scripts/backfill-henima-hpp.ts
 */
import { createAdminClient } from "../lib/supabase/admin";
import { SALES_ORDER_SOURCE } from "../lib/henima-sales/types";
import { backfillMissingSaleHpp } from "../lib/henima-sales/hpp";

async function main() {
  const db = createAdminClient();
  if (!db) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const { data: orders, error } = await db
    .from("orders")
    .select("business_id, hpp, order_items(hpp, product_name_snapshot, qty, product_id)")
    .eq("source", SALES_ORDER_SOURCE)
    .is("deleted_at", null);
  if (error) throw error;

  const empty = (orders || []).filter(
    (o) =>
      Number(o.hpp || 0) === 0 ||
      (o.order_items || []).some((i: { hpp?: number | null }) => Number(i.hpp || 0) === 0),
  );
  const businessIds = [...new Set(empty.map((o) => String(o.business_id)))];
  console.log(`orders missing hpp: ${empty.length} across ${businessIds.length} business`);
  for (const sample of empty.slice(0, 12)) {
    const items = (sample.order_items || []) as { product_name_snapshot?: string; qty?: number; hpp?: number }[];
    console.log(
      "  ",
      items.map((i) => `${i.product_name_snapshot} x${i.qty} hpp=${i.hpp}`).join(" | ") || "(no items)",
    );
  }

  let items = 0;
  let headers = 0;
  for (const businessId of businessIds) {
    const r = await backfillMissingSaleHpp(db, businessId);
    items += r.items;
    headers += r.orders;
    console.log(`business ${businessId}: items=${r.items} orders=${r.orders}`);
  }
  console.log(`done items=${items} orders=${headers}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
