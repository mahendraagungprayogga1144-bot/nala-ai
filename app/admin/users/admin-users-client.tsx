"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Search, X, Clock, Plus, Ban } from "lucide-react";
import type { AdminUser } from "./page";

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—"; }

const PLAN_COLORS: Record<string, string> = { free: "#8B8AA0", starter: "#38BDF8", pro: "#2DD4BF", enterprise: "#A78BFA" };
const STATUS_COLORS: Record<string, string> = { active: "#4ADE80", expired: "#EC4899", trial: "#F59E0B", suspended: "#EF4444" };

export default function AdminUsersClient({ users }: { users: AdminUser[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editPlan, setEditPlan] = useState("free");
  const [editDays, setEditDays] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    return users.filter(u => {
      if (search && !u.name?.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase()) && !u.user_id.includes(search)) return false;
      if (filterPlan !== "all" && u.plan !== filterPlan) return false;
      if (filterStatus !== "all" && u.status !== filterStatus) return false;
      return true;
    });
  }, [users, search, filterPlan, filterStatus]);

  const now = new Date();

  const getRemainingDays = (exp: string | null) => {
    if (!exp) return null;
    const diff = Math.ceil((new Date(exp).getTime() - now.getTime()) / 86_400_000);
    return diff;
  };

  const openEdit = (u: AdminUser) => {
    setEditUser(u);
    setEditPlan(u.plan);
    setEditDays("");
    setEditNotes("");
  };

  const handleSave = async () => {
    if (!editUser) return;
    setLoading(true);

    const daysToAdd = Number(editDays) || 0;
    const currentExpiry = editUser.expired_at ? new Date(editUser.expired_at) : new Date();
    if (daysToAdd > 0) currentExpiry.setDate(currentExpiry.getDate() + daysToAdd);

    const { error } = await supabase.from("subscriptions").upsert({
      user_id: editUser.user_id,
      plan: editPlan,
      status: "active",
      expired_at: daysToAdd > 0 ? currentExpiry.toISOString() : editUser.expired_at,
      notes: editNotes || null,
      extended_by: "admin",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    if (!error) {
      await supabase.from("admin_logs").insert({
        admin_email: "mahendraagungprayogga1144@gmail.com",
        action: "edit_subscription",
        target_user_id: editUser.user_id,
        detail: { plan: editPlan, days_added: daysToAdd, notes: editNotes },
      });
    }

    setEditUser(null);
    setLoading(false);
    router.refresh();
  };

  const handleSuspend = async (u: AdminUser) => {
    if (!confirm(`Suspend user ${u.name || u.user_id}?`)) return;
    await supabase.from("subscriptions").upsert({
      user_id: u.user_id, plan: "free", status: "suspended", updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    await supabase.from("admin_logs").insert({
      admin_email: "mahendraagungprayogga1144@gmail.com", action: "suspend_user", target_user_id: u.user_id, detail: {},
    });
    router.refresh();
  };

  const inputCls = "w-full rounded-xl border border-white/[0.08] bg-[#0A0A12] px-3 py-2.5 text-sm text-[#F0EFF8] outline-none focus:border-[#2DD4BF]/40";

  return (
    <div className="px-4 py-6 sm:px-8">
      <div className="mb-5">
        <h1 className="text-xl font-bold sm:text-2xl">Manajemen User</h1>
        <p className="text-xs text-[#5A5B7A]">{users.length} total user terdaftar</p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#0A0A12] px-3 py-2 min-w-[200px]">
          <Search size={14} className="text-[#5A5B7A]" />
          <input type="text" placeholder="Cari nama, email, atau ID..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[#F0EFF8] placeholder:text-[#3A3B52] focus:outline-none" />
          {search && <button type="button" onClick={() => setSearch("")}><X size={14} className="text-[#5A5B7A]" /></button>}
        </div>
        <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)}
          className="rounded-lg border border-white/[0.08] bg-[#0A0A12] px-3 py-2 text-xs text-[#8B8AA0]">
          <option value="all">Semua Paket</option>
          <option value="free">Gratis</option>
          <option value="starter">Starter</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="rounded-lg border border-white/[0.08] bg-[#0A0A12] px-3 py-2 text-xs text-[#8B8AA0]">
          <option value="all">Semua Status</option>
          <option value="active">Aktif</option>
          <option value="expired">Expired</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-white/[0.06]" style={{ background: "#0D0D1A" }}>
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              {["Nama", "Paket", "Status", "Terdaftar", "Expired", "Sisa Hari", "Bisnis", "Aksi"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wide text-[#5A5B7A]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-xs text-[#3A3B52]">Tidak ada user ditemukan</td></tr>
            ) : filtered.map(u => {
              const remaining = getRemainingDays(u.expired_at);
              const urgentColor = remaining !== null && remaining <= 7 ? "#EC4899" : remaining !== null && remaining <= 30 ? "#F59E0B" : "#8B8AA0";
              return (
                <tr key={u.user_id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <p className="text-xs font-medium text-[#F0EFF8] truncate max-w-[150px]">{u.name || "—"}</p>
                    <p className="text-[9px] text-[#5A5B7A] truncate max-w-[150px]">{u.email || u.user_id.slice(0, 8)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: (PLAN_COLORS[u.plan] || "#8B8AA0") + "22", color: PLAN_COLORS[u.plan] }}>
                      {u.plan.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: STATUS_COLORS[u.status] || "#8B8AA0" }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLORS[u.status] || "#8B8AA0" }} />
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#8B8AA0] font-mono">{fmtDate(u.created_at)}</td>
                  <td className="px-4 py-3 text-xs text-[#8B8AA0] font-mono">{fmtDate(u.expired_at)}</td>
                  <td className="px-4 py-3">
                    {remaining !== null ? (
                      <span className="text-xs font-bold font-mono" style={{ color: urgentColor }}>
                        {remaining > 0 ? `${remaining} hari` : "EXPIRED"}
                      </span>
                    ) : <span className="text-xs text-[#3A3B52]">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-[#8B8AA0]">{u.business_count}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button type="button" onClick={() => openEdit(u)}
                        className="rounded-lg border border-[#2DD4BF]/30 bg-[#2DD4BF]/10 px-2 py-1 text-[10px] font-medium text-[#2DD4BF]">
                        <Plus size={10} className="inline mr-0.5" />Edit
                      </button>
                      <button type="button" onClick={() => handleSuspend(u)}
                        className="rounded-lg border border-[#EC4899]/30 bg-[#EC4899]/10 px-2 py-1 text-[10px] font-medium text-[#EC4899]">
                        <Ban size={10} className="inline mr-0.5" />Suspend
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050508]/80 backdrop-blur-sm" onClick={() => setEditUser(null)}>
          <div className="w-full max-w-md rounded-2xl border border-white/[0.08] p-6" style={{ background: "#0D0D1A" }} onClick={e => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-bold">Edit Langganan</h3>
              <button type="button" onClick={() => setEditUser(null)}><X size={16} className="text-[#5A5B7A]" /></button>
            </div>
            <p className="mb-4 text-xs text-[#8B8AA0]">{editUser.name || editUser.user_id.slice(0, 8)}</p>

            <div className="mb-3">
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-[#8B8AA0]">Paket</label>
              <select value={editPlan} onChange={e => setEditPlan(e.target.value)} className={inputCls}>
                <option value="free">Gratis</option>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div className="mb-3">
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-[#8B8AA0]">Tambah Hari</label>
              <div className="flex gap-2">
                {[7, 30, 365].map(d => (
                  <button key={d} type="button" onClick={() => setEditDays(String(d))}
                    className={"rounded-lg border px-3 py-1.5 text-xs font-medium " +
                      (editDays === String(d) ? "border-[#2DD4BF]/40 text-[#2DD4BF] bg-[#2DD4BF]/10" : "border-white/[0.08] text-[#5A5B7A]")}>
                    +{d} hari
                  </button>
                ))}
                <input type="number" placeholder="Custom" value={editDays} onChange={e => setEditDays(e.target.value)} className={inputCls + " w-24 font-mono"} />
              </div>
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-[#8B8AA0]">Catatan Internal</label>
              <input type="text" placeholder="Alasan extend, promo, dll" value={editNotes} onChange={e => setEditNotes(e.target.value)} className={inputCls} />
            </div>
            <button type="button" onClick={handleSave} disabled={loading}
              className="w-full rounded-xl py-3 text-sm font-bold disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}>
              {loading ? "Menyimpan..." : "Simpan Perubahan"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
