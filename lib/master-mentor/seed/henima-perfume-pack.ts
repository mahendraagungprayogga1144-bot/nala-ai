/**
 * Owner-confirmed starter pack for HENIMA Perfume.
 * Certainty: estimate / owner_stated — not audited accounting.
 * Stock figures from owner (Nov 2026).
 */

export const HENIMA_PACK_VERSION = "2026-11-06-v2-stock";

export const henimaOwnerMemory = {
  business_vision:
    "Membangun brand parfum HENIMA yang dikenal, punya stok sehat, dan keuangan bisnis terpisah dari kebutuhan pribadi.",
  long_term_goals:
    "Balik modal (BEP), kuasai distribusi & penjualan V1/V2, skala produksi terkontrol, brand parfum premium lokal yang sustainable.",
  communication_style:
    "Langsung, bahasa santai tapi tegas soal angka. Tidak suka motivasi kosong — minta rekomendasi yang bisa dieksekusi.",
  decision_preferences:
    "Prioritas cash & stok. Hindari ekspansi besar sebelum BEP. Keputusan besar perlu dibahas dulu dengan Mentor.",
  business_philosophy:
    "Parfum adalah aset brand + stok. Uang bisnis harus dijaga; tarik pribadi dicatat jujur supaya diagnosa cashflow akurat.",
  risk_tolerance:
    "Sedang-rendah untuk cash: boleh ambil risiko stok/produksi, tapi waspada pencampuran kas pribadi–bisnis.",
  working_preferences:
    "Pakai Gercep OS / HENIMA AI untuk operasional & mentoring. Suka update singkat berbasis fakta stok & omzet.",
};

export const henimaPortfolio = {
  name: "HENIMA Perfume",
  category: "perfume",
  description:
    "Brand parfum HENIMA — produksi lewat pabrik (batch V1 & V2), distribusi sampel & penjualan. Fokus fragrance / extrait, penjualan online & lapangan (Henima Sales).",
  status: "active",
  targets:
    "BEP stok & kas; jual sisa ~450 unit; manfaatkan V2 1400 di pabrik; pisahkan kas pribadi dari bisnis.",
  gercep_business_id: null as string | null,
};

export function henimaBusinessKnowledge(today: string) {
  return {
    name: henimaPortfolio.name,
    category: henimaPortfolio.category,
    description: henimaPortfolio.description,
    status: "active",
    targets: henimaPortfolio.targets,
    business_model:
      "Brand parfum sendiri (HENIMA). Produksi batch di pabrik → stok V1/V2 → sampel + penjualan (online/reseller/lapangan). Belum BEP; nilai tersimpan di stok.",
    products_services:
      "Parfum HENIMA (fragrance / extrait). Batch V1 dan V2. Produk dijual satuan; sampel dipakai untuk awareness & closing.",
    target_customers:
      "Pembeli parfum retail/online, reseller, dan prospek yang dikunjungi sales lapangan.",
    sales_channels:
      "Online (marketplace/WA), penjualan langsung, Henima Sales lapangan, sampel ke orang untuk trial.",
    operational_structure: [
      `Update stok owner (${today}) — estimate:`,
      "• V1 dari pabrik: 600 unit — sudah keluar sebagai sampel ke orang.",
      "• Sisa untuk penjualan: sekitar 450 unit.",
      "• V2 masih di pabrik: 1400 unit.",
      "• Dalam ~3 bulan: sekitar 143 produk sudah keluar/terjual dengan omzet ~16jt+.",
      "Produksi & gudang masih bergantung pabrik; kas bisnis tipis karena kebutuhan pribadi.",
    ].join("\n"),
    business_goals:
      "Balik modal, jaga stok V2 agar tidak idle, naikkan sell-through sisa ~450, disiplin kas bisnis vs pribadi.",
    current_challenges:
      "Belum BEP; kas bisnis tinggal ~2jt setelah omzet ~16jt+ karena tarik pribadi (rumah ~5jt + kebutuhan lain); V1 banyak ke sampel; V2 1400 masih di pabrik perlu rencana jual/release.",
  };
}

