import { asNumber, roundMoney } from "../money";
import type { AppliedDiscount, DiscountLine, ProfitCalcInput, RevenueResult } from "../types";

function applyLine(line: DiscountLine, gross: number): AppliedDiscount {
  const pct = asNumber(line.percentage);
  const nom = asNumber(line.amount);
  const fromPct = roundMoney((gross * pct) / 100);
  const amount_applied = roundMoney(fromPct + nom);
  const reduces = line.funded_by === "SELLER";
  return {
    name: line.name,
    funded_by: line.funded_by,
    percentage: pct,
    amount_input: nom,
    amount_applied,
    reduces_seller_revenue: reduces,
  };
}

export function computeRevenue(input: ProfitCalcInput): RevenueResult {
  const price = asNumber(input.selling_price);
  const qty = asNumber(input.quantity);
  const gross_revenue = roundMoney(price * qty);

  const discounts = [
    ...input.discounts.map((d) => applyLine(d, gross_revenue)),
    ...input.vouchers.map((d) => applyLine({ ...d, name: d.name || "Voucher" }, gross_revenue)),
  ];

  let seller_discount = 0;
  let seller_voucher = 0;
  let platform_funded_discount = 0;
  let affiliate_funded_discount = 0;
  let other_funded_discount = 0;

  for (const d of discounts) {
    if (d.funded_by === "SELLER") {
      if ((d.name || "").toLowerCase().includes("voucher")) seller_voucher += d.amount_applied;
      else seller_discount += d.amount_applied;
    } else if (d.funded_by === "PLATFORM") {
      platform_funded_discount += d.amount_applied;
    } else if (d.funded_by === "AFFILIATE") {
      affiliate_funded_discount += d.amount_applied;
    } else {
      other_funded_discount += d.amount_applied;
    }
  }

  seller_discount = roundMoney(seller_discount);
  seller_voucher = roundMoney(seller_voucher);
  const net_revenue = roundMoney(Math.max(0, gross_revenue - seller_discount - seller_voucher));

  return {
    gross_revenue,
    seller_discount,
    platform_funded_discount: roundMoney(platform_funded_discount),
    affiliate_funded_discount: roundMoney(affiliate_funded_discount),
    other_funded_discount: roundMoney(other_funded_discount),
    seller_voucher,
    net_revenue,
    discounts,
  };
}
