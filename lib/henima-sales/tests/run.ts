/**
 * Henima sales unit tests. Run: npx tsx lib/henima-sales/tests/run.ts
 */
import assert from "node:assert/strict";
import { normalizePhoneId, isValidPhoneId, maskPhone, phonesMatch, isSkippedPhone } from "../phone";
import { calculateCommissionAmount, calculateOrderTotal, pickCommissionRule, isRevenueStatus, isSalesCatalogProduct, paymentLabel, paymentSplit, normalizePaymentMethod, priceAgainstRetail, discountPercentOf, DEFAULT_RETAIL_PRICE, needsRetailSync } from "../types";
import { staffScopeIds, canAccessStaff } from "../authz";
import { periodRange, startOfWeekMonday, addDaysYmd } from "../dates";
import { reduceBot } from "../telegram/fsm";
import { connectedStatusText, newDraft } from "../telegram/session";
import type { Actor } from "../types";
import { DEFAULT_SALES_BRAND, resolveSalesBrandName } from "../settings-service";
import { parseSalesChat, parseIdrAmountToken, parseOpsIntent, parsePaymentMethod, buildPackLines, splitTotalAcrossLines, extractProductQuantities, buildQtyLines, buildUnitPriceLines } from "../telegram/nl-sale";
import { salesInviteShareText, UNLINKED_MSG } from "../sales-guide";
import { splitSalesRanking, servedByLabel } from "../report-service";
import { formatNotaNumber, notaFromOrder, pdfSafe, buildSalesNotaPdf } from "../nota";
import { buildSalesReportPdf } from "../pdf";
import { brandFontBytes } from "../pdf-fonts";
import { resolveStudioPreset, resolveStudioFrame, buildBackgroundPrompt, studioOutputSize, buildSwapPrompt, resolveGeminiModel } from "../studio-presets";

let failed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log("ok ", name);
  } catch (err) {
    failed += 1;
    console.error("FAIL", name, err instanceof Error ? err.message : err);
  }
}

test("normalize 0812 and 62812 as same id", () => {
  assert.equal(normalizePhoneId("0812-3456-7890"), "6281234567890");
  assert.equal(normalizePhoneId("+62 812 3456 7890"), "6281234567890");
  assert.equal(phonesMatch("081234567890", "6281234567890"), true);
  assert.equal(isValidPhoneId("6281234567890"), true);
  assert.equal(isValidPhoneId("123"), false);
});

test("mask phone never logs full number", () => {
  const m = maskPhone("081234567890");
  assert.equal(m.includes("3456"), false);
  assert.match(m, /\*\*\*\*/);
});

test("order total server-side", () => {
  assert.equal(calculateOrderTotal(2, 199000, 0), 398000);
  assert.equal(calculateOrderTotal(1, 199000, 19000), 180000);
  assert.throws(() => calculateOrderTotal(0, 199000, 0));
  assert.throws(() => calculateOrderTotal(1, 100, 200));
});

test("pending is not revenue", () => {
  assert.equal(isRevenueStatus("PAID"), true);
  assert.equal(isRevenueStatus("PENDING"), false);
  assert.equal(isRevenueStatus("CANCELLED"), false);
});

test("commission rule specificity", () => {
  const rules = [
    { id: "1", sales_id: null, role: "SALES", product_id: null, fixed_amount: 0, percentage: 5, effective_from: "2026-01-01", effective_to: null, active: true },
    { id: "2", sales_id: "andi", role: "SALES", product_id: "p1", fixed_amount: 10000, percentage: 0, effective_from: "2026-01-01", effective_to: null, active: true },
    { id: "3", sales_id: null, role: "SALES", product_id: "p1", fixed_amount: 0, percentage: 8, effective_from: "2026-01-01", effective_to: null, active: true },
  ];
  const picked = pickCommissionRule(rules, { salesId: "andi", role: "SALES", productId: "p1", on: "2026-08-29" });
  assert.equal(picked?.id, "2");
  assert.equal(calculateCommissionAmount(398000, 10000, 0), 10000);
  assert.equal(calculateCommissionAmount(400000, 0, 5), 20000);
});

test("inactive or expired rule ignored", () => {
  const rules = [
    { id: "old", sales_id: null, role: null, product_id: null, fixed_amount: 1, percentage: 0, effective_from: "2020-01-01", effective_to: "2020-12-31", active: true },
    { id: "off", sales_id: null, role: null, product_id: null, fixed_amount: 2, percentage: 0, effective_from: "2026-01-01", effective_to: null, active: false },
    { id: "ok", sales_id: null, role: null, product_id: null, fixed_amount: 3, percentage: 0, effective_from: "2026-01-01", effective_to: null, active: true },
  ];
  const picked = pickCommissionRule(rules, { salesId: "x", role: "SALES", productId: "p", on: "2026-08-29" });
  assert.equal(picked?.id, "ok");
});

