import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import { todayWib } from "@/lib/date";
import { normalizeBizType } from "@/lib/auth/post-login";
import { syncFarmToKeuangan, type FarmJenis } from "@/app/dashboard/peternakan/lib/farm-sync";
import { WAVE1_TOOLS, runWave1Tool, type ChatSession, type ChatBiz } from "./wave1-tools";

export type { ChatBiz, ChatSession };

export const CHAT_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "catat_transaksi",
    description:
      "Catat transaksi keuangan (pemasukan/pengeluaran) ke Keuangan Pribadi atau Bisnis. WAJIB dipakai kalau user minta catat pemasukan/pengeluaran/jasa/biaya.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: { type: "string", enum: ["pemasukan", "pengeluaran"] },
        scope: { type: "string", enum: ["pribadi", "bisnis"] },
        amount: { type: "number", description: "Jumlah Rupiah, contoh 1jt = 1000000" },
        description: { type: "string" },
        category: { type: "string", description: "Contoh: Penjualan, Jasa, Operasional, Modal" },
      },
      required: ["type", "scope", "amount"],
    },
  },
  {
    name: "kelola_stok",
    description:
      "Tambah/update produk di Inventory/rak saja (bukan menu F&B, bukan batch ternak). JANGAN pakai untuk bebek/ayam/ternak/bibit/ekor kecuali user sudah jelas bilang 'inventory' atau 'stok rak'.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        stock_change: { type: "number" },
        set_to: { type: "number" },
        price: { type: "number" },
        cost: { type: "number", description: "HPP / harga modal" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_batch_ternak",
    description:
      "Lihat daftar batch di Manajemen Ternak (batch aktif/selesai). Pakai sebelum catat bibit/pakan ke batch.",
    input_schema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["aktif", "selesai", "semua"], description: "Default aktif" },
      },
    },
  },
  {
    name: "buat_batch_ternak",
    description:
      "Buat batch baru di Manajemen Ternak / Peternakan (nama batch + jenis ternak). Setelah batch ada, pakai catat_transaksi_batch untuk bibit/pakan.",
    input_schema: {
      type: "object" as const,
      properties: {
        nama_batch: { type: "string", description: "Contoh: Batch Bebek Maret" },
        jenis_ternak: { type: "string", description: "Contoh: Bebek, Ayam Broiler, Sapi" },
        tanggal_mulai: { type: "string", description: "YYYY-MM-DD opsional" },
      },
      required: ["nama_batch", "jenis_ternak"],
    },
  },
  {
    name: "catat_transaksi_batch",
    description:
      "Catat bibit/pakan/obat/operasional/panen ke batch Manajemen Ternak, lalu sync ke Keuangan Bisnis. Pakai ini kalau user mau input hewan/ekor ke batch (bukan inventory rak).",
    input_schema: {
      type: "object" as const,
      properties: {
        batch_id: { type: "string", description: "UUID batch (lebih akurat)" },
        nama_batch: { type: "string", description: "Nama batch kalau belum punya id" },
        jenis: {
          type: "string",
          enum: ["bibit", "pakan", "obat", "vitamin", "operasional", "mortalitas", "panen"],
        },
        qty: { type: "number", description: "Jumlah ekor/kg" },
        total: { type: "number", description: "Total Rupiah (opsional, default 0)" },
        harga: { type: "number", description: "Harga satuan opsional" },
        nama_item: { type: "string", description: "Contoh: Bebek pedaging" },
        tanggal: { type: "string", description: "YYYY-MM-DD opsional" },
      },
      required: ["jenis"],
    },
  },
  {
    name: "buat_menu_kasir",
    description:
      "Buat atau update MENU F&B yang muncul di Kasir F&B / Master Menu. Pakai ini kalau user minta input menu ke kasir (nasi goreng, es teh, dll). Bisa sekalian set harga jual, HPP, dan stok porsi/bahan.",
    input_schema: {
      type: "object" as const,
      properties: {
        nama: { type: "string", description: "Nama menu, contoh: Nasi Goreng" },
        harga_jual: { type: "number", description: "Harga jual ke pelanggan (Rupiah)" },
        hpp: { type: "number", description: "HPP per porsi (Rupiah). Opsional." },
        stok: { type: "number", description: "Stok porsi/bahan terkait. Opsional." },
        kategori: {
          type: "string",
          enum: ["Makanan", "Minuman", "Snack", "Paket", "Lainnya"],
        },
        status: { type: "string", enum: ["aktif", "nonaktif"] },
      },
      required: ["nama"],
    },
  },
  {
    name: "list_menu_kasir",
    description: "Lihat daftar menu F&B yang sudah ada di bisnis kuliner aktif (untuk konfirmasi sebelum edit).",
    input_schema: {
      type: "object" as const,
      properties: {
        pencarian: { type: "string", description: "Filter nama menu (opsional)" },
      },
    },
  },
  {
    name: "lihat_keuangan",
    description: "Ringkas transaksi keuangan terbaru (pemasukan/pengeluaran) milik user.",
    input_schema: {
      type: "object" as const,
      properties: {
        scope: { type: "string", enum: ["pribadi", "bisnis", "semua"] },
        limit: { type: "number", description: "Default 10" },
      },
    },
  },
  {
    name: "list_bisnis",
    description: "Lihat daftar bisnis user dan bisnis yang sedang aktif di chat.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  ...WAVE1_TOOLS,
];

