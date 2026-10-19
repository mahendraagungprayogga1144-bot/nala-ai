import type { ProductRow } from "../types";
import { splitTotalAcrossLines } from "./nl-sale";
import { applyLinesToDraft, newDraft, type Draft } from "./session";

export type ShopeeShot = {
  buyer: string;
  netAmount: number;
  afternoonQty: number;
  distanceQty: number;
};

function cleanBuyer(raw: string) {
  const name = raw.replace(/\s+/g, " ").trim();
  if (!name || /^(henima|shopee|seller|pembeli|unknown|null)$/i.test(name) || /henima\.id/i.test(name)) return "";
  return name.slice(0, 80);
}

function idr(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const digits = String(value || "").replace(/\./g, "").replace(/,/g, "").replace(/[^\d]/g, "");
  return Math.round(Number(digits) || 0);
}

export function parseShopeeShotJson(raw: string): ShopeeShot | null {
  const trimmed = (raw || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const slice = trimmed.match(/\{[\s\S]*\}/)?.[0] || trimmed;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(slice) as Record<string, unknown>;
  } catch {
    return null;
  }
  const named = cleanBuyer(String(data.buyer || data.nama || ""));
  const netAmount = idr(data.net ?? data.penghasilan ?? data.amount);
  let afternoonQty = Math.max(0, Math.round(Number(data.afternoon) || 0));
  let distanceQty = Math.max(0, Math.round(Number(data.distance) || 0));
  const product = String(data.product || data.produk || "").toLowerCase();
  const jumlah = Math.max(1, Math.round(Number(data.qty || data.jumlah) || 1));
  if (!afternoonQty && /afternoon/.test(product)) afternoonQty = jumlah;
  if (!distanceQty && /distance/.test(product)) distanceQty = jumlah;
  if (netAmount < 1000 || netAmount > 50_000_000) return null;
  if (afternoonQty + distanceQty < 1 || afternoonQty > 20 || distanceQty > 20) return null;
  return { buyer: named || "Shopee", netAmount, afternoonQty, distanceQty };
}

export function shopeeDraftFromShot(shot: ShopeeShot, products: ProductRow[]): Draft | null {
  const afternoon = products.find((p) => /afternoon/i.test(p.name || ""));
  const distance = products.find((p) => /distance/i.test(p.name || ""));
  const picked: { product: ProductRow; qty: number }[] = [];
  if (shot.afternoonQty > 0 && afternoon) picked.push({ product: afternoon, qty: shot.afternoonQty });
  if (shot.distanceQty > 0 && distance) picked.push({ product: distance, qty: shot.distanceQty });
  if (!picked.length) return null;
  const prices = splitTotalAcrossLines(shot.netAmount, picked.map((row) => row.qty));
  const lines = picked.map((row, i) => ({
    productId: row.product.id,
    productName: row.product.name,
    quantity: row.qty,
    unitPrice: prices[i] || 0,
  }));
  return applyLinesToDraft(
    {
      ...newDraft(),
      customerName: shot.buyer,
      skipPhone: true,
      paymentMethod: "OTHER",
      paymentStatus: "PAID",
      notes: "Shopee",
      nlChat: true,
    },
    lines,
  );
}

export async function readShopeeScreenshot(bytes: Uint8Array, mime: string): Promise<ShopeeShot | null> {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) return null;
  const b64 = Buffer.from(bytes).toString("base64");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "deepseek-flash",
        temperature: 0,
        max_tokens: 800,
        thinking: { type: "disabled" },
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  "Baca screenshot Rincian Pesanan Shopee seller. Balas JSON saja:",
                  '{"buyer":"","net":0,"afternoon":0,"distance":0}',
                  "buyer = username pembeli di atas pesanan, bukan nama toko.",
                  "net = Estimasi Total Penghasilan, angka rupiah utuh. Bukan harga satuan, bukan subtotal pesanan, bukan ongkir.",
                  "Duo set Afternoon + The Distance dengan Jumlah 1 berarti afternoon 1 dan distance 1.",
                  "Kalau bukan pesanan Shopee, buyer kosong dan net 0.",
                ].join("\n"),
              },
              { type: "image_url", image_url: { url: `data:${mime};base64,${b64}`, detail: "high" } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      choices?: { message?: { content?: string | null; reasoning_content?: string | null } }[];
    };
    const message = body.choices?.[0]?.message;
    return parseShopeeShotJson(message?.content || message?.reasoning_content || "");
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