const founder: Actor = {
  staffId: "f1", businessId: "b1", businessName: "Henima", ownerUserId: "u1",
  userId: "u1", telegramUserId: 1, role: "FOUNDER", nama: "Owner", leaderId: null,
};
const leader: Actor = { ...founder, staffId: "l1", role: "LEADER", nama: "Budi", userId: "u2" };
const sales: Actor = { ...founder, staffId: "s1", role: "SALES", nama: "Andi", leaderId: "l1", userId: "u3" };

test("RBAC scope founder/leader/sales", () => {
  assert.equal(staffScopeIds(founder, ["s1"]), null);
  const leaderScope = staffScopeIds(leader, ["s1", "s2"]);
  assert.ok(leaderScope);
  assert.deepEqual([...leaderScope].sort(), ["l1", "s1", "s2"].sort());
  assert.deepEqual(staffScopeIds(sales, ["s2"]), ["s1"]);
  assert.equal(canAccessStaff(sales, "s2", []), false);
  assert.equal(canAccessStaff(leader, "s1", ["s1"]), true);
  assert.equal(canAccessStaff(founder, "s9", []), true);
});

test("period ranges are Jakarta calendar windows", () => {
  const weekStart = startOfWeekMonday("2026-08-29");
  assert.equal(weekStart, "2026-08-24");
  assert.equal(addDaysYmd("2026-08-29", -1), "2026-08-28");
  const custom = periodRange("custom", { from: "2026-08-01", to: "2026-08-31" });
  assert.equal(custom.from, "2026-08-01");
  assert.equal(custom.to, "2026-08-31");
});

test("sales brand ignores short tenant names like g", () => {
  assert.equal(resolveSalesBrandName(null, "g"), DEFAULT_SALES_BRAND);
  assert.equal(resolveSalesBrandName("", "ab"), DEFAULT_SALES_BRAND);
  assert.equal(resolveSalesBrandName("Henima Official", "g"), "Henima Official");
  assert.equal(resolveSalesBrandName(null, "Toko Besar"), "Toko Besar");
});

test("telegram /start shows module brand", () => {
  const out = reduceBot({ state: "idle", draft: newDraft() }, { kind: "command", cmd: "/start" }, { actor: founder, products: [] });
  if (out.effects[0].type === "reply") {
    assert.match(out.effects[0].reply.text, /Bisnis: Henima/);
    assert.doesNotMatch(out.effects[0].reply.text, /Bisnis: g\b/);
  }
});

test("telegram /start includes founder tagline from settings", () => {
  const withTag = { ...founder, tagline: "Parfum premium" };
  const text = connectedStatusText(withTag);
  assert.match(text, /Parfum premium/);
  assert.match(text, /Bisnis: Henima/);
});

test("invite share text includes code and how to start", () => {
  const text = salesInviteShareText({
    staffName: "Andi",
    code: "43E33258",
    brandName: "Henima Scent",
    botUsername: "henimaofficial_bot",
  });
  assert.match(text, /\/start 43E33258/);
  assert.match(text, /@henimaofficial_bot/);
  assert.match(text, /Andi/);
  assert.match(UNLINKED_MSG, /\/start KODE/);
});

test("telegram unlinked user cannot input", () => {
  const out = reduceBot({ state: "idle", draft: newDraft() }, { kind: "command", cmd: "/input" }, { actor: null, products: [] });
  assert.equal(out.effects[0].type, "reply");
  if (out.effects[0].type === "reply") {
    assert.match(out.effects[0].reply.text, /belum terdaftar/i);
    assert.match(out.effects[0].reply.text, /\/start KODE/);
  }
});

test("telegram /input starts phone collection", () => {
  const out = reduceBot({ state: "idle", draft: newDraft() }, { kind: "command", cmd: "/input" }, { actor: sales, products: [] });
  assert.equal(out.session.state, "input_phone");
  assert.ok(out.session.draft.idempotencyKey);
});

test("double confirm keeps same idempotency key until reset", () => {
  let s = reduceBot({ state: "idle", draft: newDraft() }, { kind: "command", cmd: "/input" }, { actor: sales, products: [] }).session;
  const key = s.draft.idempotencyKey;
  s = reduceBot(s, { kind: "callback", data: "confirm_yes" }, { actor: sales, products: [] }).session;
  const again = reduceBot(
    { state: "input_confirm", draft: { ...s.draft, idempotencyKey: key } },
    { kind: "callback", data: "confirm_yes" },
    { actor: sales, products: [] },
  );
  assert.equal(again.effects[0].type, "confirm_sale");
  assert.equal(key, again.session.draft.idempotencyKey || key);
});

test("product pick then quantity", () => {
  const products = [{ id: "1", name: "Afternoon", price: 199000, cost: 0, stock: 10, unit: "pcs" }];
  const out = reduceBot(
    { state: "input_product", draft: { idempotencyKey: "k" } },
    { kind: "callback", data: "p:1" },
    { actor: sales, products },
  );
  assert.equal(out.session.state, "input_qty");
  assert.equal(out.session.draft.productName, "Afternoon");
});

