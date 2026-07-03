"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, ExternalLink } from "lucide-react";
import type { MpStore } from "../page";
import { PLATFORMS, platformColor } from "../mp-constants";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../../components/module-form-styles";

export default function MpStoresTab({
  stores, businessId, userId,
}: { stores: MpStore[]; businessId: string; userId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ platform: "Shopee", nama_toko: "", url_toko: "", seller_id: "", catatan: "" });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama_toko.trim()) return;
    setLoading(true);
    const { error } = await supabase.from("module_marketplace_stores").insert({
      user_id: userId, business_id: businessId,
      platform: form.platform, nama_toko: form.nama_toko.trim(),
      url_toko: form.url_toko || null, seller_id: form.seller_id || null, catatan: form.catatan || null,
    });
    setLoading(false);
    if (error) return alert(error.message);
    setForm({ platform: "Shopee", nama_toko: "", url_toko: "", seller_id: "", catatan: "" });
    setOpen(false);
    router.refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus toko ini? Produk & pesanan terkait juga akan terhapus.")) return;
    await supabase.from("module_marketplace_stores").delete().eq("id", id);
    router.refresh();
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[#8B8AA0]">{stores.length} toko terdaftar</p>
        <button type="button" onClick={() => setOpen(!open)} className={"flex items-center gap-1.5 " + MODULE_BTN}>
          <Plus size={14} /> Tambah toko
        </button>
      </div>

      {open && (
        <form onSubmit={save} className={MODULE_CARD + " mb-6 grid gap-3 sm:grid-cols-2"}>
          <select className={MODULE_INPUT} value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}>
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input required className={MODULE_INPUT} placeholder="Nama toko *" value={form.nama_toko} onChange={e => setForm({ ...form, nama_toko: e.target.value })} />
          <input className={MODULE_INPUT + " sm:col-span-2"} placeholder="URL toko (opsional)" value={form.url_toko} onChange={e => setForm({ ...form, url_toko: e.target.value })} />
          <input className={MODULE_INPUT} placeholder="Seller ID / username" value={form.seller_id} onChange={e => setForm({ ...form, seller_id: e.target.value })} />
          <input className={MODULE_INPUT} placeholder="Catatan" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={loading} className={MODULE_BTN + " flex-1"}>{loading ? "Menyimpan..." : "Simpan toko"}</button>
            <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-[#8B8AA0]">Batal</button>
          </div>
        </form>
      )}

      {stores.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
          <p className="text-sm text-[#5A5B7A]">Belum ada toko. Klik Tambah toko untuk mulai.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {stores.map(s => (
            <div key={s.id} className="group relative rounded-2xl border border-white/[0.08] bg-[#0D0D1A] p-4 transition-colors hover:border-white/[0.15]">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold" style={{ background: platformColor(s.platform) + "22", color: platformColor(s.platform) }}>
                  {s.platform[0]}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.nama_toko}</p>
                  <p className="text-[10px] font-semibold uppercase" style={{ color: platformColor(s.platform) }}>{s.platform}</p>
                </div>
                <button type="button" onClick={() => remove(s.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-[#5A5B7A] hover:text-[#F43F5E]">
                  <Trash2 size={14} />
                </button>
              </div>
              {s.seller_id && <p className="text-xs text-[#5A5B7A]">ID: {s.seller_id}</p>}
              {s.url_toko && (
                <a href={s.url_toko} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-xs text-[#2DD4BF] break-all hover:underline">
                  <ExternalLink size={10} /> {s.url_toko}
                </a>
              )}
              {s.catatan && <p className="mt-1 text-[10px] text-[#5A5B7A]">{s.catatan}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
