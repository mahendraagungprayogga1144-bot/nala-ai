"use client";

import { useMemo, useState } from "react";
import { calculateProfit } from "@/lib/gercep-profit/calculate";
import { henimaAfternoonInput } from "@/lib/gercep-profit/demo";
import { formatPct, formatRp, formatX } from "@/lib/gercep-profit/format";
import type { FundedBy, ProfitCalcInput } from "@/lib/gercep-profit/types";
import BreakdownModal from "../components/breakdown-modal";
import StatusBadge from "../components/status-badge";

const inputCls =
  "w-full rounded-xl border border-white/10 bg-[#0A0A12] px-3 py-2.5 text-sm text-[#F2F1F8] placeholder:text-[#5A5B7A] focus:border-[#D4AF37]/50 focus:outline-none";

function num(v: string) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default function CalculatorClient() {
  const [name, setName] = useState("Henima Afternoon");
  const [sku, setSku] = useState("HNM-AFT-001");
  const [marketplace, setMarketplace] = useState("TikTok Shop");
  const [price, setPrice] = useState("150000");
  const [qty, setQty] = useState("1");
  const [discPct, setDiscPct] = useState("10");
  const [discNom, setDiscNom] = useState("0");
  const [voucher, setVoucher] = useState("0");
  const [voucherBy, setVoucherBy] = useState<FundedBy>("SELLER");
  const [material, setMaterial] = useState("28000");
  const [bottle, setBottle] = useState("8500");
  const [packaging, setPackaging] = useState("7000");
  const [box, setBox] = useState("6000");
  const [label, setLabel] = useState("3500");
  const [labor, setLabor] = useState("8000");
  const [other, setOther] = useState("3500");
  const [plat, setPlat] = useState("7.5");
  const [dyn, setDyn] = useState("8");
  const [growth, setGrowth] = useState("4");
  const [affType, setAffType] = useState("STANDARD");
  const [affRate, setAffRate] = useState("10");
  const [processing, setProcessing] = useState("1250");
  const [shipping, setShipping] = useState("990");
  const [insurance, setInsurance] = useState("0");
  const [addPack, setAddPack] = useState("0");
  const [adSpend, setAdSpend] = useState("6000");
  const [target, setTarget] = useState("15");
  const [capital, setCapital] = useState("64500");
  const [open, setOpen] = useState(false);

  const input: ProfitCalcInput = useMemo(
    () =>
      henimaAfternoonInput({
        product_name: name,
        sku,
        marketplace,
        selling_price: num(price),
        quantity: Math.max(1, num(qty)),
        discounts: [
          { name: "Discount %", amount: 0, percentage: num(discPct), funded_by: "SELLER" },
          { name: "Discount Nominal", amount: num(discNom), percentage: 0, funded_by: "SELLER" },
        ],
        vouchers: num(voucher)
          ? [{ name: "Seller Voucher", amount: num(voucher), percentage: 0, funded_by: voucherBy }]
          : [],
        costs: {
          material_cost: num(material),
          bottle_cost: num(bottle),
          packaging_cost: num(packaging),
          box_cost: num(box),
          label_cost: num(label),
          labor_cost: num(labor),
          other_cost: num(other),
        },
        fee_rules: henimaAfternoonInput().fee_rules.map((r) => {
          if (r.fee_name === "Platform Fee" && r.effective_until) return { ...r, rate: num(plat) };
          if (r.fee_name === "Dynamic Commission") return { ...r, rate: num(dyn) };
          if (r.fee_name === "Growth Program") return { ...r, rate: num(growth) };
          return r;
        }),
        affiliate_rules: [
          {
            affiliate_type: affType as "STANDARD" | "STORE" | "CUSTOM",
            affiliate_name: `Affiliate ${affType}`,
            rate: num(affRate),
            calculation_base: "NET_REVENUE",
            effective_from: "2020-01-01",
            active: true,
          },
        ],
        variable: {
          processing_fee: num(processing),
          shipping_cost: num(shipping),
          insurance: num(insurance),
          additional_packaging: num(addPack),
          other_variable_cost: 0,
        },
        advertising: {
          ad_spend: num(adSpend),
          attributed_revenue: 0,
          ad_orders: Math.max(1, num(qty)),
          clicks: 42,
          impressions: 980,
        },
        target_net_margin_pct: num(target),
        invested_capital: num(capital),
      }),
    [
      name, sku, marketplace, price, qty, discPct, discNom, voucher, voucherBy,
      material, bottle, packaging, box, label, labor, other, plat, dyn, growth,
      affType, affRate, processing, shipping, insurance, addPack, adSpend, target, capital,
    ],
  );

  const computed = useMemo(() => {
    try {
      const filled = {
        ...input,
        advertising: {
          ...input.advertising,
          attributed_revenue: input.advertising.attributed_revenue || 0,
        },
      };
      const pre = calculateProfit({
        ...filled,
        advertising: { ...filled.advertising, attributed_revenue: 0, ad_spend: 0 },
      });
      filled.advertising.attributed_revenue = pre.revenue.net_revenue;
      return { result: calculateProfit(filled), error: "" };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : "Input tidak valid" };
    }
  }, [input]);
  const result = computed.result;
  const error = computed.error;

  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-4">
        <Section title="Product Info">
          <Field label="Product Name" value={name} onChange={setName} />
          <Field label="SKU" value={sku} onChange={setSku} />
          <label className="block text-xs text-[#8B8AA0]">
            Marketplace
            <select className={`${inputCls} mt-1`} value={marketplace} onChange={(e) => setMarketplace(e.target.value)}>
              <option>TikTok Shop</option>
              <option>Shopee</option>
              <option>Tokopedia</option>
              <option>Lazada</option>
            </select>
          </label>
        </Section>
        <Section title="Harga & Diskon">
          <Field label="Selling Price" value={price} onChange={setPrice} type="number" />
          <Field label="Quantity" value={qty} onChange={setQty} type="number" />
          <Field label="Discount %" value={discPct} onChange={setDiscPct} type="number" />
          <Field label="Discount Nominal" value={discNom} onChange={setDiscNom} type="number" />
          <Field label="Voucher" value={voucher} onChange={setVoucher} type="number" />
          <label className="block text-xs text-[#8B8AA0]">
            Voucher funded by
            <select className={`${inputCls} mt-1`} value={voucherBy} onChange={(e) => setVoucherBy(e.target.value as FundedBy)}>
              <option value="SELLER">SELLER — potong revenue</option>
              <option value="PLATFORM">PLATFORM — tidak potong seller</option>
              <option value="AFFILIATE">AFFILIATE</option>
              <option value="OTHER">OTHER</option>
            </select>
          </label>
        </Section>
        <Section title="Biaya Produk (HPP / COGS)">
          <Field label="Material" value={material} onChange={setMaterial} type="number" />
          <Field label="Bottle" value={bottle} onChange={setBottle} type="number" />
          <Field label="Packaging" value={packaging} onChange={setPackaging} type="number" />
          <Field label="Box" value={box} onChange={setBox} type="number" />
          <Field label="Label" value={label} onChange={setLabel} type="number" />
          <Field label="Labor" value={labor} onChange={setLabor} type="number" />
          <Field label="Other" value={other} onChange={setOther} type="number" />
          <p className="col-span-full text-xs text-[#7A7998]">
            Total HPP / unit: <span className="font-mono text-[#F4F3FB]">{formatRp(result?.cost.cogs_per_unit ?? 0)}</span>
          </p>
        </Section>
        <Section title="Marketplace Fee (configurable)">
          <Field label="Platform Fee %" value={plat} onChange={setPlat} type="number" />
          <Field label="Dynamic Commission %" value={dyn} onChange={setDyn} type="number" />
          <Field label="Growth Program %" value={growth} onChange={setGrowth} type="number" />
        </Section>
        <Section title="Affiliate">
          <label className="block text-xs text-[#8B8AA0]">
            Type
            <select className={`${inputCls} mt-1`} value={affType} onChange={(e) => setAffType(e.target.value)}>
              <option value="STANDARD">Standard</option>
              <option value="STORE">Store</option>
              <option value="CUSTOM">Custom</option>
            </select>
          </label>
          <Field label="Affiliate Rate %" value={affRate} onChange={setAffRate} type="number" />
        </Section>
        <Section title="Variable Cost">
          <Field label="Processing" value={processing} onChange={setProcessing} type="number" />
          <Field label="Shipping" value={shipping} onChange={setShipping} type="number" />
          <Field label="Insurance" value={insurance} onChange={setInsurance} type="number" />
          <Field label="Additional Packaging" value={addPack} onChange={setAddPack} type="number" />
        </Section>
        <Section title="Iklan & Target">
          <Field label="Ad Spend" value={adSpend} onChange={setAdSpend} type="number" />
          <Field label="Target Net Margin %" value={target} onChange={setTarget} type="number" />
          <Field label="Invested Capital" value={capital} onChange={setCapital} type="number" />
        </Section>
      </div>

      <aside className="h-fit rounded-2xl border border-white/[0.08] bg-[#101018] p-5 lg:sticky lg:top-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#7A7998]">Hasil Perhitungan</p>
        {error ? <p className="mt-3 text-sm text-[#FB7185]">{error}</p> : null}
        {result ? (
          <>
            <div className="mt-3">
              <StatusBadge status={result.decision.status} large />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Stat k="ROAS" v={formatX(result.advertising.roas)} />
              <Stat k="BE ROAS" v={formatX(result.be_roas)} />
              <Stat k="Target ROAS" v={formatX(result.target_roas)} />
              <Stat k="Net Revenue" v={formatRp(result.revenue.net_revenue)} />
              <Stat k="Contribution" v={formatRp(result.contribution_profit)} />
              <Stat k="Max Ad Cost" v={formatRp(result.max_ad_cost)} />
              <Stat k="Net Profit" v={formatRp(result.net_profit)} gold />
              <Stat k="Net Margin" v={formatPct(result.net_margin)} />
              <Stat k="Business ROI" v={formatPct(result.business_roi)} />
              <Stat k="Ad ROI" v={formatPct(result.ad_roi)} />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-[#B8B7C8]">{result.decision.recommendation}</p>
            {result.warnings.map((w) => (
              <p key={w} className="mt-2 text-xs text-[#FBBF24]">{w}</p>
            ))}
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-4 w-full rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 py-2.5 text-sm font-medium text-[#F5D76E]"
            >
              View Calculation
            </button>
          </>
        ) : null}
      </aside>
      {open && result ? <BreakdownModal result={result} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-[#101018] p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#7A7998]">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-xs text-[#8B8AA0]">
      {label}
      <input className={`${inputCls} mt-1`} type={type} inputMode={type === "number" ? "decimal" : undefined} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function Stat({ k, v, gold }: { k: string; v: string; gold?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[#6B6A85]">{k}</p>
      <p className={`font-mono text-sm font-semibold ${gold ? "text-[#F5D76E]" : "text-[#F4F3FB]"}`}>{v}</p>
    </div>
  );
}