test("sales catalog is perfume only", () => {
  assert.equal(isSalesCatalogProduct({ name: "Es batu", category: null }), false);
  assert.equal(isSalesCatalogProduct({ name: "Samsung", category: "Elektronik" }), false);
  assert.equal(isSalesCatalogProduct({ name: "Afternoon", category: null }), true);
  assert.equal(isSalesCatalogProduct({ name: "The Distance", category: "Parfum" }), true);
  assert.equal(isSalesCatalogProduct({ name: "Rose Oud", category: "Henima Sales" }), true);
});

test("studio preset aliases and prompts", () => {
  assert.equal(resolveStudioPreset("marble"), "marble");
  assert.equal(resolveStudioPreset("Afternoon Gold"), "afternoon_gold");
  assert.equal(resolveStudioPreset("sore"), "afternoon_gold");
  assert.equal(resolveStudioPreset("The Distance"), "distance_night");
  assert.equal(resolveStudioPreset("putih"), "solid_white");
  assert.equal(resolveStudioPreset("xyz"), null);
  assert.equal(resolveStudioFrame("9:16"), "story");
  assert.equal(studioOutputSize("square"), "2000x2000");
  assert.equal(buildBackgroundPrompt("solid_white"), null);
  assert.match(buildBackgroundPrompt("marble") || "", /Carrara marble/);
  assert.match(buildBackgroundPrompt("custom", "pantai sunset") || "", /pantai sunset/);
  assert.throws(() => buildBackgroundPrompt("custom", "  "));
});

test("studio swap prompt keeps scene and names the bottle", () => {
  const p = buildSwapPrompt("Afternoon", "");
  assert.match(p, /Image 1/);
  assert.match(p, /Afternoon/);
  assert.match(p, /replace ONLY the perfume bottle/i);
  const custom = buildSwapPrompt("The Distance", "a".repeat(90));
  assert.equal(custom.length, 90);
});

test("studio gemini model picker", () => {
  assert.equal(resolveGeminiModel("pro").id, "pro");
  assert.equal(resolveGeminiModel("flash").model, "gemini-2.5-flash-image");
  assert.equal(resolveGeminiModel("pro").model, "gemini-3-pro-image-preview");
});

test("input_phone sale chat is not treated as a phone number", () => {
  const products = [{ id: "1", name: "Afternoon", price: 199000, cost: 0, stock: 10, unit: "pcs" }];
  const out = reduceBot(
    { state: "input_phone", draft: { ...newDraft(), idempotencyKey: "k" } },
    { kind: "text", text: "hari ini laku 1 harga 150rb atas nama regan no telfone 087779853453" },
    { actor: sales, products },
  );
  assert.equal(out.session.draft.nlChat, true);
  assert.equal(out.session.draft.quantity, 1);
  assert.equal(out.session.draft.unitPrice, 199000);
  assert.equal(out.session.draft.discount, 49000);
  assert.equal(out.session.draft.orderTotal, 150000);
  assert.equal(out.session.draft.phone, "6287779853453");
});

test("nl chat parses Indonesian sale message", () => {
  const msg = "hari ini laku 1 harga 150rb atas nama regan no telfone 087779853453";
  const parsed = parseSalesChat(msg, [{ id: "1", name: "Afternoon", price: 199000, cost: 0, stock: 10, unit: "pcs" }]);
  assert.equal(parsed.looksLikeSale, true);
  assert.equal(parsed.quantity, 1);
  assert.equal(parsed.unitPrice, 150000);
  assert.equal(parsed.customerName?.toLowerCase(), "regan");
  assert.equal(parsed.phone, "6287779853453");
  assert.equal(parsed.paymentMethod, null);
  assert.equal(parseIdrAmountToken("150", "rb"), 150000);
});

test("idle chat sale fills draft instead of help", () => {
  const products = [{ id: "1", name: "Afternoon", price: 199000, cost: 0, stock: 10, unit: "pcs" }];
  const out = reduceBot(
    { state: "idle", draft: newDraft() },
    { kind: "text", text: "hari ini laku 1 harga 150rb atas nama regan no telfone 087779853453" },
    { actor: sales, products },
  );
  assert.equal(out.session.state, "input_phone");
  assert.equal(out.session.draft.quantity, 1);
  assert.equal(out.session.draft.unitPrice, 199000);
  assert.equal(out.session.draft.discount, 49000);
  assert.equal(out.session.draft.orderTotal, 150000);
  assert.equal(out.session.draft.customerName?.toLowerCase(), "regan");
  assert.equal(out.session.draft.productName, "Afternoon × 1");
  assert.equal(out.session.draft.nlChat, true);
});

