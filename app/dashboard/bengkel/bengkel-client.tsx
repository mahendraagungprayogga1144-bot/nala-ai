"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2 } from "lucide-react";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../components/module-form-styles";
import { fmtRp } from "../components/biz-hub-shell";

type Order = {
  id: string;
  pelanggan: string;
  kendaraan: string;
  keluhan: string | null;
  biaya_jasa: number | null;
  spare_part: string | null;
  status: string;
};

const STATUS = ["antrian", "proses", "selesai", "batal"] as const;

export default function BengkelClient({
  businessId,
  userId,
  orders,
}: {
  businessId: string;
  userId: string;
  orders: Order[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    pelanggan: "",
    kendaraan: "",
    keluhan: "",
    biaya_jasa: "",
    spare_part: "",
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.pelanggan.trim() || !form.kendaraan.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("module_workshop_orders").insert({
      user_id: userId,
      business_id: businessId,
      pelanggan: form.pelanggan.trim(),
      kendaraan: form.kendaraan.trim(),
      keluhan: form.keluhan || null,
      biaya_jasa: Number(form.biaya_jasa) || 0,
      spare_part: form.spare_part || null,
      status: "antrian",
    });
    setLoading(false);
    if (error) return alert(error.message + "\n\nJalankan migrasi 20260724_biz_type_modules.sql di Supabase.");
    setForm({ pelanggan: "", kendaraan: "", keluhan: "", biaya_jasa: "", spare_part: "" });
    setOpen(false);
    router.refresh();
  };

  const setStatus = async (id: string, status: string) => {
    await supabase.from("module_workshop_orders").update({ status }).eq("id", id);
    router.refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus order bengkel ini?")) return;
    await supabase.from("module_workshop_orders").delete().eq("id", id);
    router.refresh();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[#8B8AA0]">Antrian & riwayat servis</p>
        <button type="button" onClick={() => setOpen((v) => !v)} className={MODULE_BTN + " inline-flex items-center gap-1.5"}>
          <Plus size={14} /> Order baru
        </button>
      </div>

      {open && (
        <form onSubmit={save} className={MODULE_CARD + " mb-4 flex flex-col gap-2"}>
          <input className={MODULE_INPUT} placeholder="Nama pelanggan" value={form.pelanggan} onChange={(e) => setForm({ ...form, pelanggan: e.target.value })} required />
          <input className={MODULE_INPUT} placeholder="Kendaraan (mis. Honda Beat B 1234 XX)" value={form.kendaraan} onChange={(e) => setForm({ ...form, kendaraan: e.target.value })} required />
          <input className={MODULE_INPUT} placeholder="Keluhan" value={form.keluhan} onChange={(e) => setForm({ ...form, keluhan: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className={MODULE_INPUT} type="number" placeholder="Biaya jasa (Rp)" value={form.biaya_jasa} onChange={(e) => setForm({ ...form, biaya_jasa: e.target.value })} />
            <input className={MODULE_INPUT} placeholder="Spare part (opsional)" value={form.spare_part} onChange={(e) => setForm({ ...form, spare_part: e.target.value })} />
          </div>
          <button type="submit" disabled={loading} className={MODULE_BTN}>{loading ? "Menyimpan..." : "Masuk antrian"}</button>
        </form>
      )}

      {orders.length === 0 ? (
        <div className={MODULE_CARD + " text-center text-sm text-[#8B8AA0]"}>Belum ada order. Tambah kendaraan yang masuk bengkel.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((o) => (
            <div key={o.id} className={MODULE_CARD}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-[#F0EFF8]">{o.kendaraan}</p>
                  <p className="text-xs text-[#8B8AA0]">{o.pelanggan}{o.keluhan ? ` · ${o.keluhan}` : ""}</p>
                  {o.spare_part && <p className="mt-0.5 text-xs text-[#8B8AA0]">Part: {o.spare_part}</p>}
                  <p className="mt-1 text-sm text-[#2DD4BF]">{fmtRp(Number(o.biaya_jasa || 0))}</p>
                </div>
                <button type="button" onClick={() => remove(o.id)} className="text-[#5A5B7A] hover:text-[#EC4899]"><Trash2 size={14} /></button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {STATUS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(o.id, s)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] capitalize ${
                      o.status === s ? "bg-[#2DD4BF]/20 text-[#2DD4BF]" : "bg-white/5 text-[#8B8AA0]"
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
