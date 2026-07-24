"use client";

import { useEffect, useState } from "react";
import type { FeatureFlags, PlatformSettingsMap } from "@/lib/admin/settings";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0F0F1A] px-3.5 py-2.5 text-sm text-[#F2F1F8]";

export default function AdminSettingsClient({ initial }: { initial: PlatformSettingsMap }) {
  const [s, setS] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [emailsText, setEmailsText] = useState(initial.admin_emails.join("\n"));

  useEffect(() => {
    setS(initial);
    setEmailsText(initial.admin_emails.join("\n"));
  }, [initial]);

  const setFlag = (key: keyof FeatureFlags, v: boolean) => {
    setS((prev) => ({ ...prev, feature_flags: { ...prev.feature_flags, [key]: v } }));
  };

  const save = async () => {
    setSaving(true);
    setMsg("");
    const admin_emails = emailsText
      .split(/[\n,]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...s,
        admin_emails,
        trial_days: Number(s.trial_days),
        event_retention_days: Number(s.event_retention_days),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMsg(data.error || "Gagal simpan");
      return;
    }
    setS(data.settings);
    setEmailsText(data.settings.admin_emails.join("\n"));
    setMsg("Tersimpan.");
  };

  const purge = async () => {
    if (!confirm("Hapus event lebih lama dari retention days?")) return;
    const res = await fetch("/api/admin/purge-events", { method: "POST" });
    const data = await res.json();
    setMsg(res.ok ? `Purge OK — deleted ${data.deleted ?? 0}` : data.error || "Gagal purge");
  };

  return (
    <div className="px-4 py-6 sm:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">Settings Server</h1>
        <p className="text-xs text-[#5A5B7A]">Kontrol perilaku platform tanpa redeploy</p>
      </div>

      <div className="grid max-w-3xl gap-4">
        <Toggle
          label="Maintenance mode"
          checked={s.maintenance_mode}
          onChange={(v) => setS({ ...s, maintenance_mode: v })}
        />
        <label className="block">
          <span className="mb-1.5 block text-xs text-[#8B8AA0]">Pesan maintenance</span>
          <input
            className={inputClass}
            value={s.maintenance_message}
            onChange={(e) => setS({ ...s, maintenance_message: e.target.value })}
          />
        </label>
        <Toggle label="Signup terbuka" checked={s.signup_open} onChange={(v) => setS({ ...s, signup_open: v })} />
        <Toggle label="Demo enabled" checked={s.demo_enabled} onChange={(v) => setS({ ...s, demo_enabled: v })} />
        <label className="block">
          <span className="mb-1.5 block text-xs text-[#8B8AA0]">Trial days</span>
          <input
            type="number"
            min={1}
            max={90}
            className={inputClass}
            value={s.trial_days}
            onChange={(e) => setS({ ...s, trial_days: Number(e.target.value) })}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-[#8B8AA0]">Payment WA (628…)</span>
          <input
            className={inputClass}
            value={s.payment_wa}
            onChange={(e) => setS({ ...s, payment_wa: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-[#8B8AA0]">Support email</span>
          <input
            className={inputClass}
            value={s.support_email}
            onChange={(e) => setS({ ...s, support_email: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-[#8B8AA0]">App URL</span>
          <input className={inputClass} value={s.app_url} onChange={(e) => setS({ ...s, app_url: e.target.value })} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-[#8B8AA0]">Admin emails (satu per baris)</span>
          <textarea
            className={inputClass + " min-h-[88px]"}
            value={emailsText}
            onChange={(e) => setEmailsText(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-[#8B8AA0]">Event retention (hari)</span>
          <input
            type="number"
            min={7}
            className={inputClass}
            value={s.event_retention_days}
            onChange={(e) => setS({ ...s, event_retention_days: Number(e.target.value) })}
          />
        </label>

        <div className="rounded-2xl border border-white/[0.08] p-4" style={{ background: "#0D0D1A" }}>
          <p className="mb-3 text-xs font-semibold tracking-wide text-[#8B8AA0] uppercase">Feature flags</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(s.feature_flags) as (keyof FeatureFlags)[]).map((k) => (
              <Toggle key={k} label={k} checked={s.feature_flags[k]} onChange={(v) => setFlag(k, v)} />
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="rounded-xl bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] px-5 py-2.5 text-sm font-semibold text-[#0A0A12] disabled:opacity-50"
          >
            {saving ? "Menyimpan…" : "Simpan settings"}
          </button>
          <button
            type="button"
            onClick={purge}
            className="rounded-xl border border-white/10 px-5 py-2.5 text-sm text-[#8B8AA0] hover:text-[#F2F1F8]"
          >
            Purge events lama
          </button>
        </div>
        {msg && <p className="text-sm text-[#2DD4BF]">{msg}</p>}
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-xl border border-white/[0.08] px-4 py-3 text-left text-sm"
      style={{ background: "#0D0D1A" }}
    >
      <span>{label}</span>
      <span className={"text-xs font-bold " + (checked ? "text-[#4ADE80]" : "text-[#5A5B7A]")}>
        {checked ? "ON" : "OFF"}
      </span>
    </button>
  );
}
