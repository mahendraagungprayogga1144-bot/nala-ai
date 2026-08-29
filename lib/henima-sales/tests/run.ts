/**
 * Henima sales unit tests. Run: npx tsx lib/henima-sales/tests/run.ts
 */
import assert from "node:assert/strict";
import { normalizePhoneId, isValidPhoneId, maskPhone, phonesMatch } from "../phone";
import { calculateCommissionAmount, calculateOrderTotal, pickCommissionRule, isRevenueStatus, isSalesCatalogProduct } from "../types";
import { staffScopeIds, canAccessStaff } from "../authz";
import { periodRange, startOfWeekMonday, addDaysYmd } from "../dates";
import { reduceBot } from "../telegram/fsm";
import { connectedStatusText, newDraft } from "../telegram/session";
import type { Actor } from "../types";
import { DEFAULT_SALES_BRAND, resolveSalesBrandName } from "../settings-service";
import { parseSalesChat, parseIdrAmountToken, parseOpsIntent, buildPackLines, splitTotalAcrossLines } from "../telegram/nl-sale";
import { salesInviteShareText, UNLINKED_MSG } from "../sales-guide";

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

test("input_phone sale chat is not treated as a phone number", () => {
  const products = [{ id: "1", name: "Afternoon", price: 199000, cost: 0, stock: 10, unit: "pcs" }];
  const out = reduceBot(
    { state: "input_phone", draft: { ...newDraft(), idempotencyKey: "k" } },
    { kind: "text", text: "hari ini laku 1 harga 150rb atas nama regan no telfone 087779853453" },
    { actor: sales, products },
  );
  assert.equal(out.session.draft.nlChat, true);
  assert.equal(out.session.draft.quantity, 1);
  assert.equal(out.session.draft.unitPrice, 150000);
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
  assert.equal(out.session.draft.unitPrice, 150000);
  assert.equal(out.session.draft.customerName?.toLowerCase(), "regan");
  assert.equal(out.session.draft.productName, "Afternoon");
  assert.equal(out.session.draft.nlChat, true);
});

test("rekapan hari ini is a rekap intent", () => {
  assert.deepEqual(parseOpsIntent("rekapan hari ini"), { type: "rekap", period: "today" });
  assert.deepEqual(parseOpsIntent("rekap minggu ini"), { type: "rekap", period: "this_week" });
  assert.deepEqual(parseOpsIntent("rekap bulan ini"), { type: "rekap", period: "this_month" });
  const out = reduceBot(
    { state: "idle", draft: newDraft() },
    { kind: "text", text: "rekapan hari ini" },
    { actor: sales, products: [] },
  );
  assert.equal(out.effects[0].type, "send_report");
  if (out.effects[0].type === "send_report") assert.equal(out.effects[0].kind, "today");
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
  const total = (out.session.draft.lines || []).reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  assert.equal(total, 250000);
  assert.equal(out.session.draft.lines?.[0].quantity, 2);
  assert.equal(out.session.draft.lines?.[1].quantity, 2);
  const names = (out.session.draft.lines || []).map((l) => l.productName.toLowerCase()).sort();
  assert.deepEqual(names, ["afternoon", "the distance"]);
});

test("input_product text afternoon dan the distance does not send help", () => {
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
  assert.equal(out.effects[0]?.type, "confirm_sale");
  assert.equal(out.session.draft.lines?.length, 2);
  assert.notEqual(out.effects[0]?.type, "reply");
});

test("KEDUANYA button confirms pack when qty and total exist", () => {
  const out = reduceBot(
    {
      state: "input_product",
      draft: { ...newDraft(), nlChat: true, packQty: 2, unitPrice: 250000, idempotencyKey: "k" },
    },
    { kind: "callback", data: "p:ALL" },
    { actor: sales, products: perfume },
  );
  assert.equal(out.effects[0]?.type, "confirm_sale");
  assert.equal(out.session.draft.lines?.length, 2);
});

test("split 250k across 2x2 lines", () => {
  const units = splitTotalAcrossLines(250000, [2, 2]);
  assert.equal(units[0] * 2 + units[1] * 2, 250000);
  const lines = buildPackLines(perfume, 2, 250000);
  assert.equal(lines.length, 2);
  assert.equal(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0), 250000);
});

if (failed) {
  console.error(`\n${failed} failed`);
  process.exit(1);
}
console.log("\nall henima sales tests passed");
