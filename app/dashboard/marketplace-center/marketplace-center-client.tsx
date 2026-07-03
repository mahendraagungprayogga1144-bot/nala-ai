"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ShoppingCart, Plus } from "lucide-react";
import ModuleHeader from "../components/module-header";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../components/module-form-styles";

type Store = { id: string; platform: string; nama_toko: string; url_toko: string | null; seller_id: string | null; catatan: string | null };

const PLATFORMS = ["Shopee", "Tokopedia", "TikTok Shop", "Lazada", "Bukalapak"];

export default function MarketplaceCenterClient({
  businessId, businessName, userId, stores,
}: { businessId: string; businessName: string; userId: string; stores: Store[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ platform: "Shopee", nama_toko: "", url_toko: "", seller_id: "", catatan: "" });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama_toko.trim() || !businessId) return;
    setLoading(true);
    const { error } = await supabase.from("module_marketplace_stores").insert({
      user_id: userId, business_id: businessId,
      platform: form.platform, nama_toko: form.nama_toko.trim(),
      url_toko: form.url_toko || null, seller_id: form.seller_id || null, catatan: form.catatan || null,
    });
    setLoading(false);
    if (error) return alert(error.message);
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
      <ModuleHeader icon={ShoppingCart} title="Marketplace Center" subtitle={`${businessName} — daftar toko online sendiri`} status="beta" />

      <button type="button" onClick={() => setOpen(!open)} className={"mb-6 flex items-center gap-2 " + MODULE_BTN}><Plus size={16} /> Tambah toko marketplace</button>

      {open && (
        <form onSubmit={save} className={MODULE_CARD + " mb-6 grid gap-3 sm:grid-cols-2"}>
          <select className={MODULE_INPUT} value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value })}>
            {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input required className={MODULE_INPUT} placeholder="Nama toko *" value={form.nama_toko} onChange={e => setForm({ ...form, nama_toko: e.target.value })} />
          <input className={MODULE_INPUT + " sm:col-span-2"} placeholder="URL toko" value={form.url_toko} onChange={e => setForm({ ...form, url_toko: e.target.value })} />
          <input className={MODULE_INPUT} placeholder="Seller ID / username" value={form.seller_id} onChange={e => setForm({ ...form, seller_id: e.target.value })} />
          <input className={MODULE_INPUT} placeholder="Catatan" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} />
          <button type="submit" disabled={loading} className={MODULE_BTN + " sm:col-span-2"}>{loading ? "Menyimpan..." : "Simpan toko"}</button>
        </form>
      )}

      {stores.length === 0 ? (
        <p className="text-center text-sm text-[#8B8AA0]">Belum ada toko terdaftar. Input manual di atas.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {stores.map(s => (
            <div key={s.id} className={MODULE_CARD}>
              <p className="text-[10px] font-semibold uppercase text-[#A78BFA]">{s.platform}</p>
              <p className="font-medium">{s.nama_toko}</p>
              {s.url_toko && <a href={s.url_toko} target="_blank" rel="noreferrer" className="text-xs text-[#2DD4BF] break-all">{s.url_toko}</a>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
