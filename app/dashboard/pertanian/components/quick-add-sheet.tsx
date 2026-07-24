"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { X } from "lucide-react";
import { inputCls, normalizeHarvestCategory } from "../lib/constants";
import { insertKeuanganPengeluaran } from "../lib/agri-sync";
import { todayWib } from "@/lib/date";

export type QuickAddType = "panen" | "saprotan" | "lahan" | "biaya" | "semprot";

const PANEN_CHIPS = ["Padi", "Cabai", "Tomat", "Jagung", "Kedelai", "Kentang"];
const SAPROTAN_CHIPS = ["Pupuk", "Pestisida", "Benih", "Herbisida"];
const BIAYA_CHIPS = ["Pupuk", "Benih", "Tenaga Kerja", "Transportasi", "Pestisida"];

type Props = {
  type: QuickAddType | null;
  onClose: () => void;
  userId: string;
  businessId: string;
};

export default function QuickAddSheet({ type, onClose, userId, businessId }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const [nama, setNama] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [satuan, setSatuan] = useState("kg");
  const [harga, setHarga] = useState("");
  const [kategori, setKategori] = useState("");
  const [luas, setLuas] = useState("");
  const [tanaman, setTanaman] = useState("");
  const [produk, setProduk] = useState("");

  if (!type) return null;

  const titles: Record<QuickAddType, string> = {
    panen: "Catat Hasil Panen",
    saprotan: "Catat Saprotan",
    lahan: "Tambah Lahan",
    biaya: "Catat Biaya",
    semprot: "Catat Penyemprotan",
  };

  const resetAndClose = () => {
    setNama(""); setJumlah(""); setHarga(""); setKategori(""); setLuas(""); setTanaman(""); setProduk("");
    onClose();
  };

  const handleSave = async () => {
    setLoading(true);
    const today = todayWib();

    try {
      if (type === "panen") {
        if (!nama || !jumlah) return;
        const cat = normalizeHarvestCategory(kategori || "Sayuran");
        const { data: prod, error } = await supabase.from("products").insert({
          user_id: userId, business_id: businessId, name: nama, category: cat,
          stock: Number(jumlah), min_stock: 5, price: harga ? Number(harga) : null,
        }).select("id").single();
        if (error) { alert(error.message); return; }
        if (prod?.id) {
          await supabase.from("agri_harvest_meta").insert({
            product_id: prod.id, user_id: userId, business_id: businessId,
            satuan, tanggal_panen: today,
          });
        }
      } else if (type === "saprotan") {
        if (!nama || !jumlah) return;
        const cat = kategori || "Pupuk";
        const { data: prod, error } = await supabase.from("products").insert({
          user_id: userId, business_id: businessId, name: nama, category: cat,
          stock: Number(jumlah), min_stock: 5, cost: harga ? Number(harga) : null,
        }).select("id").single();
        if (error) { alert(error.message); return; }
        if (prod?.id) {
          await supabase.from("agri_saprotan_meta").insert({
            product_id: prod.id, user_id: userId, business_id: businessId,
            satuan, tanggal_pembelian: today,
          });
        }
      } else if (type === "lahan") {
        if (!nama || !luas) return;
        await supabase.from("agri_fields").insert({
          user_id: userId, business_id: businessId, nama_lahan: nama,
          luas_lahan: Number(luas), jenis_tanaman: tanaman || null,
          tanggal_tanam: today, status: "pertumbuhan",
        });
      } else if (type === "biaya") {
        if (!jumlah) return;
        const amount = Number(jumlah);
        const cat = kategori || "Lainnya";
        await supabase.from("agri_production_costs").insert({
          user_id: userId, business_id: businessId, tanggal: today,
          kategori: cat, deskripsi: nama || null, jumlah: amount,
        });
        await insertKeuanganPengeluaran(supabase, {
          userId, businessId, category: cat,
          description: `Biaya ${cat}${nama ? ": " + nama : ""} — Pertanian`,
          amount, tanggal: today,
        });
      } else if (type === "semprot") {
        if (!produk) return;
        const biaya = harga ? Number(harga) : 0;
        await supabase.from("agri_spraying_records").insert({
          user_id: userId, business_id: businessId, tanggal: today,
          nama_produk: produk, jenis_produk: kategori || "Pestisida",
          biaya,
        });
        if (biaya > 0) {
          await insertKeuanganPengeluaran(supabase, {
            userId, businessId,
            category: "Pestisida",
            description: `Semprot ${produk} — Pertanian`,
            amount: biaya,
            tanggal: today,
          });
        }
      }
      resetAndClose();
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const canSave = () => {
    if (type === "panen" || type === "saprotan") return nama && jumlah;
    if (type === "lahan") return nama && luas;
    if (type === "biaya") return jumlah;
    if (type === "semprot") return produk;
    return false;
  };

  const chips = type === "panen" ? PANEN_CHIPS : type === "saprotan" ? SAPROTAN_CHIPS : type === "biaya" ? BIAYA_CHIPS : [];

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 backdrop-blur-[2px]" onClick={resetAndClose}>
      <div
        className="w-full max-w-lg bg-[#12121f] border-t border-white/10 rounded-t-3xl p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-4" />
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{titles[type]}</h3>
          <button type="button" onClick={resetAndClose} className="p-2 rounded-xl bg-white/[0.06] text-[#8B8AA0]"><X size={18} /></button>
        </div>

        <div className="space-y-3">
          {(type === "panen" || type === "saprotan") && (
            <>
              <div className="flex flex-wrap gap-2">
                {chips.map(c => (
                  <button key={c} type="button" onClick={() => { setKategori(c); if (!nama) setNama(c); }}
                    className={`px-3 py-2.5 rounded-xl text-sm ${kategori === c ? "bg-violet-600 text-white" : "bg-white/[0.06] text-[#8B8AA0]"}`}>
                    {c}
                  </button>
                ))}
              </div>
              <input className={`${inputCls} text-base py-3.5`} placeholder={type === "panen" ? "Nama komoditas *" : "Nama produk *"} value={nama} onChange={e => setNama(e.target.value)} />
              <div className="grid grid-cols-[1fr_88px] gap-2">
                <input className={`${inputCls} text-base py-3.5`} type="number" inputMode="decimal" placeholder={type === "panen" ? "Jumlah *" : "Stok *"} value={jumlah} onChange={e => setJumlah(e.target.value)} />
                <select className={`${inputCls} text-base py-3.5`} value={satuan} onChange={e => setSatuan(e.target.value)}>
                  <option value="kg">kg</option>
                  <option value="ton">ton</option>
                  <option value="karung">karung</option>
                  <option value="sak">sak</option>
                </select>
              </div>
              <input className={`${inputCls} text-base py-3.5`} type="number" inputMode="numeric" placeholder={type === "panen" ? "Harga jual (opsional)" : "Harga beli (opsional)"} value={harga} onChange={e => setHarga(e.target.value)} />
            </>
          )}

          {type === "lahan" && (
            <>
              <input className={`${inputCls} text-base py-3.5`} placeholder="Nama lahan *" value={nama} onChange={e => setNama(e.target.value)} />
              <input className={`${inputCls} text-base py-3.5`} type="number" inputMode="decimal" placeholder="Luas hektar *" value={luas} onChange={e => setLuas(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                {PANEN_CHIPS.slice(0, 5).map(t => (
                  <button key={t} type="button" onClick={() => setTanaman(t)}
                    className={`px-3 py-2.5 rounded-xl text-sm ${tanaman === t ? "bg-emerald-600 text-white" : "bg-white/[0.06] text-[#8B8AA0]"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}

          {type === "biaya" && (
            <>
              <div className="flex flex-wrap gap-2">
                {BIAYA_CHIPS.map(c => (
                  <button key={c} type="button" onClick={() => setKategori(c)}
                    className={`px-3 py-2.5 rounded-xl text-sm ${kategori === c ? "bg-violet-600 text-white" : "bg-white/[0.06] text-[#8B8AA0]"}`}>
                    {c}
                  </button>
                ))}
              </div>
              <input className={`${inputCls} text-base py-3.5`} type="number" inputMode="numeric" placeholder="Nominal Rp *" value={jumlah} onChange={e => setJumlah(e.target.value)} />
              <input className={`${inputCls} text-base py-3.5`} placeholder="Keterangan (opsional)" value={nama} onChange={e => setNama(e.target.value)} />
            </>
          )}

          {type === "semprot" && (
            <>
              <input className={`${inputCls} text-base py-3.5`} placeholder="Nama pestisida/pupuk *" value={produk} onChange={e => setProduk(e.target.value)} />
              <input className={`${inputCls} text-base py-3.5`} type="number" inputMode="numeric" placeholder="Biaya (opsional)" value={harga} onChange={e => setHarga(e.target.value)} />
            </>
          )}
        </div>

        <button type="button" disabled={loading || !canSave()} onClick={handleSave}
          className="w-full mt-5 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-base font-bold text-white disabled:opacity-40 active:scale-[0.98] transition-transform">
          {loading ? "Menyimpan..." : "Simpan"}
        </button>

        <p className="text-center text-[10px] text-[#5A5B7A] mt-3">Atau pakai ✨ Tanya Gercep untuk catat lewat chat</p>
      </div>
    </div>
  );
}
