"use client";

import { useEffect, useState } from "react";
import PhaseBanner from "../components/phase-banner";
import SectionCard from "../components/section-card";

type View =
  | "overview"
  | "workflows"
  | "runs"
  | "alerts"
  | "sales"
  | "briefing"
  | "settings"
  | "whatsapp"
  | "shopee";

export default function AutomationDesk({
  view,
  title,
  subtitle,
}: {
  view: View;
  title: string;
  subtitle: string;
}) {
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    whatsapp_enabled: false,
    daily_briefing_enabled: true,
    weekly_review_enabled: true,
    sales_automation_enabled: true,
    shopee_enabled: false,
  });

  const load = async () => {
    setBusy(true);
    setError(null);
    try {
      const q = view === "whatsapp" || view === "shopee" ? "settings" : view;
      const res = await fetch(`/api/master-mentor/automation?view=${q}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Gagal (${res.status})`);
      setPayload(data);
      if (data.settings) {
        setSettingsForm({
          whatsapp_enabled: Boolean(data.settings.whatsapp_enabled),
          daily_briefing_enabled: data.settings.daily_briefing_enabled !== false,
          weekly_review_enabled: data.settings.weekly_review_enabled !== false,
          sales_automation_enabled: data.settings.sales_automation_enabled !== false,
          shopee_enabled: Boolean(data.settings.shopee_enabled),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const saveSettings = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/master-mentor/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "save_settings", ...settingsForm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal simpan");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  };

  const syncAlerts = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/master-mentor/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "sync_alerts" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal sync");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal");
    } finally {
      setBusy(false);
    }
  };

  const probes = (payload?.probes || {}) as {
    whatsapp?: { available?: boolean; notes?: string[]; provider?: string };
    shopee?: { available?: boolean; notes?: string[]; requiredCredentials?: string[]; status?: string };
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-[#9CA3AF] uppercase">
            Phase 6
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#111827]">{title}</h1>
          <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm disabled:opacity-40"
        >
          Refresh
        </button>
      </header>

      <div className="mb-4">
        <PhaseBanner message="Automation bersifat owner-only. Kirim WhatsApp eksternal butuh approval. Shopee resmi menunggu kredensial — tidak ada scraping. Cron memakai timezone Asia/Jakarta dengan idempotency key." />
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B]">
          {error}
        </div>
      ) : null}

      {view === "overview" && payload ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ["Workflows", String(payload.workflowCount ?? 0)],
              ["Open alerts", String(payload.openAlerts ?? 0)],
              [
                "Recent runs",
                String(Array.isArray(payload.recentRuns) ? payload.recentRuns.length : 0),
              ],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div key={k} className="rounded-xl border border-[#E5E7EB] px-4 py-3">
              <p className="text-xs text-[#6B7280]">{k}</p>
              <p className="mt-1 text-2xl font-semibold text-[#111827]">{v}</p>
            </div>
          ))}
        </div>
      ) : null}

      {(view === "settings" || view === "whatsapp" || view === "shopee") && (
        <div className="space-y-4">
          <SectionCard title="Automation toggles" subtitle="Disimpan per owner">
            <div className="space-y-2 text-sm">
              {(
                [
                  ["whatsapp_enabled", "WhatsApp owner notify / draft"],
                  ["daily_briefing_enabled", "Daily briefing (cron 08:00 WIB)"],
                  ["weekly_review_enabled", "Weekly review (Senin 09:00 WIB)"],
                  ["sales_automation_enabled", "Sales monitoring"],
                  ["shopee_enabled", "Shopee adapter (credentials required)"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(settingsForm[key])}
                    onChange={(e) =>
                      setSettingsForm((s) => ({ ...s, [key]: e.target.checked }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={saveSettings}
              disabled={busy}
              className="mt-3 rounded-lg bg-[#111827] px-3 py-2 text-sm text-white disabled:opacity-40"
            >
              Simpan
            </button>
          </SectionCard>

          {view !== "shopee" ? (
            <SectionCard title="WhatsApp probe" subtitle="Official path only">
              <p className="text-sm text-[#374151]">
                Provider: {probes.whatsapp?.provider || "—"} · available={" "}
                {String(probes.whatsapp?.available)}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#6B7280]">
                {(probes.whatsapp?.notes || []).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </SectionCard>
          ) : null}

          {view !== "whatsapp" ? (
            <SectionCard title="Shopee probe" subtitle="No scrape">
              <p className="text-sm text-[#374151]">
                Status: {probes.shopee?.status || "—"} · available={" "}
                {String(probes.shopee?.available)}
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#6B7280]">
                {(probes.shopee?.notes || []).map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              {(probes.shopee?.requiredCredentials || []).length ? (
                <p className="mt-2 text-xs text-[#B45309]">
                  Need: {(probes.shopee?.requiredCredentials || []).join(", ")}
                </p>
              ) : null}
            </SectionCard>
          ) : null}
        </div>
      )}

      {view === "alerts" ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={syncAlerts}
            disabled={busy}
            className="rounded-lg bg-[#111827] px-3 py-2 text-sm text-white disabled:opacity-40"
          >
            Sync alerts sekarang
          </button>
          <pre className="max-h-[480px] overflow-auto rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3 text-xs">
            {JSON.stringify(payload?.alerts || [], null, 2)}
          </pre>
        </div>
      ) : null}

      {view === "workflows" || view === "runs" || view === "sales" || view === "briefing" ? (
        <pre className="max-h-[560px] overflow-auto rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3 text-xs">
          {JSON.stringify(payload, null, 2)}
        </pre>
      ) : null}

      {view === "overview" && payload?.recentRuns ? (
        <div className="mt-4">
          <SectionCard title="Recent runs" subtitle="Idempotent cron history">
            <pre className="max-h-[320px] overflow-auto text-xs">
              {JSON.stringify(payload.recentRuns, null, 2)}
            </pre>
          </SectionCard>
        </div>
      ) : null}
    </div>
  );
}
