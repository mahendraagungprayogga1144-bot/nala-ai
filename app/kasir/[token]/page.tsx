import { createPublicKasirDb, resolveEmployeeByToken } from "@/lib/kasir/public-db";
import KasirPublicClient from "./kasir-public-client";
import { normalizeMenus } from "@/app/dashboard/fnb/lib/calc";
import { loadActiveMenusForKasir } from "@/app/dashboard/fnb/lib/load-active-menus";
import { todayWib } from "@/lib/date";

export default async function KasirPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = createPublicKasirDb();

  if (!db) {
    return (
      <div style={{ background: "#070711", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", color: "#F0EFF8" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: ".5rem" }}>Kasir belum siap</div>
          <div style={{ fontSize: "13px", color: "#5A5B7A" }}>Hubungi admin — konfigurasi server belum lengkap.</div>
        </div>
      </div>
    );
  }

  const employee = await resolveEmployeeByToken(db, token);

  if (!employee) {
    return (
      <div style={{ background: "#070711", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", color: "#F0EFF8" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "1rem" }}>⚠️</div>
          <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: ".5rem" }}>Link tidak valid</div>
          <div style={{ fontSize: "13px", color: "#5A5B7A" }}>Hubungi owner untuk mendapatkan link kasir yang benar.</div>
        </div>
      </div>
    );
  }

  const { data: businessData } = await db
    .from("businesses")
    .select("id, name, type, user_id")
    .eq("id", employee.business_id)
    .maybeSingle();

  if (!businessData) {
    return (
      <div style={{ background: "#070711", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", color: "#F0EFF8" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "1rem" }}>⚠️</div>
          <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: ".5rem" }}>Bisnis tidak ditemukan</div>
          <div style={{ fontSize: "13px", color: "#5A5B7A" }}>Hubungi owner untuk bantuan.</div>
        </div>
      </div>
    );
  }

  const business = businessData;
  const today = todayWib();

  const [{ menus, error: menusErr }, { data: todayOrders }] = await Promise.all([
    loadActiveMenusForKasir(db, business.id),
    db
      .from("orders")
      .select("total, hpp, laba")
      .eq("business_id", business.id)
      .eq("user_id", employee.id)
      .eq("order_date", today),
  ]);

  if (menusErr) {
    return (
      <div style={{ background: "#070711", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", color: "#F0EFF8" }}>
        <div style={{ textAlign: "center", maxWidth: 360, padding: 16 }}>
          <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: ".5rem" }}>Gagal memuat menu</div>
          <div style={{ fontSize: "12px", color: "#EC4899" }}>{menusErr}</div>
        </div>
      </div>
    );
  }

  const omzet = todayOrders?.reduce((s, o) => s + Number(o.total || 0), 0) || 0;
  const laba = todayOrders?.reduce((s, o) => s + Number(o.laba || 0), 0) || 0;
  const totalOrders = todayOrders?.length || 0;
  const totalHpp = todayOrders?.reduce((s, o) => s + Number(o.hpp || 0), 0) || 0;
  const foodCost = omzet > 0 ? Math.round((totalHpp / omzet) * 100) : 0;

  return (
    <KasirPublicClient
      employee={{
        id: employee.id,
        nama: employee.nama,
        jabatan: employee.jabatan,
        kasir_token: token,
        webauthn_credential_id: employee.webauthn_credential_id,
      }}
      business={business}
      ownerUserId={business.user_id}
      menus={normalizeMenus(menus as Parameters<typeof normalizeMenus>[0])}
      initialStats={{ omzet, laba, totalOrders, foodCost }}
      today={today}
    />
  );
}
