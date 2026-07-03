"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FileText, Plus } from "lucide-react";
import ModuleHeader from "../components/module-header";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../components/module-form-styles";

const BULAN = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

type TaxRecord = {
  id: string;
  npwp: string | null;
  nama_wp: string | null;
  alamat: string | null;
  jenis_usaha: string | null;
  omzet_lapor: number | null;
  pengeluaran_lapor: number | null;
  periode_bulan: number;
  periode_tahun: number;
  catatan: string | null;
  created_at: string;
};

export default function PajakNpwpClient({
  businessId, businessName, userId, bulan, tahun, records,
}: {
  businessId: string; businessName: string; userId: string;
  bulan: number; tahun: number; records: TaxRecord[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    npwp: "", nama_wp: "", alamat: "", jenis_usaha: "",
    omzet_lapor: "", pengeluaran_lapor: "", periode_bulan: String(bulan), periode_tahun: String(tahun), catatan: "",
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return alert("Pilih bisnis aktif dulu.");
    setLoading(true);
    const { error } = await supabase.from("module_tax_profiles").insert({
      user_id: userId,
      business_id: businessId,
      npwp: form.npwp || null,
      nama_wp: form.nama_wp || null,
      alamat: form.alamat || null,
      jenis_usaha: form.jenis_usaha || null,
      omzet_lapor: Number(form.omzet_lapor) || 0,
      pengeluaran_lapor: Number(form.pengeluaran_lapor) || 0,
      periode_bulan: Number(form.periode_bulan) || bulan,
      periode_tahun: Number(form.periode_tahun) || tahun,
      catatan: form.catatan || null,
    });
    setLoading(false);
    if (error) return alert(error.message);
    setOpen(false);
    router.refresh();
  };

  const fmt = (n: number | null) => "Rp" + Math.round(Number(n || 0)).toLocaleString("id-ID");

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
      <ModuleHeader icon={FileText} title="Pajak NPWP Center" subtitle={`${businessName} — input data pajak sendiri`} status="beta" />

      <button type="button" onClick={() => setOpen(!open)} className={"mb-6 flex items-center gap-2 " + MODULE_BTN}>
        <Plus size={16} /> Tambah data NPWP / laporan
      </button>

      {open && (
        <form onSubmit={save} className={MODULE_CARD + " mb-6 grid gap-3 sm:grid-cols-2"}>
          <input className={MODULE_INPUT} placeholder="NPWP" value={form.npwp} onChange={e => setForm({ ...form, npwp: e.target.value })} />
          <input className={MODULE_INPUT} placeholder="Nama wajib pajak" value={form.nama_wp} onChange={e => setForm({ ...form, nama_wp: e.target.value })} />
          <input className={MODULE_INPUT + " sm:col-span-2"} placeholder="Alamat" value={form.alamat} onChange={e => setForm({ ...form, alamat: e.target.value })} />
          <input className={MODULE_INPUT} placeholder="Jenis usaha" value={form.jenis_usaha} onChange={e => setForm({ ...form, jenis_usaha: e.target.value })} />
          <input className={MODULE_INPUT} type="number" placeholder="Omzet dilapor (Rp)" value={form.omzet_lapor} onChange={e => setForm({ ...form, omzet_lapor: e.target.value })} />
          <input className={MODULE_INPUT} type="number" placeholder="Pengeluaran dilapor (Rp)" value={form.pengeluaran_lapor} onChange={e => setForm({ ...form, pengeluaran_lapor: e.target.value })} />
          <input className={MODULE_INPUT} type="number" placeholder="Bulan (1-12)" value={form.periode_bulan} onChange={e => setForm({ ...form, periode_bulan: e.target.value })} />
          <input className={MODULE_INPUT} type="number" placeholder="Tahun" value={form.periode_tahun} onChange={e => setForm({ ...form, periode_tahun: e.target.value })} />
          <input className={MODULE_INPUT + " sm:col-span-2"} placeholder="Catatan" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} />
          <button type="submit" disabled={loading} className={MODULE_BTN + " sm:col-span-2"}>{loading ? "Menyimpan..." : "Simpan data pajak"}</button>
        </form>
      )}

      {records.length === 0 ? (
        <p className="text-center text-sm text-[#8B8AA0]">Belum ada data. Tambah NPWP & laporan omzet manual di atas.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {records.map(r => (
            <div key={r.id} className={MODULE_CARD}>
              <p className="font-semibold">{r.nama_wp || "Wajib Pajak"} · {BULAN[r.periode_bulan]} {r.periode_tahun}</p>
              <p className="text-xs text-[#8B8AA0]">NPWP: {r.npwp || "—"} · {r.jenis_usaha || "—"}</p>
              <p className="mt-2 font-mono text-sm text-[#2DD4BF]">Omzet {fmt(r.omzet_lapor)} · Pengeluaran {fmt(r.pengeluaran_lapor)}</p>
              {r.catatan && <p className="mt-1 text-xs text-[#5A5B7A]">{r.catatan}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
