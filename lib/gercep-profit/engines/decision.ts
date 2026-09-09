import type { DecisionResult, DecisionStatus } from "../types";

export function decide(args: {
  contribution_profit: number;
  net_profit: number;
  roas: number | null;
  be_roas: number | null;
  target_roas: number | null;
  product_name: string;
}): DecisionResult {
  if (args.contribution_profit <= 0) {
    return pack(
      "PRODUCT_NOT_PROFITABLE",
      "PRODUCT NOT PROFITABLE",
      "Product is not profitable even before advertising.",
      `${args.product_name} rugi sebelum iklan. Naikkan harga, turunkan HPP, atau potong fee/affiliate dulu. Jangan belanjakan iklan.`,
    );
  }

  const roas = args.roas;
  const be = args.be_roas;
  const target = args.target_roas;

  if (roas != null && be != null && roas < be) {
    return pack(
      "STOP",
      "STOP / LOSS",
      "Advertising cost is higher than the product's profitable threshold.",
      `ROAS aktual di bawah BE ROAS. Biaya iklan sudah memakan contribution profit. Pause campaign, turunkan CPA, atau hentikan dulu.`,
    );
  }

  if (roas != null && be != null && roas >= be && (target == null || roas < target)) {
    return pack(
      "OPTIMIZE",
      "OPTIMIZE",
      "Campaign is profitable but below the target profitability.",
      `Campaign masih profitable tetapi belum mencapai target margin. Jangan langsung menaikkan budget. Optimalkan creative dan turunkan CPA. Jika ROAS mencapai target, campaign dapat di-scale.`,
    );
  }

  if (roas != null && target != null && roas >= target && args.net_profit > 0) {
    return pack(
      "SCALE",
      "SCALE",
      "Campaign is profitable and meets the target profitability.",
      `Campaign sudah profit dan mencapai target ROAS. SCALE secara bertahap sambil jaga CPA tetap di bawah maximum ad cost.`,
    );
  }

  if (args.net_profit > 0 && (roas == null || be == null)) {
    return pack(
      "SCALE",
      "SCALE",
      "Campaign is profitable and meets the target profitability.",
      `Produk sudah menghasilkan net profit. Isi ad spend untuk mengukur ROAS vs BE ROAS sebelum scale agresif.`,
    );
  }

  return pack(
    "OPTIMIZE",
    "OPTIMIZE",
    "Campaign is profitable but below the target profitability.",
    `Angka sudah di atas titik impas iklan, tapi target profit belum tercapai. Tahan budget dan rapikan unit economics.`,
  );
}

function pack(status: DecisionStatus, label: string, message: string, recommendation: string): DecisionResult {
  return { status, label, message, recommendation };
}
