import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateProfit } from "./calculate";
import { buildDemoDashboard, demoCampaigns, henimaAfternoonInput } from "./demo";
import type { FeeRuleInput, ProfitCalcInput, ProfitCalcResult } from "./types";
import { ProfitEngineError } from "./types";
import type { ProfitActor } from "./http";

type Db = SupabaseClient;

function isMissingTable(err: { message?: string; code?: string } | null) {
  const msg = (err?.message || "").toLowerCase();
  return err?.code === "42P01" || msg.includes("does not exist") || msg.includes("schema cache");
}

export async function calculateFromBody(body: Partial<ProfitCalcInput>): Promise<ProfitCalcResult> {
  const base = henimaAfternoonInput();
  const input: ProfitCalcInput = {
    ...base,
    ...body,
    costs: { ...base.costs, ...(body.costs || {}) },
    variable: { ...base.variable, ...(body.variable || {}) },
    advertising: { ...base.advertising, ...(body.advertising || {}) },
    discounts: body.discounts ?? base.discounts,
    vouchers: body.vouchers ?? base.vouchers,
    fee_rules: body.fee_rules ?? base.fee_rules,
    affiliate_rules: body.affiliate_rules ?? base.affiliate_rules,
  };
  return calculateProfit(input);
}

export async function getProfitability(db: Db, actor: ProfitActor) {
  const live = await loadPersistedCampaigns(db, actor);
  if (live && live.length > 0) {
    const totals = calculateProfit(
      henimaAfternoonInput({
        product_name: "All Products",
        sku: "ALL",
        quantity: live.reduce((s, c) => s + c.result.quantity, 0) || 1,
        advertising: {
          ad_spend: live.reduce((s, c) => s + c.result.advertising.ad_spend, 0),
          attributed_revenue: live.reduce((s, c) => s + c.result.advertising.attributed_revenue, 0),
          ad_orders: live.reduce((s, c) => s + c.result.advertising.ad_orders, 0),
          clicks: live.reduce((s, c) => s + c.result.advertising.clicks, 0),
          impressions: live.reduce((s, c) => s + c.result.advertising.impressions, 0),
        },
        invested_capital: live.reduce((s, c) => s + c.result.invested_capital, 0),
      }),
    );
    return { source: "database" as const, campaigns: live, totals };
  }
  const demo = buildDemoDashboard();
  return { source: "demo" as const, campaigns: demo.campaigns, totals: demo.totals, daily: demo.daily };
}

export async function listFeeRules(db: Db, actor: ProfitActor): Promise<FeeRuleInput[]> {
  const { data, error } = await db
    .from("gpe_fee_rules")
    .select("*")
    .eq("business_id", actor.businessId)
    .order("effective_from", { ascending: false });
  if (error) {
    if (isMissingTable(error)) return henimaAfternoonInput().fee_rules;
    throw new ProfitEngineError(error.message);
  }
  if (!data?.length) return henimaAfternoonInput().fee_rules;
  return data.map(rowToFee);
}

export async function upsertFeeRule(db: Db, actor: ProfitActor, body: Partial<FeeRuleInput> & { id?: string }) {
  if (body.id) {
    const { data: existing } = await db
      .from("gpe_fee_rules")
      .select("id, effective_from")
      .eq("id", body.id)
      .eq("business_id", actor.businessId)
      .maybeSingle();
    if (existing) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      await db
        .from("gpe_fee_rules")
        .update({ effective_until: yesterday.toISOString().slice(0, 10), active: false })
        .eq("id", existing.id);
    }
  }
  const insert = {
    user_id: actor.userId,
    business_id: actor.businessId,
    platform: body.platform || "TikTok Shop",
    fee_name: body.fee_name || "Platform Fee",
    rate: Number(body.rate || 0),
    fixed_fee: Number(body.fixed_fee || 0),
    calculation_base: body.calculation_base || "NET_REVENUE",
    program_name: body.program_name || null,
    effective_from: body.effective_from || new Date().toISOString().slice(0, 10),
    effective_until: body.effective_until || null,
    active: body.active !== false,
  };
  const { data, error } = await db.from("gpe_fee_rules").insert(insert).select("*").single();
  if (error) {
    if (isMissingTable(error)) {
      throw new ProfitEngineError("Tabel fee rules belum dimigrasi. Jalankan migration Profit Engine.", "invalid_input", 503);
    }
    throw new ProfitEngineError(error.message);
  }
  await db.from("gpe_audit_logs").insert({
    user_id: actor.userId,
    business_id: actor.businessId,
    action: "UPSERT_FEE_RULE",
    entity: "gpe_fee_rules",
    entity_id: data.id,
    after: data,
  });
  return rowToFee(data);
}

export async function listProducts(db: Db, actor: ProfitActor) {
  const { data, error } = await db
    .from("gpe_products")
    .select("*")
    .eq("business_id", actor.businessId)
    .order("created_at", { ascending: false });
  if (error && isMissingTable(error)) {
    const demo = henimaAfternoonInput();
    return [{ id: "demo-henima", ...demo }];
  }
  if (error) throw new ProfitEngineError(error.message);
  if (!data?.length) {
    const demo = henimaAfternoonInput();
    return [{ id: "demo-henima", ...demo }];
  }
  return data;
}