test("targetku per sales is a target intent", () => {
  assert.deepEqual(parseOpsIntent("target"), { type: "target" });
  assert.deepEqual(parseOpsIntent("targetku per sales berapa"), { type: "target" });
  assert.deepEqual(parseOpsIntent("sudah tercapai belum"), { type: "target" });
  const out = reduceBot(
    { state: "idle", draft: newDraft() },
    { kind: "text", text: "targetku per sales berapa" },
    { actor: sales, products: [] },
  );
  assert.equal(out.effects[0].type, "send_target");
});

test("rekapan hari ini is a rekap intent", () => {
  assert.deepEqual(parseOpsIntent("rekapan hari ini"), { type: "rekap", period: "today" });
  assert.deepEqual(parseOpsIntent("rekap minggu ini"), { type: "rekap", period: "this_week" });
  assert.deepEqual(parseOpsIntent("rekap bulan ini"), { type: "pdf", period: "this_month" });
  assert.deepEqual(parseOpsIntent("pdf bulan ini"), { type: "pdf", period: "this_month" });
  assert.deepEqual(parseOpsIntent("pdf bulanan"), { type: "pdf", period: "this_month" });
  const pdfMonth = reduceBot(
    { state: "idle", draft: newDraft() },
    { kind: "text", text: "rekapan bulan ini" },
    { actor: sales, products: [] },
  );
  assert.equal(pdfMonth.effects[0].type, "send_pdf");
  if (pdfMonth.effects[0].type === "send_pdf") assert.equal(pdfMonth.effects[0].kind, "this_month");
  const out = reduceBot(
    { state: "idle", draft: newDraft() },
    { kind: "text", text: "rekapan hari ini" },
    { actor: sales, products: [] },
  );
  assert.equal(out.effects[0].type, "send_report");
  if (out.effects[0].type === "send_report") assert.equal(out.effects[0].kind, "today");
});

test("founder closings are served-by not top sales", () => {
  const { ranking, servedBy } = splitSalesRanking([
    { salesId: "f1", nama: "ima", role: "FOUNDER", qty: 1, revenue: 150000, count: 1 },
    { salesId: "s1", nama: "Andi", role: "SALES", qty: 3, revenue: 450000, count: 2 },
  ]);
  assert.equal(ranking.length, 1);
  assert.equal(ranking[0].nama, "Andi");
  assert.equal(servedBy.length, 1);
  assert.equal(servedBy[0].nama, "ima");
  assert.equal(servedByLabel(servedBy), "Dilayani oleh ima");
  const onlyFounder = splitSalesRanking([
    { salesId: "f1", nama: "ima", role: "FOUNDER", qty: 1, revenue: 150000, count: 1 },
  ]);
  assert.equal(onlyFounder.ranking.length, 0);
  assert.equal(servedByLabel(onlyFounder.servedBy), "Dilayani oleh ima");
});

test("brand fonts load once from disk", () => {
  const a = brandFontBytes();
  const b = brandFontBytes();
  assert.ok(a && a.serif.byteLength > 1000);
  assert.equal(a, b);
});

test("nota intent and customer invoice number", () => {
  assert.deepEqual(parseOpsIntent("nota"), { type: "nota" });
  assert.deepEqual(parseOpsIntent("invoice customer"), { type: "nota" });
  assert.deepEqual(parseOpsIntent("nota regan"), { type: "nota", query: "regan" });
  assert.deepEqual(parseOpsIntent("nota untuk dimas"), { type: "nota", query: "dimas" });
  const out = reduceBot(
    { state: "idle", draft: newDraft() },
    { kind: "text", text: "nota" },
    { actor: sales, products: [] },
  );
  assert.equal(out.effects[0].type, "send_nota");
  const named = reduceBot(
    { state: "idle", draft: newDraft() },
    { kind: "text", text: "nota regan" },
    { actor: sales, products: [] },
  );
  assert.equal(named.effects[0].type, "send_nota");
  if (named.effects[0].type === "send_nota") assert.equal(named.effects[0].query, "regan");
  const cmd = reduceBot(
    { state: "idle", draft: newDraft() },
    { kind: "command", cmd: "/nota", arg: "Dimas" },
    { actor: sales, products: [] },
  );
  assert.equal(cmd.effects[0].type, "send_nota");
  if (cmd.effects[0].type === "send_nota") assert.equal(cmd.effects[0].query, "Dimas");
  assert.equal(formatNotaNumber("a1b2c3d4-e5f6-7890-abcd-ef1234567890", "2026-08-29"), "HNM-20260829-A1B2C3");
  const payload = notaFromOrder({
    order: {
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      business_id: "b1",
      customer_id: "c1",
      sales_id: "f1",
      total: 250000,
      diskon: 0,
      metode_bayar: "TRANSFER",
      payment_status: "PAID",
      catatan: "paket",
      order_date: "2026-08-29",
      created_at: "2026-08-29T00:00:00Z",
      deleted_at: null,
      source: "henima_sales",
      order_items: [
        { id: "i1", product_id: "1", qty: 2, harga_jual: 62500, product_name_snapshot: "Afternoon" },
        { id: "i2", product_id: "2", qty: 2, harga_jual: 62500, product_name_snapshot: "The Distance" },
      ],
    },
    brandName: "Henima Scent",
    customerName: "Dimas",
    customerPhone: "085965948759",
    staffName: "ima",
    staffRole: "FOUNDER",
  });
  assert.equal(payload.servedBy, "ima");
  assert.equal(payload.paymentMethod, "Transfer");
  assert.equal(payload.paymentStatus, "LUNAS");
  assert.equal(payload.lines.length, 2);
  assert.equal(payload.total, 250000);
  assert.equal(pdfSafe("Afternoon × 2"), "Afternoon x 2");
});

