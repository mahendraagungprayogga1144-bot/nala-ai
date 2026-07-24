import { createClient } from "@/lib/supabase/server";
import { unstable_rethrow } from "next/navigation";
import Link from "next/link";

/**
 * Safe Owner dashboard — no Recharts, no heavy joins.
 * Full dashboard lives in page.full.tsx until RSC crash is fully gone.
 */
export default async function DashboardOwnerPage() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const [{ data: profile }, { data: businesses, error: bizErr }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
      supabase
        .from("businesses")
        .select("id, name, type")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
    ]);

    if (bizErr) {
      return (
        <div className="px-4 py-8 sm:px-8">
          <h1 className="mb-2 text-lg font-semibold">Dashboard Owner</h1>
          <p className="font-mono text-xs text-[#EC4899]">Gagal load bisnis: {bizErr.message}</p>
        </div>
      );
    }

    const userName = profile?.full_name || user.email?.split("@")[0] || "Owner";
    const list = businesses || [];

    // Lightweight month omzet (no joins / no targets table)
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const bizIds = list.map((b) => b.id);
    let omzet = 0;
    if (bizIds.length) {
      const { data: txs } = await supabase
        .from("transactions")
        .select("amount, type")
        .in("business_id", bizIds)
        .eq("scope", "bisnis")
        .eq("type", "pemasukan")
        .gte("transaction_date", start)
        .limit(5000);
      omzet = (txs || []).reduce((s, t) => s + Number(t.amount || 0), 0);
    }

    return (
      <div className="px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="mb-1 text-xl font-semibold text-[#F0EFF8]">Halo, {userName}</h1>
        <p className="mb-6 text-sm text-[#8B8AA0]">
          Ringkasan aman — dashboard penuh chart sementara dimatikan biar tidak crash.
        </p>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/[0.08] bg-[#0D0D1A] p-4">
            <p className="text-[10px] uppercase tracking-wide text-[#8B8AA0]">Bisnis</p>
            <p className="mt-1 text-2xl font-bold text-[#2DD4BF]">{list.length}</p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#0D0D1A] p-4">
            <p className="text-[10px] uppercase tracking-wide text-[#8B8AA0]">Omzet bulan ini</p>
            <p className="mt-1 text-lg font-bold text-[#F0EFF8]">
              Rp{Math.round(omzet).toLocaleString("id-ID")}
            </p>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-2">
          {list.length === 0 ? (
            <p className="text-sm text-[#8B8AA0]">Belum ada bisnis. Buat di Multi Bisnis / onboarding.</p>
          ) : (
            list.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0D0D1A] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-[#F0EFF8]">{b.name}</p>
                  <p className="text-[11px] text-[#5A5B7A]">{b.type || "—"}</p>
                </div>
                <Link href="/dashboard/inventory" className="text-xs text-[#2DD4BF]">
                  Inventory →
                </Link>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/dashboard/inventory" className="text-[#2DD4BF] underline">
            Inventory
          </Link>
          <Link href="/dashboard/keuangan-bisnis" className="text-[#8B8AA0] underline">
            Keuangan Bisnis
          </Link>
          <Link href="/dashboard/upgrade" className="text-[#F59E0B] underline">
            Upgrade (trial 0 hari)
          </Link>
        </div>
      </div>
    );
  } catch (err) {
    unstable_rethrow(err);
    const message = err instanceof Error ? err.message : String(err);
    console.error("[owner-safe]", err);
    return (
      <div className="px-4 py-8 sm:px-8">
        <h1 className="mb-2 text-lg font-semibold">Owner error</h1>
        <p className="max-w-xl break-words font-mono text-xs text-[#EC4899]">{message}</p>
      </div>
    );
  }
}
