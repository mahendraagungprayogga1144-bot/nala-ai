"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, ChevronRight } from "lucide-react";
import type { MpStore, MpOrder } from "../page";
import { ORDER_STATUS, STATUS_STYLE, platformColor, fmtRp, PLATFORMS } from "../mp-constants";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../../components/module-form-styles";

function nextStatus(current: string): string | null {
  const flow = ["baru", "proses", "kirim", "selesai"];
  const idx = flow.indexOf(current);
  return idx >= 0 && idx < flow.length - 1 ? flow[idx + 1] : null;
}

export default function MpOrdersTab({
  stores, orders, businessId, userId,
}: { stores: MpStore[]; orders: MpOrder[]; businessId: string; userId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [form, setForm] = useState({ store_id: stores[0]?.id || "", no_pesanan: "", pembeli: "", total: "", status: "baru" as string, tanggal: new Date().toISOString().slice(0, 10), catatan: "" });

  const filtered = useMemo(() => {
    let list = orders;
    if (filterPlatform) list = list.filter(o => o.platform === filterPlatform);
    if (filterStatus) list = list.filter(o => o.status === filterStatus);
    return list;
  }, [orders, filterPlatform, filterStatus]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pembeli.trim() || !form.store_id) return;
    setLoading(true);
    const store = stores.find(s => s.id === form.store_id);
    const { error } = await supabase.from("module_mp_orders").insert({
      user_id: userId, business_id: businessId,
      store_id: form.store_id, platform: store?.platform || null,
      no_pesanan: form.no_pesanan || null,
      pembeli: form.pembeli.trim(),
      total: Number(form.total) || 0,
      status: form.status,
      tanggal: form.tanggal,
      catatan: form.catatan || null,
    });
    setLoading(false);
    if (error) return alert(error.message);
    setForm({ store_id: stores[0]?.id || "", no_pesanan: "", pembeli: "", total: "", status: "baru", tanggal: new Date().toISOString().slice(0, 10), catatan: "" });
    setOpen(false);
    router.refresh();
  };

  const advanceStatus = async (id: string, next: string) => {
    await supabase.from("module_mp_orders").update({ status: next }).eq("id", id);
    router.refresh();
  };

  const cancelOrder = async (id: string) => {
    if (!confirm("Batalkan pesanan ini?")) return;
    await supabase.from("module_mp_orders").update({ status: "batal" }).eq("id", id);
    router.refresh();
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="text-sm text-[#8B8AA0]">{filtered.length} pesanan</p>
        <div className="flex-1" />
        <select className={MODULE_INPUT + " !w-auto !min-w-[120px]"} value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}>
          <option value="">Semua platform</option>
          {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className={MODULE_INPUT + " !w-auto !min-w-[120px]"} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Semua status</option>
          {ORDER_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="button" onClick={() => setOpen(!open)} disabled={stores.length === 0} className={"flex items-center gap-1.5 " + MODULE_BTN}>
          <Plus size={14} /> Input pesanan
        </button>
      </div>

      {stores.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
          <p className="text-sm text-[#5A5B7A]">Tambahkan toko terlebih dahulu di tab Toko.</p>
        </div>
      )}

      {open && (
        <form onSubmit={save} className={MODULE_CARD + " mb-6 grid gap-3 sm:grid-cols-2"}>
          <select required className={MODULE_INPUT} value={form.store_id} onChange={e => setForm({ ...form, store_id: e.target.value })}>
            <option value="">Pilih toko *</option>
            {stores.map(s => <option key={s.id} value={s.id}>{s.nama_toko} ({s.platform})</option>)}
          </select>
          <input className={MODULE_INPUT} placeholder="No pesanan" value={form.no_pesanan} onChange={e => setForm({ ...form, no_pesanan: e.target.value })} />
          <input required className={MODULE_INPUT} placeholder="Nama pembeli *" value={form.pembeli} onChange={e => setForm({ ...form, pembeli: e.target.value })} />
          <input required className={MODULE_INPUT} type="number" placeholder="Total (Rp) *" value={form.total} onChange={e => setForm({ ...form, total: e.target.value })} />
          <select className={MODULE_INPUT} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            {ORDER_STATUS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input className={MODULE_INPUT} type="date" value={form.tanggal} onChange={e => setForm({ ...form, tanggal: e.target.value })} />
          <input className={MODULE_INPUT + " sm:col-span-2"} placeholder="Catatan" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={loading} className={MODULE_BTN + " flex-1"}>{loading ? "Menyimpan..." : "Simpan pesanan"}</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-[#8B8AA0]">Batal</button>
          </div>
        </form>
      )}

      {/* Orders table */}
      {filtered.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0D0D1A]">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-[#5A5B7A]">
                <th className="p-3">Pesanan</th>
                <th className="p-3 hidden sm:table-cell">Pembeli</th>
                <th className="p-3">Platform</th>
                <th className="p-3 text-right">Total</th>
                <th className="p-3">Status</th>
                <th className="p-3 hidden sm:table-cell">Tanggal</th>
                <th className="p-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => {
                const st = STATUS_STYLE[o.status] || STATUS_STYLE.baru;
                const next = nextStatus(o.status);
                return (
                  <tr key={o.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <td className="p-3">
                      <p className="font-medium">{o.no_pesanan || "—"}</p>
                      <p className="text-[10px] text-[#5A5B7A] sm:hidden">{o.pembeli}</p>
                    </td>
                    <td className="p-3 hidden sm:table-cell text-[#8B8AA0]">{o.pembeli}</td>
                    <td className="p-3">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: platformColor(o.platform) + "22", color: platformColor(o.platform) }}>
                        {o.platform || "—"}
                      </span>
                    </td>
                    <td className="p-3 text-right font-mono text-xs font-semibold text-[#2DD4BF]">{fmtRp(Number(o.total))}</td>
                    <td className="p-3">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: st.bg, color: st.text, border: `1px solid ${st.border}` }}>
                        {o.status}
                      </span>
                    </td>
                    <td className="p-3 hidden sm:table-cell text-xs text-[#5A5B7A]">{o.tanggal}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        {next && (
                          <button type="button" onClick={() => advanceStatus(o.id, next)} title={`Update → ${next}`} className="rounded-lg p-1 text-[#2DD4BF] hover:bg-[#2DD4BF]/10">
                            <ChevronRight size={14} />
                          </button>
                        )}
                        {o.status !== "batal" && o.status !== "selesai" && (
                          <button type="button" onClick={() => cancelOrder(o.id)} className="rounded-lg p-1 text-[#5A5B7A] hover:text-[#F43F5E] hover:bg-[#F43F5E]/10 text-[10px]">
                            ✕
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
