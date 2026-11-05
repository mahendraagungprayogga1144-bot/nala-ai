/**
 * Shopee integration adapter (Phase 6).
 * Official Shopee Open Platform credentials are NOT present in this repo.
 * This interface documents requirements and refuses scrape/assumed APIs.
 */

export type ShopeeCapability = {
  available: boolean;
  status: "pending_credentials" | "configured" | "disabled";
  canPullOrders: boolean;
  canPullProducts: boolean;
  canPullInventory: boolean;
  notes: string[];
  requiredCredentials: string[];
};

export function probeShopeeCapability(): ShopeeCapability {
  const partnerId = process.env.SHOPEE_PARTNER_ID?.trim();
  const partnerKey = process.env.SHOPEE_PARTNER_KEY?.trim();
  const shopId = process.env.SHOPEE_SHOP_ID?.trim();
  const configured = Boolean(partnerId && partnerKey && shopId);

  if (!configured) {
    return {
      available: false,
      status: "pending_credentials",
      canPullOrders: false,
      canPullProducts: false,
      canPullInventory: false,
      notes: [
        "Tidak ada kredensial Shopee Open Platform di environment.",
        "Integrasi resmi membutuhkan Partner ID, Partner Key, Shop ID, dan akses API yang disetujui Shopee.",
        "Jangan gunakan scraping. CSV Marketplace / screenshot Telegram tetap jalur data manual yang sudah ada.",
      ],
      requiredCredentials: [
        "SHOPEE_PARTNER_ID",
        "SHOPEE_PARTNER_KEY",
        "SHOPEE_SHOP_ID",
        "SHOPEE_ACCESS_TOKEN (oauth)",
        "Owner approval untuk sync terjadwal",
      ],
    };
  }

  return {
    available: true,
    status: "configured",
    canPullOrders: true,
    canPullProducts: true,
    canPullInventory: false,
    notes: [
      "Kredensial terdeteksi — implementasi sync API penuh menunggu mapping endpoint resmi per region.",
      "Inventory sync tetap off sampai scope API dikonfirmasi.",
    ],
    requiredCredentials: [],
  };
}

export async function syncShopeeIfConfigured(): Promise<{
  ok: boolean;
  reason: string;
  pulled?: { orders: number; products: number };
}> {
  const cap = probeShopeeCapability();
  if (!cap.available) {
    return { ok: false, reason: "pending_credentials" };
  }
  // Placeholder: do not call unverified endpoints.
  return {
    ok: false,
    reason: "adapter_ready_awaiting_official_endpoint_mapping",
    pulled: { orders: 0, products: 0 },
  };
}