function fmtRp(n: number) {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}

export async function runChatTool(
  name: string,
  rawInput: unknown,
  ctx: ChatSession,
): Promise<string> {
  const input = (rawInput || {}) as Record<string, unknown>;
  try {
    switch (name) {
      case "catat_transaksi":
        return await catatTransaksi(ctx, input);
      case "kelola_stok":
        return await kelolaStok(ctx, input);
      case "list_batch_ternak":
        return await listBatchTernak(ctx, input);
      case "buat_batch_ternak":
        return await buatBatchTernak(ctx, input);
      case "catat_transaksi_batch":
        return await catatTransaksiBatch(ctx, input);
      case "buat_menu_kasir":
        return await buatMenuKasir(ctx, input);
      case "list_menu_kasir":
        return await listMenuKasir(ctx, input);
      case "lihat_keuangan":
        return await lihatKeuangan(ctx, input);
      case "list_bisnis":
        return listBisnis(ctx);
      default:
        return await runWave1Tool(name, input, ctx);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return `Gagal menjalankan ${name}: ${msg}`;
  }
}

async function catatTransaksi(
  ctx: { supabase: SupabaseClient; userId: string; business: ChatBiz | null },
  input: Record<string, unknown>,
) {
  const type = input.type === "pengeluaran" ? "pengeluaran" : "pemasukan";
  const scope = input.scope === "pribadi" ? "pribadi" : "bisnis";
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return "Jumlah transaksi tidak valid.";
  }
  if (scope === "bisnis" && !ctx.business?.id) {
    return "Belum ada bisnis aktif. Suruh user pilih bisnis di sidebar dulu, lalu minta catat lagi.";
  }

  const description =
    typeof input.description === "string" && input.description.trim()
      ? input.description.trim()
      : type === "pemasukan"
        ? "Pemasukan"
        : "Pengeluaran";
  const category =
    typeof input.category === "string" && input.category.trim()
      ? input.category.trim()
      : scope === "bisnis"
        ? "Lainnya"
        : "Lainnya";

  const row = {
    user_id: ctx.userId,
    business_id: scope === "bisnis" ? ctx.business!.id : null,
    type,
    scope,
    amount,
    description,
    category,
    transaction_date: todayWib(),
  };

  const { error } = await ctx.supabase.from("transactions").insert(row);
  if (error) {
    // Retry without null business_id quirks / optional columns
    const { error: err2 } = await ctx.supabase.from("transactions").insert({
      user_id: row.user_id,
      business_id: row.business_id,
      type: row.type,
      scope: row.scope,
      amount: row.amount,
      description: row.description,
      category: row.category,
      transaction_date: row.transaction_date,
    });
    if (err2) return `Gagal simpan transaksi: ${err2.message}`;
  }

  return `Berhasil. Tercatat di keuangan ${scope}: ${type} ${description} ${fmtRp(amount)}${
    scope === "bisnis" && ctx.business ? ` (bisnis ${ctx.business.name})` : ""
  }.`;
}

