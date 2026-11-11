import { todayWib } from "@/lib/date";
import type { Actor } from "@/lib/henima-sales/types";
import type { SalesDb } from "@/lib/henima-sales/db";
import { buildSalesReport } from "@/lib/henima-sales/report-service";
import { achievementFor, listTargets } from "@/lib/henima-sales/target-service";
import { addDaysYmd, periodRange, startOfWeekMonday } from "@/lib/henima-sales/dates";
import { SALES_ORDER_SOURCE } from "@/lib/henima-sales/types";

export type OwnerDashboardSummary = {
  monthLabel: string;
  omzetBulan: number;
  omzetBulanLalu: number;
  botolBulan: number;
  botolBulanLalu: number;
  transaksiBulan: number;
  transaksiBulanLalu: number;
  saldoPenjualan: number;
  pendingTotal: number;
  targetRevenue: number;
  targetQty: number;
  pencapaianOmzet: number;
  pencapaianPct: number;
  bonusBulan: number;
  chartDaily: { label: string; ymd: string; omzet: number; target?: number }[];
  chartWeekly: { label: string; omzet: number; target?: number }[];
  chartMonthly: { label: string; omzet: number; target?: number }[];
  topProducts: { name: string; qty: number; kind: "afternoon" | "distance" | "other" }[];
  ranking: {
    salesId: string;
    nama: string;
    omzet: number;
    qty: number;
    count: number;
    target: number;
    pct: number;
  }[];
  recentSales: {
    id: string;
    salesName: string;
    customerName: string;
    productName: string;
    total: number;
    status: string;
    orderDate: string;
    createdAt: string;
  }[];
};

function money(n: number) {
  return Math.round(Number(n) || 0);
}

