"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Percent, Plus } from "lucide-react";
import ModuleHeader from "../components/module-header";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../components/module-form-styles";

type Staff = { id: string; nama: string; jabatan: string | null; komisi_pct: number | null; telepon: string | null };
type Sale = {
  id: string; tanggal: string; omzet: number; catatan: string | null;
  module_commission_staff: { nama: string; komisi_pct: number | null } | { nama: string; komisi_pct: number | null }[] | null;
};

export default function TimKomisiClient({
  businessId, businessName, userId, staff, sales,
}: { businessId: string; businessName: string; userId: string; staff: Staff[]; sales: Sale[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<"staff" | "sales">("staff");
  const [loading, setLoading] = useState(false);
  const [staffForm, setStaffForm] = useState({ nama: "", jabatan: "", komisi_pct: "5", telepon: "" });
  const [saleForm, setSaleForm] = useState({ staff_id: "", tanggal: new Date().toISOString().split("T")[0], omzet: "", catatan: "" });

  const saveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.nama.trim() || !businessId) return;
    setLoading(true);
    const { error } = await supabase.from("module_commission_staff").insert({
      user_id: userId, business_id: businessId,
      nama: staffForm.nama.trim(), jabatan: staffForm.jabatan || null,
      komisi_pct: Number(staffForm.komisi_pct) || 5, telepon: staffForm.telepon || null,
    });
    setLoading(false);
    if (error) return alert(error.message);
    setStaffForm({ nama: "", jabatan: "", komisi_pct: "5", telepon: "" });
    router.refresh();
  };

  const saveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleForm.staff_id || !businessId) return;
    setLoading(true);
    const { error } = await supabase.from("module_commission_sales").insert({
      user_id: userId, business_id: businessId,
      staff_id: saleForm.staff_id, tanggal: saleForm.tanggal,
      omzet: Number(saleForm.omzet) || 0, catatan: saleForm.catatan || null,
    });
    setLoading(false);
    if (error) return alert(error.message);
    setSaleForm({ staff_id: "", tanggal: new Date().toISOString().split("T")[0], omzet: "", catatan: "" });
    router.refresh();
  };

  const staffName = (s: Sale) => {
    const st = s.module_commission_staff;
    if (!st) return "—";
    return Array.isArray(st) ? st[0]?.nama : st.nama;
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
      <ModuleHeader icon={Percent} title="Tim dan Komisi Karyawan" subtitle={`${businessName} — input tim & penjualan sendiri`} status="beta" />

      <div className="mb-4 flex gap-2">
        {(["staff", "sales"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)} className={"rounded-lg border px-3 py-1.5 text-xs font-medium " + (tab === t ? "border-[#2DD4BF]/50 bg-[#2DD4BF]/15 text-[#2DD4BF]" : "border-white/10 text-[#8B8AA0]")}>
            {t === "staff" ? "Data tim" : "Input penjualan"}
          </button>
        ))}
      </div>

      {tab === "staff" ? (
        <>
          <form onSubmit={saveStaff} className={MODULE_CARD + " mb-6 grid gap-3 sm:grid-cols-2"}>
            <input required className={MODULE_INPUT} placeholder="Nama karyawan *" value={staffForm.nama} onChange={e => setStaffForm({ ...staffForm, nama: e.target.value })} />
            <input className={MODULE_INPUT} placeholder="Jabatan" value={staffForm.jabatan} onChange={e => setStaffForm({ ...staffForm, jabatan: e.target.value })} />
            <input className={MODULE_INPUT} type="number" placeholder="Komisi %" value={staffForm.komisi_pct} onChange={e => setStaffForm({ ...staffForm, komisi_pct: e.target.value })} />
            <input className={MODULE_INPUT} placeholder="Telepon" value={staffForm.telepon} onChange={e => setStaffForm({ ...staffForm, telepon: e.target.value })} />
            <button type="submit" disabled={loading} className={MODULE_BTN + " sm:col-span-2 flex items-center justify-center gap-2"}><Plus size={16} /> Tambah anggota tim</button>
          </form>
          {staff.map(s => (
            <div key={s.id} className={MODULE_CARD + " mb-2 flex justify-between"}>
              <div><p className="font-medium">{s.nama}</p><p className="text-xs text-[#8B8AA0]">{s.jabatan || "—"} · komisi {s.komisi_pct}%</p></div>
            </div>
          ))}
        </>
      ) : (
        <>
          <form onSubmit={saveSale} className={MODULE_CARD + " mb-6 grid gap-3 sm:grid-cols-2"}>
            <select required className={MODULE_INPUT} value={saleForm.staff_id} onChange={e => setSaleForm({ ...saleForm, staff_id: e.target.value })}>
              <option value="">Pilih karyawan *</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.nama}</option>)}
            </select>
            <input type="date" className={MODULE_INPUT} value={saleForm.tanggal} onChange={e => setSaleForm({ ...saleForm, tanggal: e.target.value })} />
            <input required type="number" className={MODULE_INPUT} placeholder="Omzet penjualan (Rp) *" value={saleForm.omzet} onChange={e => setSaleForm({ ...saleForm, omzet: e.target.value })} />
            <input className={MODULE_INPUT} placeholder="Catatan" value={saleForm.catatan} onChange={e => setSaleForm({ ...saleForm, catatan: e.target.value })} />
            <button type="submit" disabled={loading || staff.length === 0} className={MODULE_BTN + " sm:col-span-2"}>{loading ? "Menyimpan..." : "Catat penjualan"}</button>
          </form>
          {sales.map(s => {
            const pct = staff.find(x => x.nama === staffName(s))?.komisi_pct ?? 5;
            const komisi = Math.round(Number(s.omzet) * (Number(pct) / 100));
            return (
              <div key={s.id} className={MODULE_CARD + " mb-2 flex justify-between"}>
                <div><p className="font-medium">{staffName(s)} · {s.tanggal}</p><p className="text-xs text-[#8B8AA0]">Omzet Rp{Number(s.omzet).toLocaleString("id-ID")}</p></div>
                <p className="font-mono text-sm text-[#F59E0B]">Rp{komisi.toLocaleString("id-ID")}</p>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
