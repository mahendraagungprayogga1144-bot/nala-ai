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

function cardQty(item: Record<string, unknown>) {
  const mark = String(item.mark || item.label || "");
  const marked = Number((mark.match(/x\s*(\d+)/i) || [])[1] || 0);
  return marked || Math.max(1, Math.round(Number(item.qty || item.jumlah) || 1));
}

function readShopeeCards(raw: unknown) {
  if (!Array.isArray(raw) || !raw.length) return null;
  let afternoonQty = 0;
  let distanceQty = 0;
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = String(row.name || row.product || row.produk || "").toLowerCase();
    const qty = cardQty(row);
    const both = /duo|paket/.test(name) || (/afternoon/.test(name) && /distance/.test(name));
    if (both) {
      afternoonQty += qty;
      distanceQty += qty;
    } else if (/distance/.test(name)) distanceQty += qty;
    else if (/afternoon/.test(name)) afternoonQty += qty;
  }
  if (afternoonQty + distanceQty < 1) return null;
  return { afternoonQty, distanceQty };
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
  const mark = String(data.mark || data.label || "");
  const marked = Number((mark.match(/x\s*(\d+)/i) || [])[1] || 0);
  const jumlah = marked || Math.max(1, Math.round(Number(data.qty || data.jumlah) || 1));
  const cards = readShopeeCards(data.items);
  const hasAfternoon = /afternoon/.test(product) || afternoonQty > 0;
  const hasDistance = /distance/.test(product) || distanceQty > 0;
  const duo = /duo|paket/.test(product) || (/afternoon/.test(product) && /distance/.test(product));
  if (cards) {
    afternoonQty = cards.afternoonQty;
    distanceQty = cards.distanceQty;
  } else if (duo) {
    const each = marked || Math.max(afternoonQty, distanceQty, 1);
    afternoonQty = each;
    distanceQty = each;
  } else if (marked > 0 && hasDistance && !hasAfternoon) {
    distanceQty = marked;
    afternoonQty = 0;
  } else if (marked > 0 && hasAfternoon && !hasDistance) {
    afternoonQty = marked;
    distanceQty = 0;
  } else {
    if (!afternoonQty && hasAfternoon) afternoonQty = jumlah;
    if (!distanceQty && hasDistance) distanceQty = jumlah;
  }
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
                  '{"buyer":"","net":0,"items":[{"name":"","mark":"x1"}]}',
                  "buyer = username pembeli, bukan nama toko.",
                  "net = Penghasilan Akhir atau Estimasi Total Penghasilan. Bukan harga satuan.",
                  "items = SEMUA kartu produk, dari atas sampai bawah. Jangan cuma kartu paling bawah.",
                  "name = judul lengkap kartu itu.",
                  "mark = tulisan kecil x1 atau x2 tepat di bawah judul kartu itu, bukan angka di judul.",
                  "Kartu Afternoon saja dengan x2 adalah satu item. Kartu The Distance saja dengan x2 adalah item lain.",
                  "Kalau ada dua kartu, Afternoon x2 dan The Distance x2, masukkan keduanya. Jangan buang yang di atas.",
                  "Satu kartu Duo, atau judul yang memuat Afternoon dan The Distance, dengan x2 tetap satu item dan namanya harus memuat kedua parfum.",
                  "Kalau bukan pesanan Shopee, net 0.",
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
