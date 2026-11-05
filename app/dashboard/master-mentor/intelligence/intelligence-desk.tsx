"use client";

import { useEffect, useMemo, useState } from "react";
import type { MentorPortfolioBusiness } from "@/lib/master-mentor/types";
import PhaseBanner from "../components/phase-banner";
import SectionCard from "../components/section-card";

type ModuleName =
  | "performance"
  | "financial"
  | "growth"
  | "people"
  | "inventory"
  | "risk"
  | "comparison"
  | "report";

const PERIODS = [
  { id: "today", label: "Hari ini" },
  { id: "yesterday", label: "Kemarin" },
  { id: "last_7_days", label: "7 hari" },
  { id: "last_30_days", label: "30 hari" },
  { id: "this_month", label: "Bulan ini" },
  { id: "last_month", label: "Bulan lalu" },
  { id: "custom", label: "Custom" },
] as const;

function money(n: unknown) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(v);
}

function pct(n: unknown) {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return "—";
  return `${v.toFixed(1)}%`;
}

export default function IntelligenceDesk({
  module,
  title,
  subtitle,
  portfolio,
}: {
  module: ModuleName;
  title: string;
  subtitle: string;
  portfolio: MentorPortfolioBusiness[];
}) {
  const linked = useMemo(() => portfolio.filter((p) => p.gercep_business_id), [portfolio]);
  const [businessId, setBusinessId] = useState(linked[0]?.id || portfolio[0]?.id || "");
  const [period, setPeriod] = useState("last_30_days");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [compareIds, setCompareIds] = useState<string[]>(linked.slice(0, 2).map((p) => p.id));
  const [reportKind, setReportKind] = useState("weekly");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ module, period });
      if (period === "custom") {
        qs.set("from", from);
        qs.set("to", to);
      }
      if (module === "comparison") {
        qs.set("businessIds", compareIds.join(","));
      } else {
        if (!businessId) throw new Error("Pilih bisnis portfolio.");
        qs.set("businessId", businessId);
      }
      if (module === "report") qs.set("kind", reportKind);
      const res = await fetch(`/api/master-mentor/intelligence?${qs}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Gagal (${res.status})`);
      setPayload(data);
    } catch (e) {
      setPayload(null);
      setError(e instanceof Error ? e.message : "Gagal memuat");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (module === "comparison" ? compareIds.length > 0 : businessId) {
      load().catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial / filter driven by button
  }, []);

  const data = (payload?.data || payload?.report || payload) as Record<string, unknown> | null;
  const alerts = (data && Array.isArray((data as { alerts?: unknown }).alerts)
    ? (data as { alerts: Record<string, unknown>[] }).alerts
    : null);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">{title}</h1>
        <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p>
      </header>

      <div className="mb-4">
        <PhaseBanner message="Phase 4 memakai data operasional Gercep yang tertaut. Angka dihitung di server — bukan dikarang AI. Metrik tanpa sumber ditandai missing." />
      </div>

      <SectionCard title="Filter" subtitle="Periode & bisnis">
        <div className="flex flex-wrap gap-3">
          {module !== "comparison" ? (
            <label className="text-xs text-[#6B7280]">
              Portfolio business
              <select
                value={businessId}
                onChange={(e) => setBusinessId(e.target.value)}
                className="mt-1 block min-w-[200px] rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
              >
                {portfolio.length === 0 ? (
                  <option value="">Belum ada portfolio</option>
                ) : (
                  portfolio.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.gercep_business_id ? "" : " (belum taut)"}
                    </option>
                  ))
                )}
              </select>
            </label>
          ) : (
            <div className="w-full">
              <p className="text-xs text-[#6B7280]">Pilih hingga 8 bisnis</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {portfolio.map((b) => {
                  const on = compareIds.includes(b.id);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() =>
                        setCompareIds((prev) =>
                          on ? prev.filter((x) => x !== b.id) : [...prev, b.id].slice(0, 8),
                        )
                      }
                      className={[
                        "rounded-lg border px-3 py-1.5 text-xs font-medium",
                        on
                          ? "border-[#111827] bg-[#111827] text-white"
                          : "border-[#E5E7EB] text-[#4B5563]",
                      ].join(" ")}
                    >
                      {b.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <label className="text-xs text-[#6B7280]">
            Periode
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="mt-1 block rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
            >
              {PERIODS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          {period === "custom" ? (
            <>
              <label className="text-xs text-[#6B7280]">
                From
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-1 block rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs text-[#6B7280]">
                To
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-1 block rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                />
              </label>
            </>
          ) : null}

          {module === "report" ? (
            <label className="text-xs text-[#6B7280]">
              Jenis laporan
              <select
                value={reportKind}
                onChange={(e) => setReportKind(e.target.value)}
                className="mt-1 block rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="financial">Financial</option>
                <option value="risk">Risk</option>
              </select>
            </label>
          ) : null}

          <div className="flex items-end">
            <button
              type="button"
              onClick={load}
              disabled={busy}
              className="rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {busy ? "Memuat…" : "Terapkan"}
            </button>
          </div>
        </div>
      </SectionCard>

      {error ? (
        <div className="mt-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
          {error}
        </div>
      ) : null}

      {payload && module === "comparison" ? (
        <div className="mt-4 overflow-x-auto rounded-xl border border-[#E5E7EB]">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-[#F9FAFB] text-xs text-[#6B7280]">
              <tr>
                <th className="px-3 py-2">Bisnis</th>
                <th className="px-3 py-2">Revenue</th>
                <th className="px-3 py-2">Net profit</th>
                <th className="px-3 py-2">Net margin</th>
                <th className="px-3 py-2">Opex</th>
                <th className="px-3 py-2">Growth</th>
                <th className="px-3 py-2">Cap. eff.</th>
              </tr>
            </thead>
            <tbody>
              {((payload.rows as Record<string, unknown>[]) || []).map((r) => (
                <tr key={String(r.mentorBusinessId)} className="border-t border-[#F3F4F6]">
                  <td className="px-3 py-2 font-medium text-[#111827]">
                    {String(r.mentorName)}
                    {!r.linked ? (
                      <span className="ml-1 text-xs text-[#B45309]">unlinked</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{money(r.revenue)}</td>
                  <td className="px-3 py-2">{money(r.netProfit)}</td>
                  <td className="px-3 py-2">{pct(r.netMarginPct)}</td>
                  <td className="px-3 py-2">{money(r.operatingExpenses)}</td>
                  <td className="px-3 py-2">{pct(r.growthPct)}</td>
                  <td className="px-3 py-2">
                    {r.capitalEfficiency == null
                      ? "—"
                      : Number(r.capitalEfficiency).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {payload && module === "report" && payload.report ? (
        <SectionCard title={String((payload.report as { title?: string }).title || "Report")} subtitle="Export text">
          <pre className="max-h-[480px] overflow-auto whitespace-pre-wrap rounded-lg bg-[#F9FAFB] p-4 text-xs text-[#374151]">
            {String((payload.report as { exportText?: string }).exportText || "")}
          </pre>
          <button
            type="button"
            className="mt-3 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
            onClick={() => {
              const text = String((payload.report as { exportText?: string }).exportText || "");
              void navigator.clipboard?.writeText(text);
            }}
          >
            Salin ke clipboard
          </button>
        </SectionCard>
      ) : null}

      {payload && module === "risk" && alerts ? (
        <div className="mt-4 space-y-3">
          {alerts.length === 0 ? (
            <p className="text-sm text-[#6B7280]">Tidak ada alert pada periode ini.</p>
          ) : (
            alerts.map((a) => (
              <div
                key={String(a.id)}
                className="rounded-xl border border-[#E5E7EB] bg-white px-4 py-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[#111827]">{String(a.issue)}</span>
                  <span className="rounded-md bg-[#F3F4F6] px-2 py-0.5 text-[10px] uppercase text-[#6B7280]">
                    {String(a.severity)} · {String(a.kind)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#6B7280]">
                  Periode: {String(a.detectionPeriod)}
                </p>
                <p className="mt-2 text-sm text-[#374151]">
                  {(a.supportingData as string[])?.join(" · ")}
                </p>
                <p className="mt-2 text-sm text-[#111827]">
                  Rekomendasi: {String(a.recommendedAction)}
                </p>
              </div>
            ))
          )}
        </div>
      ) : null}

      {payload && data && module === "performance" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Revenue", money((data.revenue as { value?: number })?.value)],
            ["Growth", pct(data.salesGrowthPct)],
            ["Orders", String((data.orderCount as { value?: number })?.value ?? "—")],
            ["AOV", money((data.averageOrderValue as { value?: number })?.value)],
            ["Gross profit", money((data.grossProfit as { value?: number })?.value)],
            ["Net profit", money((data.netProfit as { value?: number })?.value)],
            ["Opex", money((data.operatingExpenses as { value?: number })?.value)],
            ["Conversion", (data.conversionRate as { missing?: string })?.missing || "—"],
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-xl border border-[#E5E7EB] px-4 py-3">
              <p className="text-xs text-[#6B7280]">{k}</p>
              <p className="mt-1 text-lg font-semibold text-[#111827]">{v}</p>
            </div>
          ))}
        </div>
      ) : null}

      {payload && data && module === "financial" ? (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Revenue", (data.profitAndLoss as { revenue?: { value?: number } })?.revenue?.value],
              ["Gross", (data.profitAndLoss as { grossProfit?: { value?: number } })?.grossProfit?.value],
              ["Net", (data.profitAndLoss as { netProfit?: { value?: number } })?.netProfit?.value],
              ["Gross margin", (data.grossMarginPct as { value?: number })?.value],
              ["Net margin", (data.netMarginPct as { value?: number })?.value],
              ["Cash net", (data.cashFlow as { net?: { value?: number } })?.net?.value],
            ].map(([k, v], i) => (
              <div key={String(k)} className="rounded-xl border border-[#E5E7EB] px-4 py-3">
                <p className="text-xs text-[#6B7280]">{k}</p>
                <p className="mt-1 text-lg font-semibold text-[#111827]">
                  {i >= 3 && i <= 4 ? pct(v) : money(v)}
                </p>
              </div>
            ))}
          </div>
          <SectionCard title="Expense breakdown" subtitle="Actual">
            <ul className="space-y-1 text-sm">
              {((data.expenseBreakdown as { category: string; amount: number; source: string }[]) || [])
                .slice(0, 12)
                .map((e) => (
                  <li key={e.category} className="flex justify-between gap-3 border-b border-[#F3F4F6] py-1.5">
                    <span className="text-[#374151]">
                      {e.category}{" "}
                      <span className="text-[10px] text-[#9CA3AF]">{e.source}</span>
                    </span>
                    <span className="font-medium">{money(e.amount)}</span>
                  </li>
                ))}
            </ul>
          </SectionCard>
          <p className="text-xs text-[#6B7280]">
            Forecast next period:{" "}
            {money((data.forecast as { nextPeriodRevenue?: { value?: number } })?.nextPeriodRevenue?.value)}{" "}
            (certainty: forecast)
          </p>
        </div>
      ) : null}

      {payload && data && (module === "growth" || module === "people" || module === "inventory") ? (
        <pre className="mt-4 max-h-[520px] overflow-auto rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-4 text-xs text-[#374151]">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : null}

      {payload && Array.isArray(payload.notices) && (payload.notices as string[]).length ? (
        <p className="mt-3 text-xs text-[#B45309]">{(payload.notices as string[]).join(" · ")}</p>
      ) : null}
    </div>
  );
}
