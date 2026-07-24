import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_EMAIL, DEMO_FULL_NAME, DEMO_PASSWORD } from "./config";
import { trialPayload } from "@/lib/auth/trial";
import { getPlatformSettings } from "@/lib/admin/settings";
import { trackEvent } from "@/lib/admin/track-event";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

async function ensureDemoUser() {
  const admin = createAdminClient();
  if (!admin) {
    return {
      ok: false as const,
      error:
        "Akun demo belum siap di server ini. Isi SUPABASE_SERVICE_ROLE_KEY di Vercel (Settings → Environment Variables), redeploy, lalu coba lagi — atau masuk manual pakai email/password demo.",
    };
  }

  const settings = await getPlatformSettings();
  if (!settings.demo_enabled) {
    return { ok: false as const, error: "Akun demo sedang dinonaktifkan oleh admin." };
  }

  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = listed?.users?.find(u => u.email?.toLowerCase() === DEMO_EMAIL.toLowerCase());

  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: DEMO_FULL_NAME },
    });
    const { data: sub } = await admin
      .from("subscriptions")
      .select("trial_ends_at, plan")
      .eq("user_id", existing.id)
      .maybeSingle();
    if (!sub?.trial_ends_at) {
      await admin
        .from("subscriptions")
        .upsert(trialPayload(existing.id, new Date(), settings.trial_days), { onConflict: "user_id" });
    }
    await trackEvent({ event: "demo_login", module: "auth", user_id: existing.id });
    return { ok: true as const, userId: existing.id };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: DEMO_FULL_NAME },
  });

  if (error || !data.user) {
    return { ok: false as const, error: error?.message || "Gagal buat user demo." };
  }

  await admin.from("subscriptions").upsert(trialPayload(data.user.id, new Date(), settings.trial_days), {
    onConflict: "user_id",
  });
  await trackEvent({ event: "demo_created", module: "auth", user_id: data.user.id });
  return { ok: true as const, userId: data.user.id };
}