test("/help lists commands", () => {
  const out = reduceBot({ state: "idle", draft: newDraft() }, { kind: "command", cmd: "/help" }, { actor: sales, products: [] });
  if (out.effects[0].type === "reply") {
    assert.match(out.effects[0].reply.text, /\/input/);
    assert.match(out.effects[0].reply.text, /\/pdf/);
  }
});

const perfume = [
  { id: "1", name: "Afternoon", price: 150000, cost: 0, stock: 20, unit: "pcs" },
  { id: "2", name: "The Distance", price: 150000, cost: 0, stock: 20, unit: "pcs" },
];

test("2 paket new member fills both products and splits 250k", () => {
  const msg = "hari ini juga laku lagi 2 paket new member di harga 250k atas nama dimas no telfone 085965948759";
  const parsed = parseSalesChat(msg, perfume);
  assert.equal(parsed.looksLikeSale, true);
  assert.equal(parsed.isPack, true);
  assert.equal(parsed.quantity, 2);
  assert.equal(parsed.unitPrice, 250000);
  assert.equal(parsed.customerName?.toLowerCase(), "dimas");

  const out = reduceBot({ state: "idle", draft: newDraft() }, { kind: "text", text: msg }, { actor: sales, products: perfume });
  assert.equal(out.session.draft.lines?.length, 2);
  assert.equal(out.session.draft.packQty, 2);
  assert.equal(out.session.draft.orderTotal, 250000);
  assert.equal(out.session.draft.discount, 350000);
  assert.equal(out.session.draft.lines?.[0].quantity, 2);
  assert.equal(out.session.draft.lines?.[1].quantity, 2);
  const names = (out.session.draft.lines || []).map((l) => l.productName.toLowerCase()).sort();
  assert.deepEqual(names, ["afternoon", "the distance"]);
});

test("input_product text afternoon dan the distance asks payment then confirms", () => {
  const out = reduceBot(
    {
      state: "input_product",
      draft: {
        ...newDraft(),
        nlChat: true,
        phone: "6285965948759",
        customerName: "dimas",
        packQty: 2,
        quantity: 2,
        unitPrice: 250000,
        idempotencyKey: "k",
      },
    },
    { kind: "text", text: "afternoon dan the distance" },
    { actor: sales, products: perfume },
  );
  assert.equal(out.session.state, "input_pay_method");
  assert.equal(out.session.draft.lines?.length, 2);
  if (out.effects[0].type === "reply") {
    assert.match(out.effects[0].reply.text, /tf \/ qris \/ cash/i);
  }
  const paid = reduceBot(out.session, { kind: "text", text: "tf" }, { actor: sales, products: perfume });
  assert.equal(paid.effects[0]?.type, "confirm_sale");
  assert.equal(paid.session.draft.paymentMethod, "TRANSFER");
});

test("KEDUANYA button asks payment then QRIS confirms pack", () => {
  const out = reduceBot(
    {
      state: "input_product",
      draft: { ...newDraft(), nlChat: true, packQty: 2, unitPrice: 250000, idempotencyKey: "k" },
    },
    { kind: "callback", data: "p:ALL" },
    { actor: sales, products: perfume },
  );
  assert.equal(out.session.state, "input_pay_method");
  assert.equal(out.session.draft.lines?.length, 2);
  const paid = reduceBot(out.session, { kind: "callback", data: "pm:QRIS" }, { actor: sales, products: perfume });
  assert.equal(paid.effects[0]?.type, "confirm_sale");
  assert.equal(paid.session.draft.paymentMethod, "QRIS");
});

