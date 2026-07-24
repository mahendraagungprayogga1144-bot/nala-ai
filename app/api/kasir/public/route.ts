import { NextResponse } from "next/server";
import { createPublicKasirDb, resolveEmployeeByToken } from "@/lib/kasir/public-db";
import { deductStockForSale, restoreStockApplies, validateCartStock } from "@/app/dashboard/fnb/lib/process-order";
import type { FnbMenu } from "@/app/dashboard/fnb/lib/calc";
import { calcHpp } from "@/app/dashboard/fnb/lib/calc";
import { todayWib } from "@/lib/date";

type SaleItem = { menu: FnbMenu; qty: number };

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!token || !action) {
    return NextResponse.json({ error: "token and action required" }, { status: 400 });
  }

  const db = createPublicKasirDb();
  if (!db) {
    return NextResponse.json({ error: "Kasir server belum dikonfigurasi" }, { status: 503 });
  }

  const employee = await resolveEmployeeByToken(db, token);
  if (!employee) {
    return NextResponse.json({ error: "Link tidak valid" }, { status: 404 });
  }

  const { data: business } = await db
    .from("businesses")
    .select("id, name, type, user_id")
    .eq("id", employee.business_id)
    .maybeSingle();
  if (!business) {
    return NextResponse.json({ error: "Bisnis tidak ditemukan" }, { status: 404 });
  }

  const today = todayWib();

  if (action === "checkin") {
    const jam = typeof body.jam === "string" ? body.jam : new Date().toTimeString().slice(0, 5);
    const { data, error } = await db
      .from("checkins")
      .insert({
        employee_id: employee.id,
        business_id: business.id,
        user_id: business.user_id,
        tanggal: today,
        jam_masuk: jam,
      })
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ checkinId: data?.id || null });
  }

  if (action === "checkout") {
    const checkinId = typeof body.checkinId === "string" ? body.checkinId : "";
    const jam = typeof body.jam === "string" ? body.jam : new Date().toTimeString().slice(0, 5);
    if (!checkinId) return NextResponse.json({ ok: true });
    const { error } = await db
      .from("checkins")
      .update({ jam_keluar: jam })
      .eq("id", checkinId)
      .eq("employee_id", employee.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "webauthn") {
    const credId = typeof body.credentialId === "string" ? body.credentialId : "";
    if (!credId) return NextResponse.json({ error: "credentialId required" }, { status: 400 });
    const { error } = await db
      .from("employees")
      .update({ webauthn_credential_id: credId })
      .eq("id", employee.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "shiftOrders") {
    const checkinId = typeof body.checkinId === "string" ? body.checkinId : null;
    let jamMasuk = "—";
    if (checkinId) {
      const { data: ci } = await db.from("checkins").select("jam_masuk").eq("id", checkinId).eq("employee_id", employee.id).maybeSingle();
      jamMasuk = ci?.jam_masuk || "—";
    }
    const withEmbed = await db
      .from("orders")
      .select("id, total, created_at, order_items(qty, menu_id, menus(nama))")
      .eq("business_id", business.id)
      .eq("user_id", employee.id)
      .eq("order_date", today)
      .order("created_at", { ascending: false });

    let orderRows = withEmbed.data;
    if (withEmbed.error) {
      const plain = await db
        .from("orders")
        .select("id, total, created_at, order_items(qty, menu_id)")
        .eq("business_id", business.id)
        .eq("user_id", employee.id)
        .eq("order_date", today)
        .order("created_at", { ascending: false });
      const menuIds = [
        ...new Set(
          (plain.data || []).flatMap((o) =>
            ((o.order_items || []) as { menu_id?: string }[]).map((i) => i.menu_id).filter(Boolean),
          ),
        ),
      ] as string[];
      const nameById = new Map<string, string>();
      if (menuIds.length) {
        const { data: menuRows } = await db.from("menus").select("id, nama").in("id", menuIds);
        for (const m of menuRows || []) nameById.set(m.id, m.nama);
      }
      const orders = (plain.data || []).map((o) => {
        const items = (o.order_items || []) as { qty: number; menu_id?: string }[];
        const itemsSummary = items
          .map((i) => `${nameById.get(i.menu_id || "") || "Menu"} x${i.qty}`)
          .join(", ");
        return { id: o.id, total: Number(o.total), created_at: o.created_at, itemsSummary };
      });
      return NextResponse.json({ jamMasuk, orders });
    }

    const orders = (orderRows || []).map((o) => {
      const items = (o.order_items || []) as {
        qty: number;
        menus: { nama: string } | { nama: string }[] | null;
      }[];
      const itemsSummary = items
        .map((i) => {
          const m = i.menus;
          const nama = Array.isArray(m) ? m[0]?.nama : m?.nama;
          return `${nama || "Menu"} x${i.qty}`;
        })
        .join(", ");
      return { id: o.id, total: Number(o.total), created_at: o.created_at, itemsSummary };
    });

    return NextResponse.json({ jamMasuk, orders });
  }

  if (action === "sale") {
    const cartItems = (Array.isArray(body.cartItems) ? body.cartItems : []) as SaleItem[];
    const diskon = Number(body.diskon) || 0;
    const metodeBayar = typeof body.metodeBayar === "string" ? body.metodeBayar : "tunai";
    const catatan = typeof body.catatan === "string" ? body.catatan : null;

    if (!cartItems.length) {
      return NextResponse.json({ error: "Keranjang kosong" }, { status: 400 });
    }

    const stockCheck = validateCartStock(cartItems.map((c) => ({ menu: c.menu, qty: c.qty })));
    if (!stockCheck.ok) {
      return NextResponse.json({ error: stockCheck.message }, { status: 400 });
    }

    const subtotal = cartItems.reduce((s, c) => s + c.menu.harga_jual * c.qty, 0);
    const totalHpp = cartItems.reduce((s, c) => s + calcHpp(c.menu) * c.qty, 0);
    const total = Math.max(0, subtotal - diskon);
    const laba = total - totalHpp;

    const { data: order, error } = await db
      .from("orders")
      .insert({
        user_id: employee.id,
        business_id: business.id,
        total,
        diskon,
        hpp: totalHpp,
        laba,
        metode_bayar: metodeBayar,
        catatan,
        order_date: today,
      })
      .select("id")
      .maybeSingle();

    if (error || !order) {
      return NextResponse.json({ error: error?.message || "Gagal buat order" }, { status: 400 });
    }

    const { error: itemsErr } = await db.from("order_items").insert(
      cartItems.map((c) => ({
        order_id: order.id,
        menu_id: c.menu.id,
        qty: c.qty,
        harga_jual: c.menu.harga_jual,
        hpp: calcHpp(c.menu),
        laba: (c.menu.harga_jual - calcHpp(c.menu)) * c.qty,
      })),
    );
    if (itemsErr) {
      await db.from("orders").delete().eq("id", order.id);
      return NextResponse.json({ error: "Gagal simpan item: " + itemsErr.message }, { status: 400 });
    }

    // Keep order + catatan even if stock/finance steps warn (legacy F&B UX).
    const warnings: string[] = [];
    const stockResult = await deductStockForSale(
      db,
      cartItems.map((c) => ({ menu: c.menu, qty: c.qty })),
      business.user_id,
      { today, notePrefix: `Kasir ${employee.nama}` },
    );
    if (!stockResult.ok) {
      warnings.push("Stok sebagian gagal dipotong: " + stockResult.errors.join(", "));
    }

    const { error: txErr } = await db.from("transactions").insert({
      user_id: business.user_id,
      business_id: business.id,
      type: "pemasukan",
      scope: "bisnis",
      category: "Penjualan F&B",
      description: `[${employee.nama}] ` + cartItems.map((c) => c.menu.nama + " x" + c.qty).join(", "),
      amount: total,
      transaction_date: today,
    });
    if (txErr) {
      if (stockResult.ok && stockResult.applied.length) {
        await restoreStockApplies(db, stockResult.applied);
      }
      warnings.push("Keuangan gagal dicatat: " + txErr.message);
    }

    return NextResponse.json({
      orderId: order.id,
      total,
      laba: Math.round(laba),
      totalHpp,
      warnings,
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
