"use client";

import { useEffect, useState } from "react";
import type { BankAccount, FeatureFlags, PlatformSettingsMap } from "@/lib/admin/settings";
import { DEFAULT_PLAN_PRICES, type PlanPrices } from "@/lib/payment/plans";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#0F0F1A] px-3.5 py-2.5 text-sm text-[#F2F1F8]";

export default function AdminSettingsClient({ initial }: { initial: PlatformSettingsMap }) {
  const [s, setS] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [emailsText, setEmailsText] = useState(initial.admin_emails.join("\n"));

  useEffect(() => {
    setS({
      ...initial,
      plan_prices: initial.plan_prices || { ...DEFAULT_PLAN_PRICES },
      bank_accounts: initial.bank_accounts?.length ? initial.bank_accounts : [],
    });
    setEmailsText(initial.admin_emails.join("\n"));
  }, [initial]);

  const setFlag = (key: keyof FeatureFlags, v: boolean) => {
    setS((prev) => ({ ...prev, feature_flags: { ...prev.feature_flags, [key]: v } }));
  };

  const setPrice = (key: keyof PlanPrices, value: number) => {
    setS((prev) => ({
      ...prev,
      plan_prices: { ...(prev.plan_prices || DEFAULT_PLAN_PRICES), [key]: value },
    }));
  };

  const updateBank = (idx: number, patch: Partial<BankAccount>) => {
    setS((prev) => ({
      ...prev,
      bank_accounts: prev.bank_accounts.map((a, i) => (i === idx ? { ...a, ...patch } : a)),
    }));
  };

  const addBank = () => {
    setS((prev) => ({
      ...prev,
      bank_accounts: [...prev.bank_accounts, { bank: "", number: "", holder: "" }],
    }));
  };

  const removeBank = (idx: number) => {
    setS((prev) => ({
      ...prev,
      bank_accounts: prev.bank_accounts.filter((_, i) => i !== idx),
    }));
  };

  const save = async () => {
    setSaving(true);
    setMsg("");
    const admin_emails = emailsText
      .split(/[\n,]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const bank_accounts = s.bank_accounts
      .map((a) => ({
        bank: a.bank.trim(),
        number: a.number.trim(),
        holder: a.holder.trim(),
      }))
      .filter((a) => a.bank && a.number);

    if (bank_accounts.length === 0) {
      setSaving(false);
      setMsg("Minimal 1 rekening (bank + nomor).");
      return;
    }

    const pp = s.plan_prices || DEFAULT_PLAN_PRICES;
    const plan_prices: PlanPrices = {
      starter: Number(pp.starter) || 0,
      pro: Number(pp.pro) || 0,
      enterprise: Number(pp.enterprise) || 0,
      starter_yearly: Number(pp.starter_yearly) || 0,
      pro_yearly: Number(pp.pro_yearly) || 0,
      enterprise_yearly: Number(pp.enterprise_yearly) || 0,
    };

    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...s,
        admin_emails,
        bank_accounts,
        plan_prices,
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
    setMsg("Tersimpan. Perubahan harga/WA/rekening langsung dipakai app.");
  };

  const purge = async () => {
    if (!confirm("Hapus event lebih lama dari retention days?")) return;
    const res = await fetch("/api/admin/purge-events", { method: "POST" });
    const data = await res.json();
    setMsg(res.ok ? `Purge OK — deleted ${data.deleted ?? 0}` : data.error || "Gagal purge");
  };

  const prices = s.plan_prices || DEFAULT_PLAN_PRICES;

  return (
    <div className="px-4 py-6 sm:px-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold sm:text-2xl">Settings Server</h1>
        <p className="text-xs text-[#5A5B7A]">Kontrol perilaku platform tanpa redeploy — cocok untuk stage startup</p>
      </div>

      <div className="grid max-w-3xl gap-4">
        <Section title="Operasional">
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
        </Section>

        <Section title="Pengumuman dashboard">
          <Toggle
            label="Tampilkan announcement"
            checked={s.announcement_enabled}
            onChange={(v) => setS({ ...s, announcement_enabled: v })}
          />
          <label className="block">
            <span className="mb-1.5 block text-xs text-[#8B8AA0]">Pesan</span>
            <input
              className={inputClass}
              placeholder="Contoh: Fitur baru AI Kasir sudah live"
              value={s.announcement_message}
              onChange={(e) => setS({ ...s, announcement_message: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs text-[#8B8AA0]">Link opsional (URL)</span>
            <input
              className={inputClass}
              placeholder="https://..."
              value={s.announcement_link}
              onChange={(e) => setS({ ...s, announcement_link: e.target.value })}
            />
          </label>
        </Section>

        <Section title="Pembayaran">
          <label className="block">
            <span className="mb-1.5 block text-xs text-[#8B8AA0]">Payment WA (628…)</span>
            <input
              className={inputClass}
              value={s.payment_wa}
              onChange={(e) => setS({ ...s, payment_wa: e.target.value })}
            />
          </label>

          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold tracking-wide text-[#8B8AA0] uppercase">Rekening transfer</p>
              <button
                type="button"
                onClick={addBank}
                className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-[#2DD4BF] hover:bg-white/[0.04]"
              >
                + Tambah
              </button>
            </div>
            <div className="space-y-3">
              {(s.bank_accounts || []).map((acc, idx) => (
                <div key={idx} className="grid gap-2 rounded-xl border border-white/[0.06] p-3 sm:grid-cols-3">
                  <input
                    className={inputClass}
                    placeholder="Bank / e-wallet"
                    value={acc.bank}
                    onChange={(e) => updateBank(idx, { bank: e.target.value })}
                  />
                  <input
                    className={inputClass}
                    placeholder="No. rekening"
                    value={acc.number}
                    onChange={(e) => updateBank(idx, { number: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <input
                      className={inputClass}
                      placeholder="Atas nama"
                      value={acc.holder}
                      onChange={(e) => updateBank(idx, { holder: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => removeBank(idx)}
                      className="shrink-0 rounded-xl border border-[#EC4899]/30 px-2.5 text-xs text-[#EC4899]"
                      title="Hapus"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold tracking-wide text-[#8B8AA0] uppercase">Harga paket (Rp / bulan)</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["starter", "pro", "enterprise"] as const).map((k) => (
                <label key={k} className="block">
                  <span className="mb-1 block text-[10px] uppercase text-[#5A5B7A]">{k}</span>
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={prices[k]}
                    onChange={(e) => setPrice(k, Number(e.target.value))}
                  />
                </label>
              ))}
            </div>
            <p className="mb-3 mt-4 text-xs font-semibold tracking-wide text-[#8B8AA0] uppercase">Harga tahunan (halaman Pricing)</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  ["starter_yearly", "starter /th"],
                  ["pro_yearly", "pro /th"],
                  ["enterprise_yearly", "enterprise /th"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="block">
                  <span className="mb-1 block text-[10px] uppercase text-[#5A5B7A]">{label}</span>
                  <input
                    type="number"
                    min={0}
                    className={inputClass}
                    value={prices[k]}
                    onChange={(e) => setPrice(k, Number(e.target.value))}
                  />
                </label>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Kontak & URL">
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
        </Section>

        <Section title="Data">
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
        </Section>

        <div className="rounded-2xl border border-white/[0.08] p-4" style={{ background: "#0D0D1A" }}>
          <p className="mb-3 text-xs font-semibold tracking-wide text-[#8B8AA0] uppercase">Feature flags</p>
          <p className="mb-3 text-[11px] text-[#5A5B7A]">
            OFF = sembunyikan di sidebar + blok akses URL modul.
          </p>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-3 rounded-2xl border border-white/[0.08] p-4" style={{ background: "#0D0D1A" }}>
      <p className="text-xs font-semibold tracking-wide text-[#8B8AA0] uppercase">{title}</p>
      {children}
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
      style={{ background: "#0A0A12" }}
    >
      <span>{label}</span>
      <span className={"text-xs font-bold " + (checked ? "text-[#4ADE80]" : "text-[#5A5B7A]")}>
        {checked ? "ON" : "OFF"}
      </span>
    </button>
  );
}