export function henimaFinancialSeeds(businessId: string, today: string) {
  const base = {
    business_id: businessId,
    currency: "IDR",
    transaction_date: today,
    data_source: "owner_entry" as const,
    certainty: "estimate" as const,
  };
  return [
    {
      ...base,
      metric_type: "revenue",
      amount: 16_000_000,
      transaction_category: "omzet_3_bulan",
      description: "Omzet ~16jt+ dalam ~3 bulan (≈143 produk keluar) — estimate owner chat",
    },
    {
      ...base,
      metric_type: "cash_balance",
      amount: 2_000_000,
      transaction_category: "saldo_kas",
      description: "Sisa uang bisnis keseluruhan ~2jt — estimate owner",
    },
    {
      ...base,
      metric_type: "operating_expenses",
      amount: 5_000_000,
      transaction_category: "owner_draw_rumah",
      description: "Tarik pribadi / bayar rumah ~5jt + kebutuhan mendadak lain — estimate",
    },
    {
      ...base,
      metric_type: "investment",
      amount: 0,
      transaction_category: "stok_v1_sampel",
      description:
        "Stok V1: 600 unit keluar dari pabrik sebagai sampel ke orang (bukan penjualan penuh) — catat sebagai konteks stok, amount 0",
    },
  ];
}

export function henimaStrategy(businessId: string) {
  return {
    business_id: businessId,
    title: "HENIMA — BEP & stok V1/V2",
    business_strategy:
      "Fokus sell-through sisa jual ~450, rencanakan release/jual V2 1400 di pabrik, hentikan kebocoran kas ke pribadi tanpa pencatatan, sampel V1 (600) dievaluasi ROI-nya.",
    short_term_targets:
      "1) Catat semua tarik pribadi. 2) Habiskan/jual sisa ~450 dengan margin sehat. 3) Hitung BEP dari stok + kas aktual.",
    medium_term_targets:
      "Release bertahap V2 1400; target kas operasional aman; saluran Shopee/WA/sales lapangan konsisten.",
    long_term_targets:
      "Brand HENIMA dikenal, produksi batch terencana, owner tidak campur kas pribadi–bisnis.",
    growth_plans:
      "Naikkan konversi dari sampel → beli; kuatkan reseller & Henima Sales; konten brand parfum.",
    expansion_plans:
      "Tidak ekspansi pabrik/batch besar sebelum BEP dan kas stabil.",
    marketing_strategies:
      "Sampel terukur (bukan gratis massal tanpa follow-up), bundling, testimoni, channel digital + lapangan.",
    operational_strategies:
      "Pantau stok V1 sampel vs sisa jual vs V2 pabrik tiap minggu; satu buku kas bisnis.",
    milestones:
      "M1 isi Financial Memory · M2 jual habis sisa ~450 · M3 rencana V2 · M4 BEP tercatat",
    status: "active",
  };
}

export function henimaDecision(businessId: string, today: string) {
  return {
    business_id: businessId,
    title: "Pisahkan kas pribadi dari kas HENIMA",
    description:
      "Omzet ada (~16jt+) tapi kas tinggal ~2jt karena kebutuhan pribadi (rumah ~5jt dll). Stok masih banyak (sisa jual ~450, V2 1400 di pabrik) jadi bisnis belum mati, tapi belum BEP.",
    reasoning:
      "Tanpa pemisahan kas, Mentor & owner tidak bisa baca kesehatan bisnis. Stok V1 600 ke sampel harus dihitung sebagai biaya pemasaran, bukan hilang begitu saja.",
    alternatives:
      "1) Lanjut campur kas (risiko tinggi). 2) Catat owner draw + target BEP (dipilih). 3) Stop sampel sampai cash recover.",
    expected_outcome:
      "Cashflow transparan; keputusan jual V2 & sisa 450 lebih rasional.",
    risks:
      "Owner draw berlanjut tanpa batas; stok V2 idle di pabrik; sampel tidak convert.",
    decision_date: today,
    status: "in_progress",
    actual_outcome: "",
    review_notes: "Diisi dari data owner Nov 2026 (chat + stok V1/V2).",
  };
}

export function henimaLearnings(businessId: string, today: string) {
  return [
    {
      business_id: businessId,
      related_decision_id: null as string | null,
      lesson:
        "Omzet tinggi tidak sama dengan kas aman — tarik pribadi & sampel besar menggerus saldo meski stok masih banyak.",
      evidence:
        "Omzet ~16jt+ / 3 bulan, kas ~2jt, rumah ~5jt; V1 600 sampel; sisa jual ~450; V2 1400 di pabrik; belum BEP.",
      source: "owner_entry",
      recorded_date: today,
    },
    {
      business_id: businessId,
      related_decision_id: null,
      lesson:
        "Stok pabrik V2 (1400) adalah aset idle sampai ada rencana release/jual — harus masuk strategi, bukan hanya angka gudang.",
      evidence: `Owner update ${today}: V2 masih 1400 di pabrik; V1 600 sudah keluar sampel.`,
      source: "owner_entry",
      recorded_date: today,
    },
  ];
}