async function kelolaStok(
  ctx: {
    supabase: SupabaseClient;
    userId: string;
    business: ChatBiz | null;
    unitLabel: string;
    isPertanian: boolean;
  },
  input: Record<string, unknown>,
) {
  const name = String(input.name || "").trim();
  if (!name) return "Nama produk wajib.";
  if (!ctx.business?.id) return "Pilih bisnis aktif dulu di sidebar.";

  const { data: matches } = await ctx.supabase
    .from("products")
    .select("id, stock, name")
    .eq("user_id", ctx.userId)
    .eq("business_id", ctx.business.id)
    .ilike("name", name)
    .limit(5);

  const existing =
    matches?.find((p) => p.name.toLowerCase() === name.toLowerCase()) || matches?.[0] || null;

  const price = input.price !== undefined ? Number(input.price) : undefined;
  const cost = input.cost !== undefined ? Number(input.cost) : undefined;

  if (existing) {
    const setTo = input.set_to !== undefined ? Number(input.set_to) : undefined;
    const change = input.stock_change !== undefined ? Number(input.stock_change) : undefined;
    const newStock =
      setTo !== undefined && Number.isFinite(setTo)
        ? setTo
        : Number(existing.stock) + (Number.isFinite(change) ? (change as number) : 0);
    const patch: Record<string, unknown> = { stock: newStock };
    if (price !== undefined && Number.isFinite(price)) patch.price = price;
    if (cost !== undefined && Number.isFinite(cost)) patch.cost = cost;
    const { error } = await ctx.supabase.from("products").update(patch).eq("id", existing.id);
    if (error) return `Gagal update stok: ${error.message}`;
    return `Stok ${existing.name} sekarang ${newStock} ${ctx.unitLabel}.`;
  }

  const setTo = input.set_to !== undefined ? Number(input.set_to) : undefined;
  const change = input.stock_change !== undefined ? Number(input.stock_change) : undefined;
  const initial =
    setTo !== undefined && Number.isFinite(setTo)
      ? setTo
      : Math.max(Number.isFinite(change) ? (change as number) : 0, 0);

  const { error } = await ctx.supabase.from("products").insert({
    user_id: ctx.userId,
    business_id: ctx.business.id,
    name,
    stock: initial,
    price: price !== undefined && Number.isFinite(price) ? price : null,
    cost: cost !== undefined && Number.isFinite(cost) ? cost : null,
    category: ctx.isPertanian ? "Sayuran" : null,
    min_stock: 5,
  });
  if (error) return `Gagal nambah produk: ${error.message}`;
  return `Produk ${name} ditambahkan, stok awal ${initial} ${ctx.unitLabel}.`;
}

function resolveTernakBusiness(ctx: {
  business: ChatBiz | null;
  businesses: ChatBiz[];
}): ChatBiz | null {
  if (ctx.business && normalizeBizType(ctx.business.type) === "ternak") return ctx.business;
  return ctx.businesses.find((b) => normalizeBizType(b.type) === "ternak") || null;
}