export function pctChange(current: number, previous: number) {
  if (!previous) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function productKind(name: string): "afternoon" | "distance" | "other" {
  const t = name.toLowerCase();
  if (t.includes("afternoon")) return "afternoon";
  if (t.includes("distance")) return "distance";
  return "other";
}

export type DashboardPeriod = "this_month" | "last_month";

export async function loadOwnerDashboardSummary(
  db: SalesDb,
  actor: Actor,
  period: DashboardPeriod = "this_month",
): Promise<OwnerDashboardSummary> {
  const today = todayWib();
  const [thisMonth, lastMonth, monthAch, targets] = await Promise.all([
    buildSalesReport(db, actor, { kind: "this_month", rankBy: "revenue" }),
    buildSalesReport(db, actor, { kind: "last_month", rankBy: "revenue" }),
    achievementFor(db, actor, "monthly"),
    listTargets(db, actor),
  ]);

  const primary = period === "last_month" ? lastMonth : thisMonth;
  const previous = period === "last_month" ? null : lastMonth;

  const monthlyTarget =
    targets.find((t) => t.period_type === "monthly" && !t.sales_id) ||
    targets.find((t) => t.period_type === "monthly");

  const targetRevenue = money(monthlyTarget?.revenue_target || 0);
  const targetQty = money(monthlyTarget?.quantity_target || monthAch.target || 0);
  const omzetBulan = money(primary.totalRevenue);
  const pencapaianPct =
    targetRevenue > 0
      ? Math.min(999, Math.round((omzetBulan / targetRevenue) * 1000) / 10)
      : targetQty > 0
        ? Math.min(999, Math.round((money(primary.totalQty) / targetQty) * 1000) / 10)
        : 0;

  const bonusBulan = money(primary.totalCommission);

  const monthRange = periodRange(period);
  const { data: pendingRows } = await db
    .from("orders")
    .select("total")
    .eq("business_id", actor.businessId)
    .eq("source", SALES_ORDER_SOURCE)
    .is("deleted_at", null)
    .eq("payment_status", "PENDING")
    .gte("order_date", monthRange.from)
    .lte("order_date", monthRange.to);
  const pendingTotal = (pendingRows || []).reduce((s, r) => s + money(r.total), 0);

  const weekStart = startOfWeekMonday(today);
  const since = addDaysYmd(today, -90);
  const { data: recentPaid } = await db
    .from("orders")
    .select("total, order_date")
    .eq("business_id", actor.businessId)
    .eq("source", SALES_ORDER_SOURCE)
    .is("deleted_at", null)
    .eq("payment_status", "PAID")
    .gte("order_date", since)
    .lte("order_date", today);

  const dayMap: Record<string, number> = {};
  for (const row of recentPaid || []) {
    dayMap[String(row.order_date)] = (dayMap[String(row.order_date)] || 0) + money(row.total);
  }

  const daysInThisMonth = Number(today.slice(8)) || 1;
  const dailyTarget =
    targetRevenue > 0 ? Math.round(targetRevenue / Math.max(28, daysInThisMonth)) : 0;

  const chartDaily: OwnerDashboardSummary["chartDaily"] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const ymd = addDaysYmd(today, -i);
    chartDaily.push({
      ymd,
      label: String(Number(ymd.slice(8))),
      omzet: dayMap[ymd] || 0,
      target: dailyTarget || undefined,
    });
  }

  const chartWeekly: OwnerDashboardSummary["chartWeekly"] = [];
  for (let w = 3; w >= 0; w -= 1) {
    const from = addDaysYmd(weekStart, -7 * w);
    const to = addDaysYmd(from, 6);
    let omzet = 0;
    for (let d = 0; d < 7; d += 1) {
      const ymd = addDaysYmd(from, d);
      if (ymd > today) break;
      omzet += dayMap[ymd] || 0;
    }
    chartWeekly.push({
      label: `${from.slice(8)}–${to.slice(8)}`,
      omzet,
      target: dailyTarget ? dailyTarget * 7 : undefined,
    });
  }

  // Last 6 calendar months from paid rows
  const chartMonthly: OwnerDashboardSummary["chartMonthly"] = [];
  const { year, month } = (() => {
    const [y, m] = today.split("-").map(Number);
    return { year: y, month: m };
  })();
  for (let i = 5; i >= 0; i -= 1) {
    let mo = month - i;
    let yr = year;
    while (mo <= 0) {
      mo += 12;
      yr -= 1;
    }
    const prefix = `${yr}-${String(mo).padStart(2, "0")}`;
    let omzet = 0;
    for (const [ymd, val] of Object.entries(dayMap)) {
      if (ymd.startsWith(prefix)) omzet += val;
    }
    // Include current/last month report totals if outside 90d window edge
    if (i === 1) omzet = money(lastMonth.totalRevenue) || omzet;
    if (i === 0) omzet = money(thisMonth.totalRevenue) || omzet;
    const label = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(yr, mo - 1, 1)),
    );
    chartMonthly.push({ label, omzet });
  }

  const products = (primary.byProduct || []) as { name: string; qty: number; omzet: number }[];
  const afternoon = products.find((p) => productKind(p.name) === "afternoon");
  const distance = products.find((p) => productKind(p.name) === "distance");
  const topProducts = [
    { name: afternoon?.name || "AFTERNOON", qty: afternoon?.qty || 0, kind: "afternoon" as const },
    { name: distance?.name || "THE DISTANCE", qty: distance?.qty || 0, kind: "distance" as const },
  ];

  const monthLabel = periodRange(period).label;

  const ranking = (primary.ranking || [])
    .filter((r) => r.salesId !== "unknown")
    .map((r) => {
      const personal =
        targets.find((t) => t.period_type === "monthly" && t.sales_id === r.salesId) || monthlyTarget;
      const goal =
        money(personal?.revenue_target || 0) ||
        (targetRevenue > 0 ? targetRevenue : money(personal?.quantity_target || targetQty || 0));
      const useRev = money(personal?.revenue_target || 0) > 0 || targetRevenue > 0;
      const value = useRev ? money(r.revenue) : money(r.qty);
      const pct = goal > 0 ? Math.min(999, Math.round((value / goal) * 1000) / 10) : 0;
      return {
        salesId: r.salesId,
        nama: r.nama,
        omzet: money(r.revenue),
        qty: money(r.qty),
        count: money(r.count),
        target: goal,
        pct,
      };
    })
    .sort((a, b) => b.omzet - a.omzet)
    .slice(0, 8);

  const { data: recentRows } = await db
    .from("orders")
    .select("id, total, payment_status, order_date, created_at, sales_id, customer_id, order_items(product_name_snapshot, qty)")
    .eq("business_id", actor.businessId)
    .eq("source", SALES_ORDER_SOURCE)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(10);

  type RecentOrderRow = {
    id: string;
    total: number;
    payment_status: string;
    order_date: string;
    created_at: string;
    sales_id: string | null;
    customer_id: string | null;
    order_items?: { product_name_snapshot?: string; qty?: number }[] | null;
  };
  const recentList = (recentRows || []) as RecentOrderRow[];
  const recentStaffIds = [...new Set(recentList.map((r) => r.sales_id).filter(Boolean))] as string[];
  const recentCustIds = [...new Set(recentList.map((r) => r.customer_id).filter(Boolean))] as string[];
  const [{ data: recentStaff }, { data: recentCust }] = await Promise.all([
    recentStaffIds.length
      ? db.from("module_sales_staff").select("id, nama").in("id", recentStaffIds)
      : Promise.resolve({ data: [] as { id: string; nama: string }[] }),
    recentCustIds.length
      ? db.from("module_crm_customers").select("id, nama").in("id", recentCustIds)
      : Promise.resolve({ data: [] as { id: string; nama: string }[] }),
  ]);
  const recentStaffMap = Object.fromEntries((recentStaff || []).map((s) => [s.id, s.nama]));
  const recentCustMap = Object.fromEntries((recentCust || []).map((c) => [c.id, c.nama]));

  const recentSales: OwnerDashboardSummary["recentSales"] = recentList.map((row) => {
    const first = row.order_items?.[0];
    const productName = first
      ? `${first.product_name_snapshot || "Produk"}${first.qty ? ` ×${first.qty}` : ""}`
      : "Penjualan";
    return {
      id: row.id,
      salesName: (row.sales_id && recentStaffMap[row.sales_id]) || "Sales",
      customerName: (row.customer_id && recentCustMap[row.customer_id]) || "Pelanggan",
      productName,
      total: money(row.total),
      status: row.payment_status || "PENDING",
      orderDate: row.order_date,
      createdAt: row.created_at,
    };
  });

  return {
    monthLabel,
    omzetBulan,
    omzetBulanLalu: money(previous?.totalRevenue || 0),
    botolBulan: money(primary.totalQty),
    botolBulanLalu: money(previous?.totalQty || 0),
    transaksiBulan: money(primary.totalOrders),
    transaksiBulanLalu: money(previous?.totalOrders || 0),
    saldoPenjualan: omzetBulan,
    pendingTotal,
    targetRevenue,
    targetQty,
    pencapaianOmzet: omzetBulan,
    pencapaianPct,
    bonusBulan,
    chartDaily,
    chartWeekly,
    chartMonthly,
    topProducts,
    ranking,
    recentSales,
  };
}