export async function upsertProduct(db: Db, actor: ProfitActor, body: Record<string, unknown>) {
  const row = {
    user_id: actor.userId,
    business_id: actor.businessId,
    name: String(body.name || body.product_name || ""),
    sku: body.sku || null,
    marketplace: String(body.marketplace || "TikTok Shop"),
    selling_price: Number(body.selling_price || 0),
    target_net_margin_pct: Number(body.target_net_margin_pct || 15),
  };
  if (!row.name) throw new ProfitEngineError("Nama produk wajib.");
  const { data, error } = body.id
    ? await db.from("gpe_products").update(row).eq("id", body.id).eq("business_id", actor.businessId).select("*").single()
    : await db.from("gpe_products").insert(row).select("*").single();
  if (error) {
    if (isMissingTable(error)) throw new ProfitEngineError("Tabel produk belum dimigrasi.", "invalid_input", 503);
    throw new ProfitEngineError(error.message);
  }
  return data;
}

export async function listCampaigns(db: Db, actor: ProfitActor) {
  const live = await loadPersistedCampaigns(db, actor);
  if (live) return live;
  return demoCampaigns();
}

export async function upsertCampaign(db: Db, actor: ProfitActor, body: Record<string, unknown>) {
  const row = {
    user_id: actor.userId,
    business_id: actor.businessId,
    name: String(body.name || ""),
    marketplace: body.marketplace || null,
    product_id: body.product_id || null,
    status: body.status || "active",
    start_date: body.start_date || null,
    end_date: body.end_date || null,
  };
  if (!row.name) throw new ProfitEngineError("Nama campaign wajib.");
  const { data, error } = body.id
    ? await db.from("gpe_campaigns").update(row).eq("id", body.id).eq("business_id", actor.businessId).select("*").single()
    : await db.from("gpe_campaigns").insert(row).select("*").single();
  if (error) {
    if (isMissingTable(error)) throw new ProfitEngineError("Tabel campaign belum dimigrasi.", "invalid_input", 503);
    throw new ProfitEngineError(error.message);
  }
  return data;
}

export async function upsertAdSpend(db: Db, actor: ProfitActor, body: Record<string, unknown>) {
  const row = {
    user_id: actor.userId,
    business_id: actor.businessId,
    campaign_id: body.campaign_id || null,
    spend_date: body.spend_date || new Date().toISOString().slice(0, 10),
    ad_spend: Number(body.ad_spend || 0),
    clicks: Number(body.clicks || 0),
    impressions: Number(body.impressions || 0),
    conversions: Number(body.conversions || 0),
  };
  const { data, error } = await db.from("gpe_ad_spend").insert(row).select("*").single();
  if (error) {
    if (isMissingTable(error)) throw new ProfitEngineError("Tabel ad spend belum dimigrasi.", "invalid_input", 503);
    throw new ProfitEngineError(error.message);
  }
  return data;
}

export async function listOrders(db: Db, actor: ProfitActor) {
  const { data, error } = await db
    .from("gpe_orders")
    .select("*, gpe_order_items(*)")
    .eq("business_id", actor.businessId)
    .order("order_date", { ascending: false })
    .limit(200);
  if (error) {
    if (isMissingTable(error)) return [];
    throw new ProfitEngineError(error.message);
  }
  return data || [];
}

export async function createOrder(db: Db, actor: ProfitActor, body: Record<string, unknown>) {
  const { data, error } = await db
    .from("gpe_orders")
    .insert({
      user_id: actor.userId,
      business_id: actor.businessId,
      marketplace: body.marketplace || null,
      external_id: body.external_id || null,
      order_date: body.order_date || new Date().toISOString().slice(0, 10),
      quantity: Number(body.quantity || 1),
      selling_price: Number(body.selling_price || 0),
      status: body.status || "paid",
    })
    .select("*")
    .single();
  if (error) {
    if (isMissingTable(error)) throw new ProfitEngineError("Tabel order belum dimigrasi.", "invalid_input", 503);
    throw new ProfitEngineError(error.message);
  }
  return data;
}

async function loadPersistedCampaigns(db: Db, actor: ProfitActor) {
  const { data, error } = await db
    .from("gpe_campaigns")
    .select("*")
    .eq("business_id", actor.businessId)
    .order("created_at", { ascending: false });
  if (error || !data?.length) return null;
  const { data: spends } = await db.from("gpe_ad_spend").select("*").eq("business_id", actor.businessId);
  return data.map((c) => {
    const spendRows = (spends || []).filter((s) => s.campaign_id === c.id);
    const ad_spend = spendRows.reduce((s, r) => s + Number(r.ad_spend || 0), 0);
    const clicks = spendRows.reduce((s, r) => s + Number(r.clicks || 0), 0);
    const impressions = spendRows.reduce((s, r) => s + Number(r.impressions || 0), 0);
    const input = henimaAfternoonInput({
      product_name: c.name,
      marketplace: c.marketplace || "TikTok Shop",
      advertising: {
        ad_spend,
        attributed_revenue: 0,
        ad_orders: 1,
        clicks,
        impressions,
      },
    });
    const net = calculateProfit(input).revenue.net_revenue;
    input.advertising.attributed_revenue = net;
    const result = calculateProfit(input);
    return {
      id: c.id,
      name: c.name,
      product_name: c.name,
      sku: "",
      marketplace: c.marketplace || "TikTok Shop",
      input,
      result,
    };
  });
}

function rowToFee(row: Record<string, unknown>): FeeRuleInput {
  return {
    id: String(row.id),
    platform: String(row.platform),
    fee_name: String(row.fee_name),
    rate: Number(row.rate || 0),
    fixed_fee: Number(row.fixed_fee || 0),
    calculation_base: (row.calculation_base as FeeRuleInput["calculation_base"]) || "NET_REVENUE",
    program_name: (row.program_name as string) || null,
    effective_from: String(row.effective_from).slice(0, 10),
    effective_until: row.effective_until ? String(row.effective_until).slice(0, 10) : null,
    active: row.active !== false,
  };
}
