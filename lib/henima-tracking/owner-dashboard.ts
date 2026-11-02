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
  saldoPenjualan: number;
  pendingTotal: number;
  targetRevenue: number;
  targetQty: number;
  pencapaianOmzet: number;
  pencapaianPct: number;
  bonusBulan: number;
  chartDaily: { label: string; ymd: string; omzet: number }[];
  chartWeekly: { label: string; omzet: number }[];
  chartMonthly: { label: string; omzet: number }[];
  topProducts: { name: string; qty: number; kind: "afternoon" | "distance" | "other" }[];
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

export async function loadOwnerDashboardSummary(db: SalesDb, actor: Actor): Promise<OwnerDashboardSummary> {
  const today = todayWib();
  const [thisMonth, lastMonth, monthAch, targets] = await Promise.all([
    buildSalesReport(db, actor, { kind: "this_month" }),
    buildSalesReport(db, actor, { kind: "last_month" }),
    achievementFor(db, actor, "monthly"),
    listTargets(db, actor),
  ]);

  const monthlyTarget =
    targets.find((t) => t.period_type === "monthly" && !t.sales_id) ||
    targets.find((t) => t.period_type === "monthly");

  const targetRevenue = money(monthlyTarget?.revenue_target || 0);
  const targetQty = money(monthlyTarget?.quantity_target || monthAch.target || 0);
  const omzetBulan = money(thisMonth.totalRevenue);
  const pencapaianPct =
    targetRevenue > 0
      ? Math.min(999, Math.round((omzetBulan / targetRevenue) * 1000) / 10)
      : targetQty > 0
        ? Math.min(999, Math.round((monthAch.sold / targetQty) * 1000) / 10)
        : 0;

  const bonusBulan = money(thisMonth.totalCommission);

  const monthRange = periodRange("this_month");
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

  const chartDaily: OwnerDashboardSummary["chartDaily"] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const ymd = addDaysYmd(today, -i);
    chartDaily.push({
      ymd,
      label: String(Number(ymd.slice(8))),
      omzet: dayMap[ymd] || 0,
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
    chartWeekly.push({ label: `${from.slice(8)}–${to.slice(8)}`, omzet });
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
    if (i === 0) omzet = omzetBulan || omzet;
    const label = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(yr, mo - 1, 1)),
    );
    chartMonthly.push({ label, omzet });
  }

  const products = (thisMonth.byProduct || []) as { name: string; qty: number; omzet: number }[];
  const afternoon = products.find((p) => productKind(p.name) === "afternoon");
  const distance = products.find((p) => productKind(p.name) === "distance");
  const topProducts = [
    { name: afternoon?.name || "AFTERNOON", qty: afternoon?.qty || 0, kind: "afternoon" as const },
    { name: distance?.name || "THE DISTANCE", qty: distance?.qty || 0, kind: "distance" as const },
  ];

  const monthLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${today}T12:00:00+07:00`));

  return {
    monthLabel,
    omzetBulan,
    omzetBulanLalu: money(lastMonth.totalRevenue),
    botolBulan: money(thisMonth.totalQty),
    botolBulanLalu: money(lastMonth.totalQty),
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
  };
}
