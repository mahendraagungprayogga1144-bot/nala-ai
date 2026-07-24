"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Camera, Plus } from "lucide-react";
import ModuleHeader from "../components/module-header";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../components/module-form-styles";
import { trackClientEvent } from "@/lib/admin/track-event";

type Listing = {
  id: string; nama_barang: string; kondisi: string | null;
  harga_jual: number | null; harga_beli: number | null; lokasi: string | null; catatan: string | null;
};

export default function AiJualBeliClient({
  businessId, businessName, userId, listings,
}: { businessId: string; businessName: string; userId: string; listings: Listing[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ nama_barang: "", kondisi: "baru", harga_jual: "", harga_beli: "", lokasi: "", catatan: "" });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama_barang.trim() || !businessId) return;
    setLoading(true);
    const { error } = await supabase.from("module_trade_listings").insert({
      user_id: userId, business_id: businessId,
      nama_barang: form.nama_barang.trim(), kondisi: form.kondisi,
      harga_jual: form.harga_jual ? Number(form.harga_jual) : null,
      harga_beli: form.harga_beli ? Number(form.harga_beli) : null,
      lokasi: form.lokasi || null, catatan: form.catatan || null,
    });
    setLoading(false);
    if (error) return alert(error.message);
    trackClientEvent({
      event: "ai_jual_beli_listing",
      module: "ai_jual_beli",
      business_id: businessId,
      meta: { nama: form.nama_barang.trim() },
    });
    setForm({ nama_barang: "", kondisi: "baru", harga_jual: "", harga_beli: "", lokasi: "", catatan: "" });
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
      <ModuleHeader icon={Camera} title="AI Jual Beli" subtitle={`${businessName} — listing jual/beli sendiri`} status="beta" />

      <form onSubmit={save} className={MODULE_CARD + " mb-6 grid gap-3 sm:grid-cols-2"}>
        <input required className={MODULE_INPUT + " sm:col-span-2"} placeholder="Nama barang *" value={form.nama_barang} onChange={e => setForm({ ...form, nama_barang: e.target.value })} />
        <select className={MODULE_INPUT} value={form.kondisi} onChange={e => setForm({ ...form, kondisi: e.target.value })}>
          <option value="baru">Baru</option>
          <option value="bekas_bagus">Bekas bagus</option>
          <option value="bekas">Bekas</option>
        </select>
        <input className={MODULE_INPUT} placeholder="Lokasi" value={form.lokasi} onChange={e => setForm({ ...form, lokasi: e.target.value })} />
        <input type="number" className={MODULE_INPUT} placeholder="Harga jual (Rp)" value={form.harga_jual} onChange={e => setForm({ ...form, harga_jual: e.target.value })} />
        <input type="number" className={MODULE_INPUT} placeholder="Harga beli / modal (Rp)" value={form.harga_beli} onChange={e => setForm({ ...form, harga_beli: e.target.value })} />
        <input className={MODULE_INPUT + " sm:col-span-2"} placeholder="Catatan" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} />
        <button type="submit" disabled={loading} className={MODULE_BTN + " sm:col-span-2 flex items-center justify-center gap-2"}><Plus size={16} />{loading ? "Menyimpan..." : "Simpan listing"}</button>
      </form>

      {listings.map(l => (
        <div key={l.id} className={MODULE_CARD + " mb-3"}>
          <p className="font-medium">{l.nama_barang} <span className="text-xs text-[#8B8AA0]">({l.kondisi})</span></p>
          <p className="mt-1 font-mono text-sm text-[#2DD4BF]">
            Jual: {l.harga_jual ? `Rp${Number(l.harga_jual).toLocaleString("id-ID")}` : "—"}
            {l.harga_beli ? ` · Beli: Rp${Number(l.harga_beli).toLocaleString("id-ID")}` : ""}
          </p>
        </div>
      ))}
    </div>
  );
}
