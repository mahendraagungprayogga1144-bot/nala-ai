"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { QrCode, Plus, Search } from "lucide-react";
import ModuleHeader from "../components/module-header";
import { MODULE_BTN, MODULE_CARD, MODULE_INPUT } from "../components/module-form-styles";

type Item = { id: string; kode: string; nama_barang: string; merek: string | null; supplier: string | null; harga: number | null; catatan: string | null };

export default function BarcodeQrClient({
  businessId, businessName, userId, items,
}: { businessId: string; businessName: string; userId: string; items: Item[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ kode: "", nama_barang: "", merek: "", supplier: "", harga: "", catatan: "" });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return items;
    return items.filter(i => i.kode.toLowerCase().includes(q) || i.nama_barang.toLowerCase().includes(q));
  }, [items, search]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.kode.trim() || !form.nama_barang.trim() || !businessId) return;
    setLoading(true);
    const { error } = await supabase.from("module_barcodes").insert({
      user_id: userId, business_id: businessId,
      kode: form.kode.trim(), nama_barang: form.nama_barang.trim(),
      merek: form.merek || null, supplier: form.supplier || null,
      harga: form.harga ? Number(form.harga) : null, catatan: form.catatan || null,
    });
    setLoading(false);
    if (error) return alert(error.message);
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
      <ModuleHeader icon={QrCode} title="Barcode QR Analyzer" subtitle={`${businessName} — daftar barcode sendiri`} status="beta" />

      <button type="button" onClick={() => setOpen(!open)} className={"mb-4 flex items-center gap-2 " + MODULE_BTN}><Plus size={16} /> Daftarkan barcode</button>

      {open && (
        <form onSubmit={save} className={MODULE_CARD + " mb-6 grid gap-3 sm:grid-cols-2"}>
          <input required className={MODULE_INPUT} placeholder="Kode / SKU / barcode *" value={form.kode} onChange={e => setForm({ ...form, kode: e.target.value })} />
          <input required className={MODULE_INPUT} placeholder="Nama barang *" value={form.nama_barang} onChange={e => setForm({ ...form, nama_barang: e.target.value })} />
          <input className={MODULE_INPUT} placeholder="Merek" value={form.merek} onChange={e => setForm({ ...form, merek: e.target.value })} />
          <input className={MODULE_INPUT} placeholder="Supplier" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} />
          <input className={MODULE_INPUT} type="number" placeholder="Harga (Rp)" value={form.harga} onChange={e => setForm({ ...form, harga: e.target.value })} />
          <input className={MODULE_INPUT} placeholder="Catatan" value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} />
          <button type="submit" disabled={loading} className={MODULE_BTN + " sm:col-span-2"}>{loading ? "Menyimpan..." : "Simpan"}</button>
        </form>
      )}

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5B7A]" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari kode atau nama..." className={MODULE_INPUT + " pl-10"} />
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-[#8B8AA0]">Belum ada barcode terdaftar.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(i => (
            <div key={i.id} className={MODULE_CARD}>
              <p className="font-mono text-sm text-[#2DD4BF]">{i.kode}</p>
              <p className="font-medium">{i.nama_barang}</p>
              <p className="text-xs text-[#8B8AA0]">{[i.merek, i.supplier, i.harga ? `Rp${Number(i.harga).toLocaleString("id-ID")}` : null].filter(Boolean).join(" · ")}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
