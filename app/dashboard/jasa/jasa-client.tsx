"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2 } from "lucide-react";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../components/module-form-styles";
import { fmtRp } from "../components/biz-hub-shell";

type Job = {
  id: string;
  klien: string;
  judul: string;
  fee: number | null;
  status: string;
  jatuh_tempo: string | null;
  catatan: string | null;
};

const STATUS = ["aktif", "selesai", "batal"] as const;

export default function JasaClient({
  businessId,
  userId,
  jobs,
}: {
  businessId: string;
  userId: string;
  jobs: Job[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ klien: "", judul: "", fee: "", jatuh_tempo: "", catatan: "" });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.klien.trim() || !form.judul.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("module_service_jobs").insert({
      user_id: userId,
      business_id: businessId,
      klien: form.klien.trim(),
      judul: form.judul.trim(),
      fee: Number(form.fee) || 0,
      jatuh_tempo: form.jatuh_tempo || null,
      catatan: form.catatan || null,
      status: "aktif",
    });
    setLoading(false);
    if (error) return alert(error.message + "\n\nJalankan migrasi supabase/migrations/20260724_biz_type_modules.sql di Supabase SQL Editor.");
    setForm({ klien: "", judul: "", fee: "", jatuh_tempo: "", catatan: "" });
    setOpen(false);
    router.refresh();
  };

  const setStatus = async (id: string, status: string) => {
    await supabase.from("module_service_jobs").update({ status }).eq("id", id);
    router.refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus order ini?")) return;
    await supabase.from("module_service_jobs").delete().eq("id", id);
    router.refresh();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[#8B8AA0]">Daftar order / project</p>
        <button type="button" onClick={() => setOpen((v) => !v)} className={MODULE_BTN + " inline-flex items-center gap-1.5"}>
          <Plus size={14} /> Tambah order
        </button>
      </div>

      {open && (
        <form onSubmit={save} className={MODULE_CARD + " mb-4 flex flex-col gap-2"}>
          <input className={MODULE_INPUT} placeholder="Nama klien" value={form.klien} onChange={(e) => setForm({ ...form, klien: e.target.value })} required />
          <input className={MODULE_INPUT} placeholder="Judul pekerjaan" value={form.judul} onChange={(e) => setForm({ ...form, judul: e.target.value })} required />
          <div className="grid grid-cols-2 gap-2">
            <input className={MODULE_INPUT} type="number" placeholder="Fee (Rp)" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} />
            <input className={MODULE_INPUT} type="date" value={form.jatuh_tempo} onChange={(e) => setForm({ ...form, jatuh_tempo: e.target.value })} />
          </div>
          <input className={MODULE_INPUT} placeholder="Catatan (opsional)" value={form.catatan} onChange={(e) => setForm({ ...form, catatan: e.target.value })} />
          <button type="submit" disabled={loading} className={MODULE_BTN}>{loading ? "Menyimpan..." : "Simpan order"}</button>
        </form>
      )}

      {jobs.length === 0 ? (
        <div className={MODULE_CARD + " text-center text-sm text-[#8B8AA0]"}>Belum ada order. Tambah order pertama biar pipeline kelihatan.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {jobs.map((j) => (
            <div key={j.id} className={MODULE_CARD}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[#F0EFF8]">{j.judul}</p>
                  <p className="text-xs text-[#8B8AA0]">{j.klien}{j.jatuh_tempo ? ` · jatuh tempo ${j.jatuh_tempo}` : ""}</p>
                  <p className="mt-1 text-sm text-[#2DD4BF]">{fmtRp(Number(j.fee || 0))}</p>
                </div>
                <button type="button" onClick={() => remove(j.id)} className="text-[#5A5B7A] hover:text-[#EC4899]"><Trash2 size={14} /></button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {STATUS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(j.id, s)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] capitalize ${
                      j.status === s ? "bg-[#2DD4BF]/20 text-[#2DD4BF]" : "bg-white/5 text-[#8B8AA0]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
