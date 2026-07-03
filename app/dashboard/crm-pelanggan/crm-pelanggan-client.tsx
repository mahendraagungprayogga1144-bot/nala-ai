"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Users, Plus, MessageCircle, Trash2 } from "lucide-react";
import ModuleHeader from "../components/module-header";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../components/module-form-styles";

type Customer = {
  id: string; nama: string; telepon: string | null; email: string | null; alamat: string | null; catatan: string | null;
};

export default function CrmPelangganClient({
  businessId, businessName, userId, customers,
}: { businessId: string; businessName: string; userId: string; customers: Customer[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ nama: "", telepon: "", email: "", alamat: "", catatan: "" });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama.trim() || !businessId) return;
    setLoading(true);
    const { error } = await supabase.from("module_crm_customers").insert({
      user_id: userId, business_id: businessId,
      nama: form.nama.trim(), telepon: form.telepon || null, email: form.email || null,
      alamat: form.alamat || null, catatan: form.catatan || null,
    });
    setLoading(false);
    if (error) return alert(error.message);
    setForm({ nama: "", telepon: "", email: "", alamat: "", catatan: "" });
    setOpen(false);
    router.refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus pelanggan ini?")) return;
    await supabase.from("module_crm_customers").delete().eq("id", id);
    router.refresh();
  };

  const wa = (c: Customer) => {
    const phone = (c.telepon || "").replace(/\D/g, "");
    const text = `Halo ${c.nama}, ada yang bisa kami bantu dari ${businessName}?`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
      <ModuleHeader icon={Users} title="CRM Pelanggan" subtitle={`${businessName} — database pelanggan perusahaan`} status="beta" />

      <button type="button" onClick={() => setOpen(!open)} className={"mb-6 flex items-center gap-2 " + MODULE_BTN}>
        <Plus size={16} /> Tambah pelanggan
      </button>

      {open && (
        <form onSubmit={save} className={MODULE_CARD + " mb-6 grid gap-3 sm:grid-cols-2"}>
          <input required className={MODULE_INPUT} placeholder="Nama pelanggan *" value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} />
          <input className={MODULE_INPUT} placeholder="Telepon / WA" value={form.telepon} onChange={e => setForm({ ...form, telepon: e.target.value })} />
          <input className={MODULE_INPUT} placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <input className={MODULE_INPUT} placeholder="Alamat" value={form.alamat} onChange={e => setForm({ ...form, alamat: e.target.value })} />
          <input className={MODULE_INPUT + " sm:col-span-2"} placeholder="Catatan" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} />
          <button type="submit" disabled={loading} className={MODULE_BTN + " sm:col-span-2"}>{loading ? "Menyimpan..." : "Simpan pelanggan"}</button>
        </form>
      )}

      {customers.length === 0 ? (
        <p className="text-center text-sm text-[#8B8AA0]">Belum ada pelanggan. Input manual di atas.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {customers.map(c => (
            <div key={c.id} className={"flex items-center gap-3 " + MODULE_CARD}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2DD4BF]/15 text-xs font-bold text-[#2DD4BF]">{c.nama.slice(0, 2).toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{c.nama}</p>
                <p className="text-[10px] text-[#8B8AA0]">{[c.telepon, c.email, c.alamat].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              {c.telepon && (
                <button type="button" onClick={() => wa(c)} className="rounded-lg border border-[#4ADE80]/30 p-2 text-[#4ADE80]"><MessageCircle size={14} /></button>
              )}
              <button type="button" onClick={() => remove(c.id)} className="text-[#5A5B7A] hover:text-[#EC4899]"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