test("parsePaymentMethod reads tf qris cash lainnya", () => {
  assert.equal(parsePaymentMethod("tf"), "TRANSFER");
  assert.equal(parsePaymentMethod("transef"), "TRANSFER");
  assert.equal(parsePaymentMethod("qris"), "QRIS");
  assert.equal(parsePaymentMethod("cash"), "CASH");
  assert.equal(parsePaymentMethod("tunai"), "CASH");
  assert.equal(parsePaymentMethod("lainnya"), "OTHER");
  assert.equal(paymentLabel("TRANSFER"), "Transfer");
  assert.equal(paymentLabel("tunai"), "Cash");
  assert.equal(normalizePaymentMethod("tf"), "TRANSFER");
  assert.equal(paymentSplit("tunai", 150000).method, "CASH");
  assert.equal(paymentSplit("tunai", 150000).cash, 150000);
  assert.equal(paymentSplit("tf", 130000).transfer, 130000);
  assert.equal(paymentSplit("QRIS", 200000).qris, 200000);
  assert.equal(paymentSplit("CASH", 150000, "chat lama tf").cash, 150000);
  const withPay = parseSalesChat(
    "hari ini laku 1 harga 150rb atas nama regan no telfone 087779853453 tf",
    perfume,
  );
  assert.equal(withPay.paymentMethod, "TRANSFER");
  const namedTf = parseSalesChat("Laku 1 harga 130rb nama Nala tf", perfume);
  assert.equal(namedTf.customerName, "Nala");
  assert.equal(namedTf.paymentMethod, "TRANSFER");
});

test("split 250k across 2x2 lines", () => {
  const units = splitTotalAcrossLines(250000, [2, 2]);
  assert.equal(units[0] * 2 + units[1] * 2, 250000);
  const lines = buildPackLines(perfume, 2, 250000);
  assert.equal(lines.length, 2);
  assert.equal(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0), 250000);
});

test("retail 199.999 vs bayar 130.000 stores percent and potongan", () => {
  const catalog = [{ id: "1", name: "Afternoon", price: DEFAULT_RETAIL_PRICE, cost: 64500, stock: 10, unit: "pcs" }];
  const priced = priceAgainstRetail(
    [{ productId: "1", productName: "Afternoon", quantity: 1, unitPrice: 130000 }],
    catalog,
  );
  assert.equal(priced.discount, 69999);
  assert.equal(priced.discountPercent, 35);
  assert.equal(priced.lines[0].unitPrice, 199999);
  assert.equal(priced.total, 130000);
  assert.equal(discountPercentOf(199999, 69999), 35);
  const pct = priceAgainstRetail(
    [{ productId: "1", productName: "Afternoon", quantity: 1, unitPrice: 199999 }],
    catalog,
    { discountPercent: 20 },
  );
  assert.equal(pct.discount, 40000);
  assert.equal(pct.discountPercent, 20);
  assert.equal(pct.total, 159999);
});

test("parse harga 130.000 auto-diskon without explicit diskon clause", () => {
  const catalog = [{ id: "1", name: "Afternoon", price: DEFAULT_RETAIL_PRICE, cost: 64500, stock: 10, unit: "pcs" }];
  const dotted = parseSalesChat("laku 1 harga 130.000 atas nama Regan no 081234567890 tf", catalog);
  assert.equal(dotted.unitPrice, 130000);
  assert.equal(dotted.discount, null);
  const auto = priceAgainstRetail(
    [{ productId: "1", productName: "Afternoon", quantity: 1, unitPrice: dotted.unitPrice || 0 }],
    catalog,
  );
  assert.equal(auto.discount, 69999);
  assert.equal(auto.discountPercent, 35);
  assert.equal(needsRetailSync("Afternoon", 150000), true);
  assert.equal(needsRetailSync("Afternoon", 199999), false);
});

test("parse diskon 50rb and 20% without stealing harga", () => {
  const catalog = [{ id: "1", name: "Afternoon", price: 199000, cost: 80000, stock: 10, unit: "pcs" }];
  const rp = parseSalesChat("laku 1 harga 199rb diskon 50rb atas nama Sinta no 081234567890 qris", catalog);
  assert.equal(rp.unitPrice, 199000);
  assert.equal(rp.discount, 50000);
  assert.equal(rp.discountPercent, null);
  assert.equal(rp.paymentMethod, "QRIS");
  const pct = parseSalesChat("laku 1 harga 199rb diskon 20% atas nama Sinta no 081234567890 cash", catalog);
  assert.equal(pct.unitPrice, 199000);
  assert.equal(pct.discountPercent, 20);
  const cheap = parseSalesChat("laku 1 harga 150rb atas nama Regan no 081234567890 tf", catalog);
  assert.equal(cheap.discount, null);
  const auto = priceAgainstRetail(
    [{ productId: "1", productName: "Afternoon", quantity: 1, unitPrice: cheap.unitPrice || 0 }],
    catalog,
  );
  assert.equal(auto.discount, 49000);
});

