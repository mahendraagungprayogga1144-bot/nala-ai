import { createAdminClient } from "@/lib/supabase/admin";
import { FALLBACK_ADMIN_EMAIL } from "@/lib/auth/admin";
import { BANK_ACCOUNTS, PAYMENT_WA, type BankAccount } from "@/lib/payment/config";
import { DEFAULT_PLAN_PRICES, mergePlanPrices, type PlanPrices } from "@/lib/payment/plans";

export type FeatureFlags = {
  ai_kasir: boolean;
  ai_jual_beli: boolean;
  pwa_banner: boolean;
  marketplace: boolean;
  pajak: boolean;
};

export type { BankAccount, PlanPrices };

export type PlatformSettingsMap = {
  trial_days: number;
  maintenance_mode: boolean;
  maintenance_message: string;
  signup_open: boolean;
  demo_enabled: boolean;
  payment_wa: string;
  support_email: string;
  app_url: string;
  admin_emails: string[];
  bank_accounts: BankAccount[];
  plan_prices: PlanPrices;
  announcement_enabled: boolean;
  announcement_message: string;
  announcement_link: string;
  feature_flags: FeatureFlags;
  event_retention_days: number;
};

const DEFAULTS: PlatformSettingsMap = {
  trial_days: 5,
  maintenance_mode: false,
  maintenance_message: "Sedang maintenance. Coba lagi sebentar.",
  signup_open: true,
  demo_enabled: true,
  payment_wa: PAYMENT_WA,
  support_email: "hellogercepai@gmail.com",
  app_url: "https://www.gercepos.id",
  admin_emails: [FALLBACK_ADMIN_EMAIL],
  bank_accounts: BANK_ACCOUNTS.map((a) => ({ ...a })),
  plan_prices: { ...DEFAULT_PLAN_PRICES },
  announcement_enabled: false,
  announcement_message: "",
  announcement_link: "",
  feature_flags: {
    ai_kasir: true,
    ai_jual_beli: true,
    pwa_banner: true,
    marketplace: true,
    pajak: true,
  },
  event_retention_days: 90,
};

type Cache = { at: number; value: PlatformSettingsMap };
let cache: Cache | null = null;
const TTL_MS = 60_000;

function asBool(v: unknown, fallback: boolean) {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}

function asNum(v: unknown, fallback: number) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asStr(v: unknown, fallback: string) {
  return typeof v === "string" && v.length ? v : fallback;
}

function asEmails(v: unknown): string[] {
  if (Array.isArray(v)) {
    return v.map(String).map((e) => e.trim().toLowerCase()).filter(Boolean);
  }
  return [...DEFAULTS.admin_emails];
}

function asFlags(v: unknown): FeatureFlags {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return {
    ai_kasir: asBool(o.ai_kasir, true),
    ai_jual_beli: asBool(o.ai_jual_beli, true),
    pwa_banner: asBool(o.pwa_banner, true),
    marketplace: asBool(o.marketplace, true),
    pajak: asBool(o.pajak, true),
  };
}

function asBankAccounts(v: unknown): BankAccount[] {
  if (!Array.isArray(v) || v.length === 0) {
    return DEFAULTS.bank_accounts.map((a) => ({ ...a }));
  }
  const parsed = v
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const bank = asStr(o.bank, "");
      const number = asStr(o.number, "");
      const holder = asStr(o.holder, "");
      if (!bank || !number) return null;
      return { bank, number, holder };
    })
    .filter(Boolean) as BankAccount[];
  return parsed.length ? parsed : DEFAULTS.bank_accounts.map((a) => ({ ...a }));
}

function asPlanPrices(v: unknown): PlanPrices {
  if (!v || typeof v !== "object") return { ...DEFAULT_PLAN_PRICES };
  return mergePlanPrices(v as Partial<PlanPrices>);
}

function parseRows(rows: { key: string; value: unknown }[] | null): PlatformSettingsMap {
  const map = new Map((rows || []).map((r) => [r.key, r.value]));
  return {
    trial_days: asNum(map.get("trial_days"), DEFAULTS.trial_days),
    maintenance_mode: asBool(map.get("maintenance_mode"), DEFAULTS.maintenance_mode),
    maintenance_message: asStr(map.get("maintenance_message"), DEFAULTS.maintenance_message),
    signup_open: asBool(map.get("signup_open"), DEFAULTS.signup_open),
    demo_enabled: asBool(map.get("demo_enabled"), DEFAULTS.demo_enabled),
    payment_wa: asStr(map.get("payment_wa"), DEFAULTS.payment_wa),
    support_email: asStr(map.get("support_email"), DEFAULTS.support_email),
    app_url: asStr(map.get("app_url"), DEFAULTS.app_url).replace(/\/$/, ""),
    admin_emails: asEmails(map.get("admin_emails")),
    bank_accounts: asBankAccounts(map.get("bank_accounts")),
    plan_prices: asPlanPrices(map.get("plan_prices")),
    announcement_enabled: asBool(map.get("announcement_enabled"), DEFAULTS.announcement_enabled),
    announcement_message: asStr(map.get("announcement_message"), DEFAULTS.announcement_message),
    announcement_link: asStr(map.get("announcement_link"), DEFAULTS.announcement_link),
    feature_flags: asFlags(map.get("feature_flags")),
    event_retention_days: asNum(map.get("event_retention_days"), DEFAULTS.event_retention_days),
  };
}

export function getDefaultSettings() {
  return {
    ...DEFAULTS,
    admin_emails: [...DEFAULTS.admin_emails],
    bank_accounts: DEFAULTS.bank_accounts.map((a) => ({ ...a })),
    plan_prices: { ...DEFAULTS.plan_prices },
    feature_flags: { ...DEFAULTS.feature_flags },
  };
}

export function invalidateSettingsCache() {
  cache = null;
}

export async function getPlatformSettings(opts?: { force?: boolean }): Promise<PlatformSettingsMap> {
  if (!opts?.force && cache && Date.now() - cache.at < TTL_MS) {
    return cache.value;
  }

  const admin = createAdminClient();
  if (!admin) {
    const fallback = getDefaultSettings();
    cache = { at: Date.now(), value: fallback };
    return fallback;
  }

  try {
    const { data, error } = await admin.from("platform_settings").select("key, value");
    if (error) throw error;
    const value = parseRows(data as { key: string; value: unknown }[] | null);
    cache = { at: Date.now(), value };
    return value;
  } catch {
    const fallback = getDefaultSettings();
    cache = { at: Date.now(), value: fallback };
    return fallback;
  }
}

export async function upsertPlatformSettings(
  patch: Partial<Record<keyof PlatformSettingsMap, unknown>>,
  updatedBy: string,
) {
  const admin = createAdminClient();
  if (!admin) throw new Error("Service role tidak tersedia");

  const rows = Object.entries(patch).map(([key, value]) => ({
    key,
    value: value as unknown,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  }));

  const { error } = await admin.from("platform_settings").upsert(rows, { onConflict: "key" });
  if (error) throw error;
  invalidateSettingsCache();
  return getPlatformSettings({ force: true });
}
