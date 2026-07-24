import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";
import { todayWib } from "@/lib/date";

export type ChatBiz = { id: string; type: string | null; name: string };

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
      "Tambah/update produk inventory (bukan menu F&B). Nambah/kurang/set stok, harga jual, HPP/modal.",
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
];

function fmtRp(n: number) {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}

export async function runChatTool(
  name: string,
  rawInput: unknown,
  ctx: {
    supabase: SupabaseClient;
    userId: string;
    business: ChatBiz | null;
    businesses: ChatBiz[];
    unitLabel: string;
    isPertanian: boolean;
  },
): Promise<string> {
  const input = (rawInput || {}) as Record<string, unknown>;
  try {
    switch (name) {
      case "catat_transaksi":
        return await catatTransaksi(ctx, input);
      case "kelola_stok":
        return await kelolaStok(ctx, input);
      case "buat_menu_kasir":
        return await buatMenuKasir(ctx, input);
      case "list_menu_kasir":
        return await listMenuKasir(ctx, input);
      case "lihat_keuangan":
        return await lihatKeuangan(ctx, input);
      case "list_bisnis":
        return listBisnis(ctx);
      default:
        return `Tool ${name} belum dikenal.`;
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
