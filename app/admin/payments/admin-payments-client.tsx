"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Search, X, CheckCircle } from "lucide-react";
import type { AdminPayment } from "./page";

function fmtRp(n: number) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }
function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—"; }

const STATUS_COLORS: Record<string, string> = { paid: "#4ADE80", pending: "#F59E0B", failed: "#EC4899" };
const PLAN_COLORS: Record<string, string> = { free: "#8B8AA0", starter: "#38BDF8", pro: "#2DD4BF", enterprise: "#A78BFA" };

export default function AdminPaymentsClient({ payments }: { payments: AdminPayment[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState("");

  const filtered = useMemo(() => {
    return payments.filter(p => {
      if (search && !p.user_name?.toLowerCase().includes(search.toLowerCase()) && !p.invoice_id?.includes(search) && !p.user_id.includes(search)) return false;
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      return true;
    });
  }, [payments, search, filterStatus]);

  const totalPending = payments.filter(p => p.status === "pending").length;
  const totalPaid = payments.filter(p => p.status === "paid").reduce((s, p) => s + Number(p.amount), 0);

  const handleConfirm = async (p: AdminPayment) => {
    if (!confirm(`ACC pembayaran ${fmtRp(p.amount)} (${p.plan.toUpperCase()}) dari ${p.user_name || p.user_id.slice(0, 8)}? Langganan langsung aktif +30 hari.`)) return;
    setLoading(p.id);

    const now = new Date();

    await supabase.from("payments").update({
      status: "paid",
      confirmed_by: "mahendraagungprayogga1144@gmail.com",
      confirmed_at: now.toISOString(),
      period_start: now.toISOString().slice(0, 10),
    }).eq("id", p.id);

    // Perpanjangan menumpuk: kalau masih aktif di paket yang sama, tambah 30 hari dari sisa masa aktif
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("plan, status, expired_at")
      .eq("user_id", p.user_id)
      .maybeSingle();

    const base = existing?.expired_at && new Date(existing.expired_at) > now && existing.plan === p.plan
      ? new Date(existing.expired_at)
      : now;
    const expiredAt = new Date(base);
    expiredAt.setDate(expiredAt.getDate() + 30);

    await supabase.from("subscriptions").upsert({
      user_id: p.user_id,
      plan: p.plan,
      status: "active",
      expired_at: expiredAt.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: "user_id" });

    await supabase.from("payments").update({
      period_end: expiredAt.toISOString().slice(0, 10),
    }).eq("id", p.id);

    await supabase.from("admin_logs").insert({
      admin_email: "mahendraagungprayogga1144@gmail.com",
      action: "confirm_payment",
      target_user_id: p.user_id,
      detail: { payment_id: p.id, plan: p.plan, amount: p.amount, expired_at: expiredAt.toISOString() },
    });

    setLoading("");
    router.refresh();
  };

  const handleReject = async (p: AdminPayment) => {
    if (!confirm(`Tolak pembayaran ${fmtRp(p.amount)} dari ${p.user_name || p.user_id.slice(0, 8)}? User bisa mengajukan ulang.`)) return;
    setLoading(p.id);

    await supabase.from("payments").update({
      status: "failed",
      confirmed_by: "mahendraagungprayogga1144@gmail.com",
      confirmed_at: new Date().toISOString(),
    }).eq("id", p.id);

    await supabase.from("admin_logs").insert({
      admin_email: "mahendraagungprayogga1144@gmail.com",
      action: "reject_payment",
      target_user_id: p.user_id,
      detail: { payment_id: p.id, plan: p.plan, amount: p.amount },
    });

    setLoading("");
    router.refresh();
  };

  return (
    <div className="px-4 py-6 sm:px-8">
      <div className="mb-5">
        <h1 className="text-xl font-bold sm:text-2xl">Manajemen Pembayaran</h1>
        <p className="text-xs text-[#5A5B7A]">{payments.length} total · {totalPending} pending · Total paid: {fmtRp(totalPaid)}</p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0A0A12] px-3 py-2 min-w-[200px]">
          <Search size={14} className="text-[#5A5B7A]" />
          <input type="text" placeholder="Cari nama, invoice..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[#F0EFF8] placeholder:text-[#3A3B52] focus:outline-none" />
          {search && <button type="button" onClick={() => setSearch("")}><X size={14} className="text-[#5A5B7A]" /></button>}
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="rounded-lg border border-white/[0.08] bg-[#0A0A12] px-3 py-2 text-xs text-[#8B8AA0]">
          <option value="all">Semua Status</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/[0.06]" style={{ background: "#0D0D1A" }}>
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["User", "Paket", "Nominal", "Metode", "Status", "Invoice", "Tanggal", "Aksi"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#5A5B7A]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-xs text-[#3A3B52]">Tidak ada pembayaran</td></tr>
            ) : filtered.map(p => (
              <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <p className="text-xs font-medium text-[#F0EFF8] truncate max-w-[140px]">{p.user_name || "—"}</p>
                  <p className="text-[9px] text-[#5A5B7A]">{p.user_id.slice(0, 8)}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: (PLAN_COLORS[p.plan] || "#8B8AA0") + "22", color: PLAN_COLORS[p.plan] }}>
                    {p.plan.toUpperCase()}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs font-bold font-mono text-[#2DD4BF]">{fmtRp(p.amount)}</td>
                <td className="px-4 py-3 text-xs text-[#8B8AA0]">{p.method || "—"}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: STATUS_COLORS[p.status] || "#8B8AA0" }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLORS[p.status] || "#8B8AA0" }} />
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-[10px] font-mono text-[#5A5B7A]">{p.invoice_id || "—"}</td>
                <td className="px-4 py-3 text-xs text-[#8B8AA0] font-mono">{fmtDate(p.created_at)}</td>
                <td className="px-4 py-3">
                  {p.status === "pending" && (
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => handleConfirm(p)} disabled={loading === p.id}
                        className="rounded-lg border border-[#4ADE80]/30 bg-[#4ADE80]/10 px-2.5 py-1 text-[10px] font-medium text-[#4ADE80] disabled:opacity-40">
                        <CheckCircle size={10} className="inline mr-0.5" />
                        {loading === p.id ? "..." : "ACC"}
                      </button>
                      <button type="button" onClick={() => handleReject(p)} disabled={loading === p.id}
                        className="rounded-lg border border-[#EC4899]/30 bg-[#EC4899]/10 px-2.5 py-1 text-[10px] font-medium text-[#EC4899] disabled:opacity-40">
                        <X size={10} className="inline mr-0.5" />
                        Tolak
                      </button>
                    </div>
                  )}
                  {p.status === "paid" && p.confirmed_by && (
                    <span className="text-[9px] text-[#5A5B7A]">by admin</span>
                  )}
                  {p.status === "failed" && (
                    <span className="text-[9px] text-[#EC4899]/60">ditolak</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