test("nota infers DISKON percent and potongan from catalog retail", () => {
  const payload = notaFromOrder({
    order: {
      id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      business_id: "b1",
      customer_id: "c1",
      sales_id: "f1",
      total: 130000,
      diskon: 0,
      metode_bayar: "CASH",
      payment_status: "PAID",
      catatan: null,
      order_date: "2026-08-31",
      created_at: "2026-08-31T00:00:00Z",
      deleted_at: null,
      source: "henima_sales",
      order_items: [{ id: "i1", product_id: "1", qty: 1, harga_jual: 130000, product_name_snapshot: "Afternoon" }],
    },
    brandName: "Henima Scent",
    customerName: "Regan",
    catalog: [{ id: "1", name: "Afternoon", price: DEFAULT_RETAIL_PRICE, cost: 64500, stock: 10, unit: "pcs" }],
  });
  assert.equal(payload.discount, 69999);
  assert.equal(payload.discountPercent, 35);
  assert.equal(payload.lines[0].unitPrice, 199999);
  assert.equal(payload.total, 130000);
});

test("ga ada skips phone instead of saving it", () => {
  assert.equal(isSkippedPhone("Ga ada"), true);
  assert.equal(isSkippedPhone("tidak ada"), true);
  assert.equal(isSkippedPhone("nomer di sembuyikan"), true);
  assert.equal(isSkippedPhone("nomor disembunyikan"), true);
  const products = [
    { id: "1", name: "Afternoon", price: 199999, cost: 64500, stock: 10, unit: "pcs" },
    { id: "2", name: "The Distance", price: 199999, cost: 64500, stock: 10, unit: "pcs" },
  ];
  const asked = reduceBot(
    { state: "idle", draft: newDraft() },
    { kind: "text", text: "Laku afternoon 3 the distance 2 harga 149rb atas nama Ibu Vitha Pasma" },
    { actor: sales, products },
  );
  assert.equal(asked.session.state, "input_phone");
  assert.equal(asked.session.draft.phone, undefined);
  if (asked.effects[0].type === "reply") {
    assert.match(asked.effects[0].reply.text, /ga ada/i);
  }
  const skipped = reduceBot(asked.session, { kind: "text", text: "Ga ada" }, { actor: sales, products });
  assert.equal(skipped.session.draft.skipPhone, true);
  assert.equal(skipped.session.draft.phone, undefined);
  assert.equal(skipped.session.draft.customerName?.toLowerCase().includes("vitha"), true);
});

test("afternoon 3 the distance 2 harga 149rb is unit price times 5 bottles", () => {
  const products = [
    { id: "1", name: "Afternoon", price: 199999, cost: 64500, stock: 10, unit: "pcs" },
    { id: "2", name: "The Distance", price: 199999, cost: 64500, stock: 10, unit: "pcs" },
  ];
  const qty = extractProductQuantities("laku afternoon 3 the distance 2 harga 149rb", products);
  assert.equal(qty.get("1"), 3);
  assert.equal(qty.get("2"), 2);
  const lines = buildUnitPriceLines(products, qty, 149000);
  assert.equal(lines[0].quantity, 3);
  assert.equal(lines[1].quantity, 2);
  assert.equal(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0), 745000);
  const split = buildQtyLines(products, qty, 149000);
  assert.equal(split.reduce((s, l) => s + l.quantity * l.unitPrice, 0), 149000);
  const out = reduceBot(
    { state: "idle", draft: newDraft() },
    { kind: "text", text: "Laku afternoon 3 the distance 2 harga 149rb atas nama Ibu Vitha Pasma no 081234567890" },
    { actor: sales, products },
  );
  const afternoon = out.session.draft.lines?.find((l) => /afternoon/i.test(l.productName));
  const distance = out.session.draft.lines?.find((l) => /distance/i.test(l.productName));
  assert.equal(afternoon?.quantity, 3);
  assert.equal(distance?.quantity, 2);
  assert.equal(out.session.draft.orderTotal, 745000);
  assert.equal(out.session.draft.discount, 199999 * 5 - 745000);
});

test("english sale chat parses products qty price name phone pay", () => {
  const products = [
    { id: "1", name: "Afternoon", price: 199999, cost: 64500, stock: 10, unit: "pcs" },
    { id: "2", name: "The Distance", price: 199999, cost: 64500, stock: 10, unit: "pcs" },
  ];
  const parsed = parseSalesChat(
    "sold 3 afternoon 2 the distance price 149k for Vitha Pasma phone 081234567890 cash",
    products,
  );
  assert.equal(parsed.looksLikeSale, true);
  assert.equal(parsed.unitPrice, 149000);
  assert.equal(parsed.customerName, "Vitha Pasma");
  assert.equal(parsed.phone, "6281234567890");
  assert.equal(parsed.paymentMethod, "CASH");
  assert.ok(parsed.matchedProducts.some((p) => /afternoon/i.test(p.name)));
  assert.ok(parsed.matchedProducts.some((p) => /distance/i.test(p.name)));
  const out = reduceBot(
    { state: "idle", draft: newDraft() },
    { kind: "text", text: "sold 3 afternoon 2 distance price 149k for Vitha Pasma phone 081234567890 cash" },
    { actor: sales, products },
  );
  const afternoon = out.session.draft.lines?.find((l) => /afternoon/i.test(l.productName));
  const distance = out.session.draft.lines?.find((l) => /distance/i.test(l.productName));
  assert.equal(afternoon?.quantity, 3);
  assert.equal(distance?.quantity, 2);
  assert.equal(out.session.draft.orderTotal, 745000);
  assert.equal(out.session.draft.paymentMethod, "CASH");
  assert.equal(parseOpsIntent("recap today").type, "rekap");
  assert.equal(parseOpsIntent("history").type, "riwayat");
  assert.equal(isSkippedPhone("no number"), true);
  assert.equal(isSkippedPhone("hidden"), true);
  assert.equal(parsePaymentMethod("bank"), "TRANSFER");
  const qtyEn = extractProductQuantities("sold 3 afternoon 2 the distance price 149k", products);
  assert.equal(qtyEn.get("1"), 3);
  assert.equal(qtyEn.get("2"), 2);
  const noVerb = reduceBot(
    { state: "idle", draft: newDraft() },
    { kind: "text", text: "afternoon 3 the distance 2 149rb para Vitha phone 081234567890 cash" },
    { actor: sales, products },
  );
  assert.equal(noVerb.session.draft.orderTotal, 745000);
  assert.equal(noVerb.session.draft.customerName, "Vitha");
});

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}