async function listBatchTernak(
  ctx: {
    supabase: SupabaseClient;
    userId: string;
    business: ChatBiz | null;
    businesses: ChatBiz[];
  },
  input: Record<string, unknown>,
) {
  const ternak = resolveTernakBusiness(ctx);
  if (!ternak) {
    return "Belum ada bisnis tipe Peternakan. Buat/aktifkan bisnis ternak dulu, atau bilang mau dicatat ke Inventory saja.";
  }
  const status = input.status === "semua" || input.status === "selesai" ? String(input.status) : "aktif";
  let q = ctx.supabase
    .from("farm_batches")
    .select("id, nama_batch, jenis_ternak, status, tanggal_mulai")
    .eq("user_id", ctx.userId)
    .eq("business_id", ternak.id)
    .order("tanggal_mulai", { ascending: false })
    .limit(20);
  if (status !== "semua") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) {
    return `Gagal baca batch: ${error.message}. Pastikan tabel farm_batches sudah ada di Supabase.`;
  }
  if (!data?.length) {
    return `Belum ada batch ${status === "semua" ? "" : status + " "}di ${ternak.name}. Buat dulu dengan buat_batch_ternak.`;
  }
  return `Batch di ${ternak.name}:\n${data
    .map(
      (b) =>
        `- ${b.nama_batch} (${b.jenis_ternak}) [${b.status}] id=${b.id} mulai ${b.tanggal_mulai || "-"}`,
    )
    .join("\n")}`;
}

async function buatBatchTernak(
  ctx: {
    supabase: SupabaseClient;
    userId: string;
    business: ChatBiz | null;
    businesses: ChatBiz[];
  },
  input: Record<string, unknown>,
) {
  const ternak = resolveTernakBusiness(ctx);
  if (!ternak) {
    return "Belum ada bisnis Peternakan. Aktifkan bisnis ternak di sidebar, atau konfirmasi user mau pakai Inventory saja.";
  }
  const nama = String(input.nama_batch || "").trim();
  const jenis = String(input.jenis_ternak || "").trim();
  if (!nama || !jenis) return "nama_batch dan jenis_ternak wajib.";
  const tanggal =
    typeof input.tanggal_mulai === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.tanggal_mulai)
      ? input.tanggal_mulai
      : todayWib();

  const { data, error } = await ctx.supabase
    .from("farm_batches")
    .insert({
      user_id: ctx.userId,
      business_id: ternak.id,
      nama_batch: nama,
      jenis_ternak: jenis,
      tanggal_mulai: tanggal,
      status: "aktif",
    })
    .select("id, nama_batch, jenis_ternak")
    .single();
  if (error || !data) {
    return `Gagal buat batch: ${error?.message || "unknown"}. Cek migrasi farm_batches di Supabase.`;
  }
  return `Batch "${data.nama_batch}" (${data.jenis_ternak}) dibuat di Manajemen Ternak (${ternak.name}). id=${data.id}. Lanjut catat bibit dengan catat_transaksi_batch.`;
}