async function seedDemoData(userId: string) {
  const admin = createAdminClient();
  if (!admin) return;

  await admin.from("profiles").upsert({ id: userId, full_name: DEMO_FULL_NAME }, { onConflict: "id" });

  const { data: existingBiz } = await admin
    .from("businesses")
    .select("id, type, name")
    .eq("user_id", userId);

  const demoNames = ["Warung Pak Budi", "Kebun Sejahtera", "Ternak Makmur"];
  const alreadySeeded = (existingBiz || []).some(b => demoNames.includes(b.name));
  if (alreadySeeded) return;

  const onlyDefault = existingBiz?.length === 1 && existingBiz[0].name === "Bisnis Utama";
  const empty = !existingBiz?.length;
  if (!empty && !onlyDefault) return;

  if (existingBiz?.length) {
    await admin.from("businesses").delete().eq("user_id", userId);
  }

  const bizDefs = [
    { name: "Warung Pak Budi", type: "kuliner" },
    { name: "Kebun Sejahtera", type: "pertanian" },
    { name: "Ternak Makmur", type: "ternak" },
  ];

  const { data: businesses } = await admin
    .from("businesses")
    .insert(bizDefs.map(b => ({ user_id: userId, name: b.name, type: b.type })))
    .select("id, type, name");

  if (!businesses?.length) return;

  const kuliner = businesses.find(b => b.type === "kuliner")!;
  const pertanian = businesses.find(b => b.type === "pertanian")!;
  const ternak = businesses.find(b => b.type === "ternak")!;

  const bulan = new Date().getMonth() + 1;
  const tahun = new Date().getFullYear();

  try {
    await admin.from("business_targets").insert([
      { business_id: kuliner.id, user_id: userId, bulan, tahun, target_omzet: 25000000 },
      { business_id: pertanian.id, user_id: userId, bulan, tahun, target_omzet: 15000000 },
      { business_id: ternak.id, user_id: userId, bulan, tahun, target_omzet: 20000000 },
    ]);
  } catch {
    // target opsional
  }

  const txRows = [
  // Kuliner — untung
    { user_id: userId, business_id: kuliner.id, type: "pemasukan", scope: "bisnis", category: "Penjualan", description: "Nasi goreng x45", amount: 2250000, transaction_date: daysAgo(2) },
    { user_id: userId, business_id: kuliner.id, type: "pemasukan", scope: "bisnis", category: "Penjualan", description: "Paket catering", amount: 3500000, transaction_date: daysAgo(5) },
    { user_id: userId, business_id: kuliner.id, type: "pemasukan", scope: "bisnis", category: "Penjualan", description: "Es teh & snack", amount: 890000, transaction_date: daysAgo(8) },
    { user_id: userId, business_id: kuliner.id, type: "pengeluaran", scope: "bisnis", category: "Bahan Baku", description: "Beli beras & bumbu", amount: 1200000, transaction_date: daysAgo(3) },
    { user_id: userId, business_id: kuliner.id, type: "pengeluaran", scope: "bisnis", category: "Operasional", description: "Gas & listrik", amount: 450000, transaction_date: daysAgo(6) },
  // Pertanian
    { user_id: userId, business_id: pertanian.id, type: "pemasukan", scope: "bisnis", category: "Penjualan Panen", description: "Jual cabai merah", amount: 1800000, transaction_date: daysAgo(4) },
    { user_id: userId, business_id: pertanian.id, type: "pengeluaran", scope: "bisnis", category: "Pupuk", description: "Pupuk NPK", amount: 650000, transaction_date: daysAgo(7) },
  // Ternak — sedikit rugi (untuk demo insight)
    { user_id: userId, business_id: ternak.id, type: "pemasukan", scope: "bisnis", category: "Penjualan Hewan", description: "Jual ayam 80 ekor", amount: 2400000, transaction_date: daysAgo(10) },
    { user_id: userId, business_id: ternak.id, type: "pengeluaran", scope: "bisnis", category: "Pakan", description: "Konsentrat 2 ton", amount: 3200000, transaction_date: daysAgo(9) },
  ];

  await admin.from("transactions").insert(txRows);

  await admin.from("products").insert([
    { user_id: userId, business_id: kuliner.id, name: "Nasi Goreng Spesial", category: "Menu", stock: 50, min_stock: 10, price: 25000, cost: 12000 },
    { user_id: userId, business_id: kuliner.id, name: "Es Teh Manis", category: "Minuman", stock: 8, min_stock: 15, price: 8000, cost: 3000 },
    { user_id: userId, business_id: pertanian.id, name: "Cabai Merah", category: "Sayuran", stock: 120, min_stock: 20, price: 45000, cost: 25000 },
    { user_id: userId, business_id: pertanian.id, name: "Pupuk NPK", category: "Pupuk", stock: 3, min_stock: 5, price: null, cost: 85000 },
    { user_id: userId, business_id: ternak.id, name: "Ayam Broiler", category: "Ternak", stock: 200, min_stock: 50, price: 32000, cost: 22000 },
  ]);

  const { data: cabai } = await admin.from("products").select("id").eq("business_id", pertanian.id).eq("name", "Cabai Merah").maybeSingle();

  try {
    if (cabai?.id) {
      await admin.from("agri_harvest_meta").upsert({
        product_id: cabai.id, user_id: userId, business_id: pertanian.id,
        satuan: "kg", tanggal_panen: daysAgo(4), luas_lahan: 0.5,
      }, { onConflict: "product_id" });
    }
    await admin.from("agri_fields").insert({
      user_id: userId, business_id: pertanian.id, nama_lahan: "Blok A Utara",
      luas_lahan: 1.2, jenis_tanaman: "Cabai", status: "panen", tanggal_tanam: daysAgo(90),
    });
    await admin.from("agri_production_costs").insert({
      user_id: userId, business_id: pertanian.id, kategori: "Tenaga Kerja",
      jumlah: 400000, tanggal: daysAgo(12), catatan: "Panen minggu ini",
    });
  } catch {
    // Tabel pertanian belum dimigrasi — bisnis tetap jalan
  }

  const { data: batch } = await admin.from("farm_batches").insert({
    user_id: userId, business_id: ternak.id, nama_batch: "Batch Broiler Juli",
    jenis_ternak: "Ayam Broiler", tanggal_mulai: daysAgo(30), status: "aktif",
  }).select("id").single();

  if (batch?.id) {
    await admin.from("farm_transactions").insert([
      { batch_id: batch.id, user_id: userId, tanggal: daysAgo(28), jenis_transaksi: "bibit", nama_item: "DOC", qty: 200, satuan: "ekor", harga: 8000, total: 1600000 },
      { batch_id: batch.id, user_id: userId, tanggal: daysAgo(20), jenis_transaksi: "pakan", nama_item: "Konsentrat", qty: 500, satuan: "kg", harga: 6400, total: 3200000 },
      { batch_id: batch.id, user_id: userId, tanggal: daysAgo(10), jenis_transaksi: "panen", nama_item: "Ayam", qty: 80, satuan: "ekor", harga: 30000, total: 2400000 },
    ]);
  }
}

export async function provisionDemoAccount() {
  const userResult = await ensureDemoUser();
  if (!userResult.ok) return userResult;

  try {
    await seedDemoData(userResult.userId);
  } catch (e) {
    console.error("Demo seed partial error:", e);
  }

  return { ok: true as const, email: DEMO_EMAIL };
}