const embedPayload = notaFromOrder({
  order: {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    business_id: "b1",
    customer_id: "c1",
    sales_id: "f1",
    total: 250000,
    diskon: 0,
    metode_bayar: "TRANSFER",
    payment_status: "PAID",
    catatan: "paket",
    order_date: "2026-08-29",
    created_at: "2026-08-29T00:00:00Z",
    deleted_at: null,
    source: "henima_sales",
    order_items: [
      { id: "i1", product_id: "1", qty: 2, harga_jual: 62500, product_name_snapshot: "Afternoon" },
      { id: "i2", product_id: "2", qty: 2, harga_jual: 62500, product_name_snapshot: "The Distance" },
    ],
  },
  brandName: "Henima Scent",
  tagline: "SIGNATURE SCENT",
  customerName: "adit",
  customerPhone: "081236445927",
  staffName: "ima",
  staffRole: "FOUNDER",
});

buildSalesNotaPdf(embedPayload)
  .then(async (bytes) => {
    assert.ok(bytes.byteLength > 20000, `pdf too small to contain fonts: ${bytes.byteLength}`);
    console.log("ok  nota pdf embeds custom fonts");
    const recapBytes = await buildSalesReportPdf({
      businessName: "Henima Scent",
      generatedAt: "31/08/2026 09:00",
      report: {
        range: { from: "2026-08-01", to: "2026-08-31", label: "Agustus 2026" },
        totalOrders: 2,
        pendingOrders: 0,
        cancelledOrders: 0,
        totalQty: 3,
        totalRevenue: 400000,
        aov: 200000,
        byProduct: [{ name: "Afternoon", qty: 2, omzet: 250000 }],
        byPay: { CASH: 150000, TRANSFER: 250000, QRIS: 0, OTHER: 0 },
        ranking: [{ salesId: "s1", nama: "Andi", role: "SALES", qty: 2, revenue: 250000, count: 1 }],
        servedBy: [{ salesId: "f1", nama: "ima", role: "FOUNDER", qty: 1, revenue: 150000, count: 1 }],
        byDay: { "2026-08-01": 1, "2026-08-02": 2 },
        byDayOmzet: {
          "2026-08-01": { qty: 1, cash: 150000, cashless: 0, omzet: 150000 },
          "2026-08-02": { qty: 2, cash: 0, cashless: 250000, omzet: 250000 },
        },
        lines: [
          {
            date: "2026-08-01",
            customerName: "adit",
            salesName: "ima",
            note: "The Distance",
            qty: 1,
            cash: 150000,
            transfer: 0,
            qris: 0,
            cashless: 0,
            method: "CASH",
            hpp: 75000,
            profit: 75000,
          },
          {
            date: "2026-08-02",
            customerName: "Dimas",
            salesName: "Andi",
            note: "paket",
            qty: 2,
            cash: 0,
            transfer: 250000,
            qris: 0,
            cashless: 250000,
            method: "TRANSFER",
            hpp: 125000,
            profit: 125000,
          },
        ],
        cashTotal: 150000,
        transferTotal: 250000,
        qrisTotal: 0,
        cashlessTotal: 250000,
        hppTotal: 200000,
        profitTotal: 200000,
        newCustomers: 2,
        repeatCustomers: 0,
        followSummary: {},
        testimonialCount: 0,
        totalCommission: 0,
        commissionByRole: { SALES: 0, LEADER: 0 },
      },
    });
    assert.ok(recapBytes.byteLength > 15000, `rekap pdf too small: ${recapBytes.byteLength}`);
    console.log("ok  monthly recap pdf builds");
    console.log("\nall henima sales tests passed");
  })
  .catch((err) => {
    console.error("FAIL pdf build", err instanceof Error ? err.message : err);
    process.exit(1);
  });