async function catatTransaksiBatch(
  ctx: {
    supabase: SupabaseClient;
    userId: string;
    business: ChatBiz | null;
    businesses: ChatBiz[];
  },
  input: Record<string, unknown>,
) {
  const ternak = resolveTernakBusiness(ctx);
  if (!ternak) return "Belum ada bisnis Peternakan aktif.";

  const jenisRaw = String(input.jenis || "").toLowerCase();
  const allowed: FarmJenis[] = ["bibit", "pakan", "obat", "vitamin", "operasional", "mortalitas", "panen"];
  if (!allowed.includes(jenisRaw as FarmJenis)) {
    return `Jenis transaksi batch tidak valid. Pilih: ${allowed.join(", ")}.`;
  }
  const jenis = jenisRaw as FarmJenis;
  const qty = input.qty !== undefined ? Number(input.qty) : null;
  const harga = input.harga !== undefined ? Number(input.harga) : null;
  let total = input.total !== undefined ? Number(input.total) : NaN;
  if (!Number.isFinite(total)) {
    total =
      qty !== null && Number.isFinite(qty) && harga !== null && Number.isFinite(harga)
        ? qty * harga
        : 0;
  }
  const tanggal =
    typeof input.tanggal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.tanggal)
      ? input.tanggal
      : todayWib();
  const namaItem =
    typeof input.nama_item === "string" && input.nama_item.trim() ? input.nama_item.trim() : null;

  let batchId = typeof input.batch_id === "string" ? input.batch_id.trim() : "";
  const namaBatchHint =
    typeof input.nama_batch === "string" ? input.nama_batch.trim() : "";

  let batch: {
    id: string;
    nama_batch: string;
    jenis_ternak: string;
    business_id: string;
  } | null = null;

  if (batchId) {
    const { data } = await ctx.supabase
      .from("farm_batches")
      .select("id, nama_batch, jenis_ternak, business_id")
      .eq("id", batchId)
      .eq("user_id", ctx.userId)
      .maybeSingle();
    batch = data;
  } else if (namaBatchHint) {
    const { data } = await ctx.supabase
      .from("farm_batches")
      .select("id, nama_batch, jenis_ternak, business_id")
      .eq("user_id", ctx.userId)
      .eq("business_id", ternak.id)
      .ilike("nama_batch", namaBatchHint)
      .eq("status", "aktif")
      .order("tanggal_mulai", { ascending: false })
      .limit(1)
      .maybeSingle();
    batch = data;
  } else {
    const { data } = await ctx.supabase
      .from("farm_batches")
      .select("id, nama_batch, jenis_ternak, business_id")
      .eq("user_id", ctx.userId)
      .eq("business_id", ternak.id)
      .eq("status", "aktif")
      .order("tanggal_mulai", { ascending: false })
      .limit(1)
      .maybeSingle();
    batch = data;
  }

  if (!batch) {
    return "Batch tidak ditemukan. Buat dulu dengan buat_batch_ternak, atau sebutkan nama_batch / batch_id.";
  }
  batchId = batch.id;

  const { data: farmTx, error: farmErr } = await ctx.supabase
    .from("farm_transactions")
    .insert({
      batch_id: batchId,
      user_id: ctx.userId,
      tanggal,
      jenis_transaksi: jenis,
      nama_item: namaItem,
      qty: qty !== null && Number.isFinite(qty) ? qty : null,
      satuan: jenis === "panen" || jenis === "bibit" || jenis === "mortalitas" ? "ekor" : null,
      harga: harga !== null && Number.isFinite(harga) ? harga : null,
      total: Number.isFinite(total) ? total : 0,
    })
    .select("id")
    .single();

  if (farmErr || !farmTx) {
    return `Gagal catat ke batch: ${farmErr?.message || "unknown"}`;
  }

  const sync = await syncFarmToKeuangan(ctx.supabase, {
    userId: ctx.userId,
    businessId: batch.business_id || ternak.id,
    farmTxId: farmTx.id,
    jenis,
    total: Number.isFinite(total) ? total : 0,
    qty: qty !== null && Number.isFinite(qty) ? qty : null,
    namaItem,
    batchName: batch.nama_batch,
    jenisTernak: batch.jenis_ternak,
    tanggal,
    totalModal: 0,
    totalBibit: 0,
  });

  if (!sync.ok) {
    return `Tercatat di batch "${batch.nama_batch}" (${jenis}${qty ? ` ${qty}` : ""}), tapi sync Keuangan Bisnis gagal: ${sync.error}`;
  }

  return `Tercatat di Manajemen Batch "${batch.nama_batch}" (${batch.jenis_ternak}): ${jenis}${
    qty ? ` ${qty} ekor` : ""
  }${total > 0 ? `, total ${fmtRp(total)}` : ""}. Sudah masuk Keuangan Bisnis bisnis ${ternak.name}.`;
}

