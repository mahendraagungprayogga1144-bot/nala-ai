import type { BusinessFacts } from "./types";

export type PeopleAnalytics = {
  period: { from: string; to: string; label: string };
  headcountActive: number;
  revenuePerEmployee: number | null;
  salesPerformance: {
    salesId: string;
    name: string;
    role: string;
    orders: number;
    revenue: number;
  }[];
  attendance: {
    available: boolean;
    checkins: number;
    lateCount: number;
    notes: string[];
  };
  targetAchievement: {
    available: boolean;
    notes: string[];
  };
  missing: string[];
  notices: string[];
  caveats: string[];
};

export function buildPeopleAnalytics(facts: BusinessFacts): PeopleAnalytics {
  const missing = [...facts.missingSources];
  const notices = [...facts.notices];
  const caveats: string[] = [
    "Penilaian karyawan tidak dibuat tanpa data yang memadai.",
    "Ranking hanya dari orders.sales_id pada periode ini — bukan evaluasi HR formal.",
  ];

  const staffActive = facts.staff.filter((s) => s.status === "active");
  const headcountActive = staffActive.length || facts.staff.length;

  const bySales = new Map<
    string,
    { salesId: string; name: string; role: string; orders: number; revenue: number }
  >();
  for (const o of facts.orders) {
    if (!o.sales_id) continue;
    const staff = facts.staff.find((s) => s.id === o.sales_id);
    const cur = bySales.get(o.sales_id) || {
      salesId: o.sales_id,
      name: staff?.nama || o.sales_id.slice(0, 8),
      role: staff?.role || "unknown",
      orders: 0,
      revenue: 0,
    };
    cur.orders += 1;
    cur.revenue += o.total;
    bySales.set(o.sales_id, cur);
  }
  const salesPerformance = [...bySales.values()].sort((a, b) => b.revenue - a.revenue);
  if (!salesPerformance.length) missing.push("orders.sales_id");

  const rev = facts.orders.reduce((s, o) => s + o.total, 0);
  const revenuePerEmployee =
    headcountActive > 0 ? rev / headcountActive : null;
  if (!headcountActive) {
    missing.push("module_sales_staff");
    caveats.push("Revenue per employee tidak dihitung — tidak ada staff Henima aktif.");
  }

  const checkins = facts.trackingPoints.filter((p) =>
    /checkin/i.test(p.kind || ""),
  ).length;
  const lateCount = facts.trackingPoints.filter((p) => p.late).length;
  const attendance = {
    available: facts.trackingPoints.length > 0,
    checkins,
    lateCount,
    notes: facts.trackingPoints.length
      ? ["Attendance dari module_henima_tracking_points (check-in field)."]
      : ["Attendance tidak tersedia untuk bisnis/periode ini."],
  };
  if (!attendance.available) missing.push("attendance");

  // Targets require module_sales_targets query — not loaded in facts yet
  const targetAchievement = {
    available: false,
    notes: [
      "Sales target achievement belum dihitung di Phase 4 facts loader ini.",
      "Gunakan modul Sales Targets Gercep untuk detail target, atau Phase 4.1 untuk join module_sales_targets.",
    ],
  };
  missing.push("sales_targets");

  return {
    period: { from: facts.window.from, to: facts.window.to, label: facts.window.label },
    headcountActive,
    revenuePerEmployee,
    salesPerformance,
    attendance,
    targetAchievement,
    missing: [...new Set(missing)],
    notices,
    caveats,
  };
}
