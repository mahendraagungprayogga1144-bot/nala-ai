import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import { cookies } from "next/headers";
import { todayWib } from "@/lib/date";
import { normalizeBizType } from "@/lib/auth/post-login";
import { checkoutProductSale } from "@/lib/pos/checkout-product-sale";
import { moveStock } from "@/app/dashboard/inventory/lib/typed-stock-actions";

export type ChatBiz = { id: string; type: string | null; name: string };

const COOKIE_OPTS = {
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 60 * 60 * 24 * 30,
  path: "/",
};

function fmtRp(n: number) {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}

export type ChatSession = {
  supabase: SupabaseClient;
  userId: string;
  business: ChatBiz | null;
  businesses: ChatBiz[];
  unitLabel: string;
  isPertanian: boolean;
};

export const WAVE1_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "ganti_bisnis_aktif",
    description:
      "Ganti bisnis aktif untuk chat & dashboard (cookie active_business_id). Pakai nama atau id bisnis dari list_bisnis.",
    input_schema: {
      type: "object" as const,
      properties: {
        nama_bisnis: { type: "string" },
        business_id: { type: "string" },
      },
    },
  },
  {
    name: "list_produk",
    description: "Lihat daftar produk/stok inventory bisnis aktif (atau bisnis yang disebut).",
    input_schema: {
      type: "object" as const,
      properties: {
        pencarian: { type: "string" },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "lihat_omzet_bisnis",
    description: "Ringkas omzet pemasukan/pengeluaran per bisnis (bulan ini atau semua).",
    input_schema: {
      type: "object" as const,
      properties: {
        bulan_ini: { type: "boolean", description: "Default true" },
      },
    },
  },
  {
    name: "jual_produk_kasir",
    description:
      "Jual produk dari inventory (AI Kasir / retail / apotek). Potong stok + catat order + keuangan.",
    input_schema: {
      type: "object" as const,
      properties: {
        nama_produk: { type: "string" },
        qty: { type: "number" },
        metode_bayar: { type: "string", description: "Default tunai" },
      },
      required: ["nama_produk", "qty"],
    },
  },
  {
    name: "list_karyawan",
    description: "List karyawan kasir + link /kasir/{token} untuk bisnis kuliner.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "buat_karyawan_kasir",
    description: "Tambah karyawan kasir F&B; otomatis dapat link share /kasir/{token}.",
    input_schema: {
      type: "object" as const,
      properties: {
        nama: { type: "string" },
        jabatan: { type: "string" },
      },
      required: ["nama"],
    },
  },
  {
    name: "buat_order_bengkel",
    description: "Buat antrian servis bengkel (pelanggan + kendaraan + keluhan).",
    input_schema: {
      type: "object" as const,
      properties: {
        pelanggan: { type: "string" },
        kendaraan: { type: "string" },
        keluhan: { type: "string" },
        biaya_jasa: { type: "number" },
        spare_part: { type: "string" },
      },
      required: ["pelanggan", "kendaraan"],
    },
  },
  {
    name: "update_status_bengkel",
    description:
      "Update status order bengkel: antrian|proses|selesai|batal. Saat selesai + ada biaya jasa → catat keuangan.",
    input_schema: {
      type: "object" as const,
      properties: {
        order_id: { type: "string" },
        pelanggan: { type: "string", description: "Cari order antrian/proses by nama pelanggan" },
        status: { type: "string", enum: ["antrian", "proses", "selesai", "batal"] },
      },
      required: ["status"],
    },
  },
  {
    name: "tambah_pelanggan_crm",
    description: "Tambah pelanggan ke CRM bisnis aktif.",
    input_schema: {
      type: "object" as const,
      properties: {
        nama: { type: "string" },
        telepon: { type: "string" },
        email: { type: "string" },
        alamat: { type: "string" },
        catatan: { type: "string" },
      },
      required: ["nama"],
    },
  },
  {
    name: "catat_pakan_harian",
    description:
      "Catat pemakaian pakan: potong stok produk pakan + catat pengeluaran Biaya Pakan ke keuangan.",
    input_schema: {
      type: "object" as const,
      properties: {
        nama_pakan: { type: "string" },
        qty: { type: "number", description: "Jumlah kg/sak yang dipakai" },
      },
      required: ["nama_pakan", "qty"],
    },
  },
  {
    name: "jalankan_produksi",
    description:
      "Jalankan produksi dari resep: potong bahan, tambah stok produk jadi, catat production_logs.",
    input_schema: {
      type: "object" as const,
      properties: {
        nama_resep: { type: "string" },
        qty: { type: "number", description: "Jumlah hasil produksi" },
      },
      required: ["nama_resep", "qty"],
    },
  },
  {
    name: "ganti_latar_studio",
    description:
      "Studio Henima: ganti latar foto produk parfum yang SUDAH diupload di Henima Sales → Studio. Preset: afternoon_gold, distance_night, marble, velvet, linen, solid_white, solid_cream, custom. Kalau custom, isi prompt. Jangan pakai tool ini kalau belum ada foto di Studio.",
    input_schema: {
      type: "object" as const,
      properties: {
        produk: { type: "string", description: "Afternoon, The Distance, atau latest" },
        preset: {
          type: "string",
          description: "afternoon_gold | distance_night | marble | velvet | linen | solid_white | solid_cream | custom",
        },
        prompt: { type: "string", description: "Wajib kalau preset custom. Contoh: botol di atas batu pantai sunset" },
        frame: { type: "string", enum: ["square", "portrait", "story"] },
        apply_to_catalog: { type: "boolean", description: "Tempel hasil ke foto katalog produk (founder)" },
      },
      required: ["preset"],
    },
  },
];

export async function runWave1Tool(name: string, input: Record<string, unknown>, ctx: ChatSession): Promise<string> {
  switch (name) {
    case "ganti_bisnis_aktif":
      return gantiBisnis(ctx, input);
    case "list_produk":
      return listProduk(ctx, input);
    case "lihat_omzet_bisnis":
      return lihatOmzet(ctx, input);
    case "jual_produk_kasir":
      return jualProduk(ctx, input);
    case "list_karyawan":
      return listKaryawan(ctx);
    case "buat_karyawan_kasir":
      return buatKaryawan(ctx, input);
    case "buat_order_bengkel":
      return buatOrderBengkel(ctx, input);
    case "update_status_bengkel":
      return updateStatusBengkel(ctx, input);
    case "tambah_pelanggan_crm":
      return tambahCrm(ctx, input);
    case "catat_pakan_harian":
      return catatPakan(ctx, input);
    case "jalankan_produksi":
      return jalankanProduksi(ctx, input);
    case "ganti_latar_studio":
      return gantiLatarStudio(ctx, input);
    default:
      return `Tool ${name} belum dikenal.`;
  }
}

function resolveBizByType(ctx: ChatSession, type: string): ChatBiz | null {
  const want = normalizeBizType(type);
  if (ctx.business && normalizeBizType(ctx.business.type) === want) return ctx.business;
  return ctx.businesses.find((b) => normalizeBizType(b.type) === want) || null;
}

async function gantiBisnis(ctx: ChatSession, input: Record<string, unknown>) {
  const id = typeof input.business_id === "string" ? input.business_id.trim() : "";
  const nama = typeof input.nama_bisnis === "string" ? input.nama_bisnis.trim() : "";
  let found =
    (id && ctx.businesses.find((b) => b.id === id)) ||
    (nama &&
      ctx.businesses.find(
        (b) =>
          b.name.toLowerCase() === nama.toLowerCase() ||
          b.name.toLowerCase().includes(nama.toLowerCase()),
      )) ||
    null;
  if (!found && nama) {
    const byType = ctx.businesses.find((b) => normalizeBizType(b.type) === normalizeBizType(nama));
    found = byType || null;
  }
  if (!found) return "Bisnis tidak ditemukan. Pakai list_bisnis dulu.";

  const cookieStore = await cookies();
  cookieStore.set("active_business_id", found.id, COOKIE_OPTS);
  ctx.business = found;
  return `Bisnis aktif diganti ke ${found.name} (${found.type || "-"}). Chat berikutnya pakai bisnis ini.`;
}

async function listProduk(ctx: ChatSession, input: Record<string, unknown>) {
  if (!ctx.business?.id) return "Belum ada bisnis aktif.";
  const limit = Math.min(Number(input.limit) || 30, 50);
  let q = ctx.supabase
    .from("products")
    .select("name, stock, price, cost, category")
    .eq("user_id", ctx.userId)
    .eq("business_id", ctx.business.id)
    .order("name")
    .limit(limit);
  const pencarian = typeof input.pencarian === "string" ? input.pencarian.trim() : "";
  if (pencarian) q = q.ilike("name", `%${pencarian}%`);
  const { data, error } = await q;
  if (error) return `Gagal list produk: ${error.message}`;
  if (!data?.length) return `Belum ada produk di ${ctx.business.name}.`;
  return `Produk ${ctx.business.name}:\n${data
    .map(
      (p) =>
        `- ${p.name}: stok ${p.stock}${p.price != null ? ` · jual ${fmtRp(Number(p.price))}` : ""}${
          p.category ? ` [${p.category}]` : ""
        }`,
    )
    .join("\n")}`;
}

async function lihatOmzet(ctx: ChatSession, input: Record<string, unknown>) {
  const bulanIni = input.bulan_ini !== false;
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  let q = ctx.supabase
    .from("transactions")
    .select("business_id, type, amount")
    .eq("user_id", ctx.userId)
    .eq("scope", "bisnis")
    .limit(5000);
  if (bulanIni) q = q.gte("transaction_date", start);
  const { data, error } = await q;
  if (error) return `Gagal hitung omzet: ${error.message}`;
  const byBiz: Record<string, { in: number; out: number }> = {};
  for (const t of data || []) {
    const id = t.business_id || "_";
    if (!byBiz[id]) byBiz[id] = { in: 0, out: 0 };
    if (t.type === "pemasukan") byBiz[id].in += Number(t.amount);
    else byBiz[id].out += Number(t.amount);
  }
  if (!Object.keys(byBiz).length) return "Belum ada transaksi bisnis.";
  const nameOf = (id: string) => ctx.businesses.find((b) => b.id === id)?.name || id;
  return `${bulanIni ? "Omzet bulan ini" : "Omzet (semua)"}\n${Object.entries(byBiz)
    .map(
      ([id, v]) =>
        `- ${nameOf(id)}: masuk ${fmtRp(v.in)} · keluar ${fmtRp(v.out)} · saldo ${fmtRp(v.in - v.out)}`,
    )
    .join("\n")}`;
}

async function jualProduk(ctx: ChatSession, input: Record<string, unknown>) {
  if (!ctx.business?.id) return "Pilih bisnis aktif dulu (ganti_bisnis_aktif).";
  const nama = String(input.nama_produk || "").trim();
  const qty = Number(input.qty);
  if (!nama || !Number.isFinite(qty) || qty <= 0) return "nama_produk dan qty > 0 wajib.";
  const metode = typeof input.metode_bayar === "string" && input.metode_bayar.trim()
    ? input.metode_bayar.trim()
    : "tunai";

  const { data: matches } = await ctx.supabase
    .from("products")
    .select("id, name, stock, price, cost")
    .eq("user_id", ctx.userId)
    .eq("business_id", ctx.business.id)
    .ilike("name", nama)
    .limit(5);
  const product =
    matches?.find((p) => p.name.toLowerCase() === nama.toLowerCase()) || matches?.[0] || null;
  if (!product) return `Produk "${nama}" tidak ditemukan di ${ctx.business.name}.`;
  const price = Number(product.price) || 0;
  const cost = Number(product.cost) || 0;
  const stock = Number(product.stock) || 0;
  if (qty > stock) return `Stok tidak cukup: ${product.name} sisa ${stock}.`;
  const total = price * qty;
  const hpp = cost * qty;
  const result = await checkoutProductSale(ctx.supabase, {
    userId: ctx.userId,
    businessId: ctx.business.id,
    lines: [
      {
        productId: product.id,
        name: product.name,
        qty,
        price,
        cost,
        expectedStock: stock,
      },
    ],
    total,
    diskon: 0,
    hpp,
    laba: total - hpp,
    metodeBayar: metode,
    catatan: `AI Kasir retail · chat — ${metode}`,
    skipFinance: true,
  });
  if (!result.ok) return `Gagal jual: ${result.error}`;
  return `Terjual ${product.name} x${qty} = ${fmtRp(total)} (${metode}) di AI Kasir ${ctx.business.name}. Stok sisa ~${stock - qty}. Tidak masuk Keuangan Bisnis.`;
}

async function listKaryawan(ctx: ChatSession) {
  const kuliner = resolveBizByType(ctx, "kuliner");
  if (!kuliner) return "Belum ada bisnis kuliner untuk karyawan kasir.";
  const { data, error } = await ctx.supabase
    .from("employees")
    .select("nama, jabatan, aktif, kasir_token")
    .eq("business_id", kuliner.id)
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return `Gagal list karyawan: ${error.message}`;
  if (!data?.length) return `Belum ada karyawan di ${kuliner.name}.`;
  return data
    .map((e) => {
      const link = e.aktif && e.kasir_token ? `https://www.gercepos.id/kasir/${e.kasir_token}` : "-";
      return `- ${e.nama}${e.jabatan ? ` (${e.jabatan})` : ""} [${e.aktif ? "aktif" : "nonaktif"}] link: ${link}`;
    })
    .join("\n");
}

async function buatKaryawan(ctx: ChatSession, input: Record<string, unknown>) {
  const kuliner = resolveBizByType(ctx, "kuliner");
  if (!kuliner) return "Belum ada bisnis kuliner.";
  const nama = String(input.nama || "").trim();
  if (!nama) return "Nama karyawan wajib.";
  const jabatan = typeof input.jabatan === "string" ? input.jabatan.trim() : "";
  const { data, error } = await ctx.supabase
    .from("employees")
    .insert({
      business_id: kuliner.id,
      user_id: ctx.userId,
      nama,
      jabatan: jabatan || null,
      aktif: true,
    })
    .select("nama, kasir_token")
    .single();
  if (error || !data) return `Gagal buat karyawan: ${error?.message || "unknown"}`;
  const link = data.kasir_token ? `https://www.gercepos.id/kasir/${data.kasir_token}` : "(token belum ada — refresh Karyawan Toko)";
  return `Karyawan ${data.nama} ditambah di ${kuliner.name}. Link kasir: ${link}`;
}

async function buatOrderBengkel(ctx: ChatSession, input: Record<string, unknown>) {
  const bengkel = resolveBizByType(ctx, "bengkel");
  if (!bengkel) return "Belum ada bisnis bengkel. Ganti bisnis ke bengkel dulu.";
  const pelanggan = String(input.pelanggan || "").trim();
  const kendaraan = String(input.kendaraan || "").trim();
  if (!pelanggan || !kendaraan) return "pelanggan dan kendaraan wajib.";
  const payload = {
    user_id: ctx.userId,
    business_id: bengkel.id,
    pelanggan,
    kendaraan,
    keluhan: typeof input.keluhan === "string" ? input.keluhan.trim() || null : null,
    biaya_jasa: Number(input.biaya_jasa) || 0,
    spare_part: typeof input.spare_part === "string" ? input.spare_part.trim() || null : null,
    status: "antrian",
  };
  const { data, error } = await ctx.supabase
    .from("module_workshop_orders")
    .insert(payload)
    .select("id, pelanggan, kendaraan, status")
    .single();
  if (error || !data) {
    return `Gagal buat order bengkel: ${error?.message || "unknown"}. Pastikan migrasi module_workshop_orders sudah dijalankan.`;
  }
  return `Order bengkel dibuat: ${data.pelanggan} — ${data.kendaraan} [${data.status}] id=${data.id}`;
}

async function updateStatusBengkel(ctx: ChatSession, input: Record<string, unknown>) {
  const bengkel = resolveBizByType(ctx, "bengkel");
  if (!bengkel) return "Belum ada bisnis bengkel.";
  const status = String(input.status || "");
  if (!["antrian", "proses", "selesai", "batal"].includes(status)) {
    return "Status harus antrian|proses|selesai|batal.";
  }
  let orderId = typeof input.order_id === "string" ? input.order_id.trim() : "";
  if (!orderId && typeof input.pelanggan === "string") {
    const { data } = await ctx.supabase
      .from("module_workshop_orders")
      .select("id, pelanggan, kendaraan, biaya_jasa, spare_product_id, spare_qty, status")
      .eq("business_id", bengkel.id)
      .eq("user_id", ctx.userId)
      .ilike("pelanggan", input.pelanggan.trim())
      .in("status", ["antrian", "proses"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return "Order tidak ditemukan untuk pelanggan itu.";
    orderId = data.id;
  }
  if (!orderId) return "order_id atau pelanggan wajib.";

  const { data: order, error: fetchErr } = await ctx.supabase
    .from("module_workshop_orders")
    .select("id, pelanggan, kendaraan, biaya_jasa, spare_product_id, spare_qty, status")
    .eq("id", orderId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (fetchErr || !order) return `Order tidak ditemukan: ${fetchErr?.message || ""}`;

  if (status === "selesai" && order.status !== "selesai") {
    if (order.spare_product_id && Number(order.spare_qty) > 0) {
      const { data: prod } = await ctx.supabase
        .from("products")
        .select("id, name, stock, price, cost, category, min_stock, sku")
        .eq("id", order.spare_product_id)
        .maybeSingle();
      if (prod) {
        const result = await moveStock(ctx.supabase, {
          userId: ctx.userId,
          businessId: bengkel.id,
          product: prod as never,
          mode: "jual",
          qty: Number(order.spare_qty) || 1,
          reason: "terjual",
          note: `Servis ${order.kendaraan}`,
          buyCategory: "Pembelian Spare",
          sellCategory: "Penjualan Spare Part",
        });
        if (result.error) return `Gagal potong spare: ${result.error}`;
      }
    }
    const jasa = Number(order.biaya_jasa) || 0;
    if (jasa > 0) {
      const { error: txErr } = await ctx.supabase.from("transactions").insert({
        user_id: ctx.userId,
        business_id: bengkel.id,
        type: "pemasukan",
        scope: "bisnis",
        category: "Jasa Bengkel",
        description: `Servis ${order.kendaraan} — ${order.pelanggan}`,
        amount: jasa,
        transaction_date: todayWib(),
      });
      if (txErr) return `Keuangan jasa gagal: ${txErr.message}`;
    }
  }

  const { error } = await ctx.supabase
    .from("module_workshop_orders")
    .update({ status })
    .eq("id", order.id);
  if (error) return `Gagal update status: ${error.message}`;
  return `Status order ${order.pelanggan} (${order.kendaraan}) → ${status}.`;
}

async function tambahCrm(ctx: ChatSession, input: Record<string, unknown>) {
  if (!ctx.business?.id) return "Pilih bisnis aktif dulu.";
  const nama = String(input.nama || "").trim();
  if (!nama) return "Nama pelanggan wajib.";
  const { data, error } = await ctx.supabase
    .from("module_crm_customers")
    .insert({
      user_id: ctx.userId,
      business_id: ctx.business.id,
      nama,
      telepon: typeof input.telepon === "string" ? input.telepon.trim() || null : null,
      email: typeof input.email === "string" ? input.email.trim() || null : null,
      alamat: typeof input.alamat === "string" ? input.alamat.trim() || null : null,
      catatan: typeof input.catatan === "string" ? input.catatan.trim() || null : null,
    })
    .select("nama")
    .single();
  if (error || !data) {
    return `Gagal tambah CRM: ${error?.message || "unknown"}. Pastikan tabel module_crm_customers ada.`;
  }
  return `Pelanggan ${data.nama} ditambah ke CRM ${ctx.business.name}.`;
}

async function catatPakan(ctx: ChatSession, input: Record<string, unknown>) {
  const ternak = resolveBizByType(ctx, "ternak") || ctx.business;
  if (!ternak?.id) return "Belum ada bisnis (lebih baik bisnis ternak).";
  const nama = String(input.nama_pakan || "").trim();
  const qty = Number(input.qty);
  if (!nama || !Number.isFinite(qty) || qty <= 0) return "nama_pakan dan qty > 0 wajib.";

  const { data: matches } = await ctx.supabase
    .from("products")
    .select("id, name, stock, cost")
    .eq("user_id", ctx.userId)
    .eq("business_id", ternak.id)
    .ilike("name", nama)
    .limit(5);
  const feed =
    matches?.find((p) => p.name.toLowerCase() === nama.toLowerCase()) || matches?.[0] || null;
  if (!feed) return `Pakan "${nama}" tidak ada di inventory ${ternak.name}.`;
  const prev = Number(feed.stock);
  if (qty > prev) return `Stok pakan kurang (sisa ${prev}).`;
  const { error: stockErr } = await ctx.supabase
    .from("products")
    .update({ stock: prev - qty })
    .eq("id", feed.id)
    .eq("stock", prev);
  if (stockErr) return `Gagal potong stok: ${stockErr.message}`;
  await ctx.supabase.from("stock_movements").insert({
    user_id: ctx.userId,
    product_id: feed.id,
    type: "keluar",
    reason: "terpakai",
    quantity: qty,
    note: "Pakan harian (Gercep Chat)",
    profit_loss: -(Number(feed.cost) || 0) * qty,
    movement_date: todayWib(),
  });
  const amount = (Number(feed.cost) || 0) * qty;
  if (amount > 0) {
    const { error: txErr } = await ctx.supabase.from("transactions").insert({
      user_id: ctx.userId,
      business_id: ternak.id,
      type: "pengeluaran",
      scope: "bisnis",
      category: "Biaya Pakan",
      description: `Pakan harian ${feed.name} (${qty})`,
      amount,
      transaction_date: todayWib(),
    });
    if (txErr) {
      await ctx.supabase.from("products").update({ stock: prev }).eq("id", feed.id);
      return `Stok dibatalkan — keuangan gagal: ${txErr.message}`;
    }
  }
  return `Pakan ${feed.name} terpakai ${qty}. Stok sisa ${prev - qty}.${
    amount > 0 ? ` Biaya ${fmtRp(amount)} masuk Keuangan.` : ""
  }`;
}

async function jalankanProduksi(ctx: ChatSession, input: Record<string, unknown>) {
  if (!ctx.business?.id) return "Pilih bisnis aktif dulu.";
  const nama = String(input.nama_resep || "").trim();
  const qty = Number(input.qty);
  if (!nama || !Number.isFinite(qty) || qty <= 0) return "nama_resep dan qty > 0 wajib.";

  const { data: recipe, error: rErr } = await ctx.supabase
    .from("recipes")
    .select("id, name, yield_quantity, yield_unit, recipe_ingredients(quantity, unit, material_id, products!material_id(id, name, cost, stock))")
    .eq("business_id", ctx.business.id)
    .eq("user_id", ctx.userId)
    .ilike("name", nama)
    .limit(1)
    .maybeSingle();

  if (rErr || !recipe) {
    // fallback without embed
    const { data: plain } = await ctx.supabase
      .from("recipes")
      .select("id, name, yield_quantity, yield_unit, recipe_ingredients(quantity, unit, material_id)")
      .eq("business_id", ctx.business.id)
      .ilike("name", nama)
      .limit(1)
      .maybeSingle();
    if (!plain) return `Resep "${nama}" tidak ditemukan: ${rErr?.message || ""}`;
    return await produceFromRecipe(ctx, plain as never, qty);
  }
  return await produceFromRecipe(ctx, recipe as never, qty);
}

type Ing = {
  quantity: number;
  unit: string;
  material_id?: string;
  products?: { id?: string; name: string; cost: number | null; stock: number } | { id?: string; name: string; cost: number | null; stock: number }[] | null;
};

async function produceFromRecipe(
  ctx: ChatSession,
  recipe: {
    id: string;
    name: string;
    yield_quantity: number;
    yield_unit: string;
    recipe_ingredients: Ing[];
  },
  qty: number,
) {
  const businessId = ctx.business!.id;
  const yieldQty = Math.max(1, Number(recipe.yield_quantity) || 1);
  const ings = recipe.recipe_ingredients || [];
  const applied: { productId: string; prevStock: number }[] = [];
  const restore = async () => {
    for (const a of applied) {
      await ctx.supabase.from("products").update({ stock: a.prevStock }).eq("id", a.productId);
    }
  };

  let totalModal = 0;
  for (const ing of ings) {
    const prod = Array.isArray(ing.products) ? ing.products[0] : ing.products;
    const needed = (Number(ing.quantity) / yieldQty) * qty;
    let productRow: { id: string; stock: number; cost: number | null; name: string } | null = null;
    const mid = ing.material_id || prod?.id;
    if (mid) {
      const { data } = await ctx.supabase
        .from("products")
        .select("id, stock, cost, name")
        .eq("id", mid)
        .maybeSingle();
      productRow = data;
    }
    if (!productRow && prod?.name) {
      const { data } = await ctx.supabase
        .from("products")
        .select("id, stock, cost, name")
        .eq("business_id", businessId)
        .ilike("name", prod.name)
        .limit(1)
        .maybeSingle();
      productRow = data;
    }
    if (!productRow) {
      await restore();
      return `Bahan tidak ditemukan: ${prod?.name || mid}`;
    }
    const prev = Number(productRow.stock);
    if (prev < needed) {
      await restore();
      return `Stok ${productRow.name} kurang (butuh ${needed.toFixed(1)}, sisa ${prev}).`;
    }
    const { data: updated, error } = await ctx.supabase
      .from("products")
      .update({ stock: prev - needed })
      .eq("id", productRow.id)
      .eq("stock", prev)
      .select("id")
      .maybeSingle();
    if (error || !updated) {
      await restore();
      return error?.message || `Stok ${productRow.name} berubah — coba lagi`;
    }
    applied.push({ productId: productRow.id, prevStock: prev });
    totalModal += (Number(productRow.cost) || 0) * needed;
    await ctx.supabase.from("stock_movements").insert({
      user_id: ctx.userId,
      product_id: productRow.id,
      type: "keluar",
      reason: "terpakai",
      quantity: needed,
      note: `Produksi ${qty} ${recipe.yield_unit || "pcs"} ${recipe.name}`,
      profit_loss: -(Number(productRow.cost) || 0) * needed,
      movement_date: todayWib(),
    });
  }

  const hpp = qty > 0 ? totalModal / qty : 0;
  const { data: existingProduct } = await ctx.supabase
    .from("products")
    .select("id, stock")
    .eq("name", recipe.name)
    .eq("business_id", businessId)
    .maybeSingle();
  if (existingProduct) {
    const { error } = await ctx.supabase
      .from("products")
      .update({ stock: Number(existingProduct.stock) + qty, cost: hpp, category: "Produk Jadi" })
      .eq("id", existingProduct.id);
    if (error) {
      await restore();
      return `Gagal update produk jadi: ${error.message}`;
    }
  } else {
    const { error } = await ctx.supabase.from("products").insert({
      user_id: ctx.userId,
      business_id: businessId,
      name: recipe.name,
      category: "Produk Jadi",
      stock: qty,
      min_stock: 5,
      cost: hpp,
    });
    if (error) {
      await restore();
      return `Gagal buat produk jadi: ${error.message}`;
    }
  }

  await ctx.supabase.from("production_logs").insert({
    user_id: ctx.userId,
    business_id: businessId,
    recipe_id: recipe.id,
    quantity_produced: qty,
    total_material_cost: totalModal,
    additional_cost: 0,
    hpp_per_unit: hpp,
    status: "selesai",
    production_date: todayWib(),
    note: "Gercep Chat",
  });

  return `Produksi ${recipe.name} selesai: ${qty} ${recipe.yield_unit || "pcs"}. HPP/unit ~${fmtRp(hpp)}. Bahan terpotong, produk jadi masuk inventory.`;
}

async function gantiLatarStudio(ctx: ChatSession, input: Record<string, unknown>) {
  const { runGantiLatarStudio } = await import("@/lib/henima-sales/studio-tool");
  return runGantiLatarStudio(ctx, input);
}