async function resolveKulinerBusiness(ctx: {
  business: ChatBiz | null;
  businesses: ChatBiz[];
}): Promise<ChatBiz | null> {
  if (ctx.business && (ctx.business.type === "kuliner" || !ctx.business.type)) {
    // prefer explicit kuliner
  }
  if (ctx.business?.type === "kuliner") return ctx.business;
  return ctx.businesses.find((b) => b.type === "kuliner") || null;
}

async function buatMenuKasir(
  ctx: {
    supabase: SupabaseClient;
    userId: string;
    business: ChatBiz | null;
    businesses: ChatBiz[];
  },
  input: Record<string, unknown>,
) {
  const kuliner = await resolveKulinerBusiness(ctx);
  if (!kuliner) {
    return "Belum ada bisnis tipe Kuliner/F&B. Buat atau aktifkan bisnis kuliner dulu di Multi Bisnis.";
  }

  const nama = String(input.nama || "").trim();
  if (!nama) return "Nama menu wajib.";

  const hpp = input.hpp !== undefined ? Number(input.hpp) : undefined;
  let harga =
    input.harga_jual !== undefined ? Number(input.harga_jual) : undefined;
  if (harga === undefined || !Number.isFinite(harga) || harga <= 0) {
    harga = hpp && Number.isFinite(hpp) && hpp > 0 ? Math.round(hpp * 2) : 15000;
  }
  const stok = input.stok !== undefined ? Number(input.stok) : undefined;
  const kategori =
    typeof input.kategori === "string" && input.kategori
      ? input.kategori
      : "Makanan";
  const status = input.status === "nonaktif" ? "nonaktif" : "aktif";

  const { data: existingMenus } = await ctx.supabase
    .from("menus")
    .select("id, nama, harga_jual, status")
    .eq("business_id", kuliner.id)
    .ilike("nama", nama)
    .limit(5);

  const existing =
    existingMenus?.find((m) => m.nama.toLowerCase() === nama.toLowerCase()) ||
    existingMenus?.[0] ||
    null;

  let menuId = existing?.id as string | undefined;

  if (existing) {
    const { error } = await ctx.supabase
      .from("menus")
      .update({
        harga_jual: harga,
        kategori,
        status,
        yield_quantity: 1,
      })
      .eq("id", existing.id);
    if (error) return `Gagal update menu: ${error.message}`;
    menuId = existing.id;
  } else {
    const payload: Record<string, unknown> = {
      user_id: ctx.userId,
      business_id: kuliner.id,
      nama,
      kategori,
      harga_jual: harga,
      status,
      yield_quantity: 1,
    };
    let { data, error } = await ctx.supabase
      .from("menus")
      .insert(payload)
      .select("id")
      .maybeSingle();
    if (error && /photo_url|column/i.test(error.message)) {
      const retry = await ctx.supabase.from("menus").insert(payload).select("id").maybeSingle();
      data = retry.data;
      error = retry.error;
    }
    if (error || !data) return `Gagal buat menu: ${error?.message || "unknown"}`;
    menuId = data.id;
  }

  // Optional: track portion stock + HPP via a linked inventory product + simple recipe
  if ((stok !== undefined && Number.isFinite(stok)) || (hpp !== undefined && Number.isFinite(hpp))) {
    const productName = `Bahan ${nama}`;
    const { data: prods } = await ctx.supabase
      .from("products")
      .select("id, stock")
      .eq("business_id", kuliner.id)
      .eq("user_id", ctx.userId)
      .ilike("name", productName)
      .limit(1);
    let productId = prods?.[0]?.id as string | undefined;
    if (productId) {
      const patch: Record<string, unknown> = {};
      if (stok !== undefined && Number.isFinite(stok)) patch.stock = stok;
      if (hpp !== undefined && Number.isFinite(hpp)) patch.cost = hpp;
      if (Object.keys(patch).length) {
        await ctx.supabase.from("products").update(patch).eq("id", productId);
      }
    } else {
      const { data: created, error: pErr } = await ctx.supabase
        .from("products")
        .insert({
          user_id: ctx.userId,
          business_id: kuliner.id,
          name: productName,
          stock: stok !== undefined && Number.isFinite(stok) ? stok : 0,
          cost: hpp !== undefined && Number.isFinite(hpp) ? hpp : null,
          price: harga,
          category: "Bahan Menu",
          min_stock: 5,
        })
        .select("id")
        .maybeSingle();
      if (!pErr && created) productId = created.id;
    }

    if (productId && menuId && hpp !== undefined && Number.isFinite(hpp)) {
      const { data: recipes } = await ctx.supabase
        .from("menu_recipes")
        .select("id")
        .eq("menu_id", menuId)
        .eq("product_id", productId)
        .limit(1);
      if (!recipes?.length) {
        await ctx.supabase.from("menu_recipes").insert({
          menu_id: menuId,
          product_id: productId,
          quantity: 1,
          unit: "porsi",
        });
      }
    }
  }

  return `Menu "${nama}" ${existing ? "diupdate" : "dibuat"} di Kasir F&B (${kuliner.name}): harga jual ${fmtRp(
    harga,
  )}, status ${status}.${hpp ? ` HPP ${fmtRp(hpp)}.` : ""}${
    stok !== undefined ? ` Stok terkait ${stok}.` : ""
  } Buka /dashboard/fnb/kasir untuk jual.`;
}

async function listMenuKasir(
  ctx: {
    supabase: SupabaseClient;
    business: ChatBiz | null;
    businesses: ChatBiz[];
  },
  input: Record<string, unknown>,
) {
  const kuliner = await resolveKulinerBusiness(ctx);
  if (!kuliner) return "Belum ada bisnis kuliner.";

  let q = ctx.supabase
    .from("menus")
    .select("nama, harga_jual, status, kategori")
    .eq("business_id", kuliner.id)
    .order("nama")
    .limit(40);
  const pencarian = typeof input.pencarian === "string" ? input.pencarian.trim() : "";
  if (pencarian) q = q.ilike("nama", `%${pencarian}%`);
  const { data, error } = await q;
  if (error) return `Gagal baca menu: ${error.message}`;
  if (!data?.length) return `Belum ada menu di ${kuliner.name}.`;
  return `Menu di ${kuliner.name}:\n${data
    .map((m) => `- ${m.nama} (${m.status || "aktif"}) ${fmtRp(Number(m.harga_jual))} [${m.kategori || "-"}]`)
    .join("\n")}`;
}

async function lihatKeuangan(
  ctx: { supabase: SupabaseClient; userId: string; business: ChatBiz | null },
  input: Record<string, unknown>,
) {
  const scope = input.scope === "pribadi" || input.scope === "bisnis" ? input.scope : "semua";
  const limit = Math.min(Number(input.limit) || 10, 30);
  let q = ctx.supabase
    .from("transactions")
    .select("type, scope, amount, description, category, transaction_date")
    .eq("user_id", ctx.userId)
    .order("transaction_date", { ascending: false })
    .limit(limit);
  if (scope !== "semua") q = q.eq("scope", scope);
  if (scope === "bisnis" && ctx.business?.id) q = q.eq("business_id", ctx.business.id);
  const { data, error } = await q;
  if (error) return `Gagal baca keuangan: ${error.message}`;
  if (!data?.length) return "Belum ada transaksi.";
  return data
    .map(
      (t) =>
        `${t.transaction_date} · ${t.scope} · ${t.type} · ${fmtRp(Number(t.amount))} · ${t.description || t.category || "-"}`,
    )
    .join("\n");
}

function listBisnis(ctx: { business: ChatBiz | null; businesses: ChatBiz[] }) {
  if (!ctx.businesses.length) return "User belum punya bisnis.";
  return ctx.businesses
    .map((b) => `- ${b.name} (${b.type || "-"})${ctx.business?.id === b.id ? " ← aktif" : ""}`)
    .join("\n");
}
