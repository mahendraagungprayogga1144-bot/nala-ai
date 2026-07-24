
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Edit2, X } from "lucide-react";
import { todayWib } from "@/lib/date";
import { syncFarmToKeuangan, deleteFarmKeuangan, type FarmJenis } from "../../lib/farm-sync";
import { syncFarmInventoryDelta } from "../../lib/farm-inventory";
import PeternakanHubNav from "../../peternakan-hub-nav";

type Batch = { id: string; nama_batch: string; jenis_ternak: string; tanggal_mulai: string; tanggal_selesai: string | null; status: string };
type Transaction = { id: string; batch_id: string; tanggal: string; jenis_transaksi: string; nama_item: string | null; qty: number | null; satuan: string | null; harga: number | null; total: number; catatan: string | null; keuangan_tx_ids?: string[] | null };

const JENIS_LABELS: Record<string, string> = {
  bibit: "Bibit", pakan: "Pakan", obat: "Obat", vitamin: "Vitamin",
  operasional: "Operasional", mortalitas: "Mortalitas", panen: "Panen"
};

const JENIS_COLORS: Record<string, string> = {
  bibit: "#38BDF8", pakan: "#F59E0B", obat: "#8B5CF6", vitamin: "#06B6D4",
  operasional: "#6366F1", mortalitas: "#EC4899", panen: "#2DD4BF"
};

const OPERASIONAL_ITEMS = ["Solar", "Listrik", "Transport", "Tenaga Kerja", "Perawatan", "Lainnya"];

const BTN_GRAD = { background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" } as const;

export default function BatchDetail({ batch, transactions, userId, businessId }: { batch: Batch; transactions: Transaction[]; userId: string; businessId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [activeForm, setActiveForm] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form state
  const [tanggal, setTanggal] = useState(todayWib());
  const [namaItem, setNamaItem] = useState("");
  const [qty, setQty] = useState("");
  const [satuan, setSatuan] = useState("");
  const [harga, setHarga] = useState("");
  const [catatan, setCatatan] = useState("");

  // Ringkasan
  const getTotal = (jenis: string | string[]) => {
    const jenisArr = Array.isArray(jenis) ? jenis : [jenis];
    return transactions.filter(t => jenisArr.includes(t.jenis_transaksi)).reduce((s, t) => s + Number(t.total), 0);
  };
  const getQty = (jenis: string) => transactions.filter(t => t.jenis_transaksi === jenis).reduce((s, t) => s + Number(t.qty || 0), 0);

  const bibit = getTotal("bibit");
  const pakan = getTotal("pakan");
  const obat = getTotal(["obat", "vitamin"]);
  const operasional = getTotal("operasional");
  const panen = getTotal("panen");
  const totalModal = bibit + pakan + obat + operasional;
  const labaBersih = panen - totalModal;
  const totalBibit = getQty("bibit");
  const totalMati = getQty("mortalitas");
  const totalTerjual = getQty("panen");
  const populasiHidup = totalBibit - totalMati - totalTerjual;

  const resetForm = () => {
    setTanggal(todayWib());
    setNamaItem(""); setQty(""); setSatuan(""); setHarga(""); setCatatan("");
    setEditingId(null);
  };

  const calcTotal = (jenisForm: string) => {
    if (jenisForm === "bibit") return (Number(qty) || 0) * (Number(harga) || 0);
    if (jenisForm === "pakan" || jenisForm === "obat" || jenisForm === "vitamin") return (Number(qty) || 0) * (Number(harga) || 0);
    if (jenisForm === "operasional") return Number(harga) || 0;
    if (jenisForm === "mortalitas") return 0;
    if (jenisForm === "panen") return (Number(qty) || 0) * (Number(harga) || 0);
    return 0;
  };

  const handleSave = async (jenis: string) => {
    const total = calcTotal(jenis);
    if (!tanggal) return;
    if (jenis !== "mortalitas" && total <= 0 && jenis !== "panen") return;
    const qtyNum = Number(qty) || 0;
    const hargaNum = Number(harga) || 0;

    if ((jenis === "mortalitas" || jenis === "panen") && qtyNum > populasiHidup && !editingId) {
      alert(`Qty melebihi populasi hidup (${populasiHidup} ekor).`);
      return;
    }

    setLoading(true);

    const otherTx = transactions.filter(t => t.id !== editingId);
    const oBibit = otherTx.filter(t => t.jenis_transaksi === "bibit").reduce((s, t) => s + Number(t.total), 0);
    const oPakan = otherTx.filter(t => t.jenis_transaksi === "pakan").reduce((s, t) => s + Number(t.total), 0);
    const oObat = otherTx.filter(t => ["obat", "vitamin"].includes(t.jenis_transaksi)).reduce((s, t) => s + Number(t.total), 0);
    const oOps = otherTx.filter(t => t.jenis_transaksi === "operasional").reduce((s, t) => s + Number(t.total), 0);
    const modalForHpp = oBibit + oPakan + oObat + oOps + (jenis !== "panen" ? total : 0);
    const bibitEkor = otherTx.filter(t => t.jenis_transaksi === "bibit").reduce((s, t) => s + Number(t.qty || 0), 0)
      + (jenis === "bibit" ? qtyNum : 0);

    // Berat panen disimpan di catatan, bukan kolom satuan
    const beratNote = jenis === "panen" && satuan ? `Berat ${satuan} kg` : null;
    const catatanFinal = [beratNote, catatan || null].filter(Boolean).join(" · ") || null;

    const payload = {
      batch_id: batch.id, user_id: userId, tanggal, jenis_transaksi: jenis,
      nama_item: namaItem || null, qty: qty ? Number(qty) : null,
      satuan: jenis === "panen" ? "ekor" : (satuan || null),
      harga: harga ? Number(harga) : null,
      total: total, catatan: jenis === "panen" ? catatanFinal : (catatan || null),
    };

    let farmTxId = editingId;
    let existingTxIds: string[] | null = null;
    const prevTx = editingId ? transactions.find(t => t.id === editingId) : null;

    if (editingId && prevTx) {
      // Reverse old inventory effect before applying new
      await syncFarmInventoryDelta(supabase, {
        userId, businessId,
        delta: {
          jenis: prevTx.jenis_transaksi,
          qty: Number(prevTx.qty || 0),
          namaItem: prevTx.nama_item,
          harga: prevTx.harga != null ? Number(prevTx.harga) : null,
          jenisTernak: batch.jenis_ternak,
        },
        sign: -1,
      });
      existingTxIds = prevTx.keuangan_tx_ids || null;
      await supabase.from("farm_transactions").update(payload).eq("id", editingId);
    } else {
      const { data, error } = await supabase.from("farm_transactions").insert(payload).select("id").single();
      if (error) { setLoading(false); alert("Gagal simpan: " + error.message); return; }
      farmTxId = data!.id;
    }

    if (farmTxId && businessId) {
      const syncResult = await syncFarmToKeuangan(supabase, {
        userId, businessId, farmTxId,
        existingTxIds,
        jenis: jenis as FarmJenis,
        total, qty: qty ? Number(qty) : null,
        namaItem: namaItem || null,
        batchName: batch.nama_batch,
        jenisTernak: batch.jenis_ternak,
        tanggal,
        totalModal: modalForHpp,
        totalBibit: bibitEkor,
      });
      if (!syncResult.ok) {
        setLoading(false);
        alert(
          "Catatan batch tersimpan, tapi gagal masuk Keuangan Bisnis:\n" +
            (syncResult.error || "Unknown") +
            "\n\nCek bisnis aktif = Peternakan, atau constraint type transaksi di Supabase.",
        );
        router.refresh();
        return;
      }
    } else if (farmTxId && !businessId) {
      setLoading(false);
      alert("Batch tersimpan, tapi bisnis ternak tidak terdeteksi — Keuangan Bisnis tidak ter-update. Ganti bisnis aktif ke Peternakan.");
      router.refresh();
      return;
    }

    await syncFarmInventoryDelta(supabase, {
      userId, businessId,
      delta: {
        jenis,
        qty: qtyNum,
        namaItem: namaItem || null,
        harga: hargaNum || null,
        jenisTernak: batch.jenis_ternak,
      },
      sign: 1,
    });

    setLoading(false);
    resetForm();
    setActiveForm(null);
    router.refresh();
  };

  const handleDelete = async (t: Transaction) => {
    if (!confirm("Hapus transaksi ini?")) return;
    await deleteFarmKeuangan(supabase, t.keuangan_tx_ids);
    await syncFarmInventoryDelta(supabase, {
      userId, businessId,
      delta: {
        jenis: t.jenis_transaksi,
        qty: Number(t.qty || 0),
        namaItem: t.nama_item,
        harga: t.harga != null ? Number(t.harga) : null,
        jenisTernak: batch.jenis_ternak,
      },
      sign: -1,
    });
    await supabase.from("farm_transactions").delete().eq("id", t.id);
    router.refresh();
  };

  const handleEdit = (t: Transaction, jenis: string) => {
    setEditingId(t.id);
    setTanggal(t.tanggal);
    setNamaItem(t.nama_item || "");
    setQty(t.qty?.toString() || "");
    setSatuan(t.satuan || "");
    setHarga(t.harga?.toString() || "");
    setCatatan(t.catatan || "");
    setActiveForm(jenis);
  };

  const handleSelesaikan = async () => {
    if (!confirm("Selesaikan batch ini? Status akan berubah jadi Selesai.")) return;
    await supabase.from("farm_batches").update({ status: "selesai", tanggal_selesai: todayWib() }).eq("id", batch.id);
    router.refresh();
  };

  const inputCls = "w-full px-3 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50 text-sm";

  const renderFormBibit = () => (
    <div className="bg-[#0A0A12] border border-[#38BDF8]/20 rounded-xl p-4 mb-4">
      <p className="text-xs font-medium text-[#38BDF8] mb-3">{editingId ? "Edit" : "Tambah"} Bibit</p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div><label className="text-[10px] text-[#8B8AA0] mb-1 block">Tanggal</label><input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className={inputCls} style={{ colorScheme: "dark" }} /></div>
        <div><label className="text-[10px] text-[#8B8AA0] mb-1 block">Jumlah (ekor)</label><input type="number" placeholder="100" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div><label className="text-[10px] text-[#8B8AA0] mb-1 block">Harga per ekor (Rp)</label><input type="number" placeholder="35000" value={harga} onChange={e => setHarga(e.target.value)} className={inputCls} /></div>
        <div className="flex items-end"><div className="w-full bg-[#0F0F1A] border border-white/10 rounded-lg px-3 py-2.5"><p className="text-[10px] text-[#8B8AA0]">Total</p><p className="text-sm font-mono text-[#38BDF8]">Rp{calcTotal("bibit").toLocaleString("id-ID")}</p></div></div>
      </div>
      <input placeholder="Catatan (opsional)" value={catatan} onChange={e => setCatatan(e.target.value)} className={inputCls + " mb-3"} />
      <div className="flex gap-2">
        <button onClick={() => handleSave("bibit")} disabled={loading} className="flex-1 py-2 rounded-lg font-semibold text-sm disabled:opacity-50" style={BTN_GRAD}>{loading ? "Menyimpan..." : "Simpan"}</button>
        <button onClick={() => { resetForm(); setActiveForm(null); }} className="px-4 py-2 rounded-lg border border-white/10 text-sm text-[#8B8AA0]">Batal</button>
      </div>
    </div>
  );

  const renderFormPakanObat = (jenis: string) => {
    const color = JENIS_COLORS[jenis];
    const satuanDefault = jenis === "pakan" ? "kg" : "pcs";
    return (
      <div className="bg-[#0A0A12] rounded-xl p-4 mb-4" style={{ border: `1px solid ${color}30` }}>
        <p className="text-xs font-medium mb-3" style={{ color }}>{editingId ? "Edit" : "Tambah"} {JENIS_LABELS[jenis]}</p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div><label className="text-[10px] text-[#8B8AA0] mb-1 block">Tanggal</label><input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className={inputCls} style={{ colorScheme: "dark" }} /></div>
          <div><label className="text-[10px] text-[#8B8AA0] mb-1 block">Nama Item</label><input placeholder={jenis === "pakan" ? "Katul, BR1, Konsentrat..." : "Nama obat/vitamin..."} value={namaItem} onChange={e => setNamaItem(e.target.value)} className={inputCls} /></div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div><label className="text-[10px] text-[#8B8AA0] mb-1 block">Jumlah</label><input type="number" placeholder="10" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} /></div>
          <div><label className="text-[10px] text-[#8B8AA0] mb-1 block">Satuan</label><input placeholder={satuanDefault} value={satuan} onChange={e => setSatuan(e.target.value)} className={inputCls} /></div>
          <div><label className="text-[10px] text-[#8B8AA0] mb-1 block">Harga/satuan</label><input type="number" placeholder="8500" value={harga} onChange={e => setHarga(e.target.value)} className={inputCls} /></div>
        </div>
        <div className="bg-[#0F0F1A] rounded-lg px-3 py-2 mb-3 flex justify-between items-center">
          <span className="text-[10px] text-[#8B8AA0]">Total</span>
          <span className="text-sm font-mono" style={{ color }}>Rp{calcTotal(jenis).toLocaleString("id-ID")}</span>
        </div>
        <input placeholder="Catatan (opsional)" value={catatan} onChange={e => setCatatan(e.target.value)} className={inputCls + " mb-3"} />
        <div className="flex gap-2">
          <button onClick={() => handleSave(jenis)} disabled={loading} className="flex-1 py-2 rounded-lg font-semibold text-sm disabled:opacity-50" style={BTN_GRAD}>{loading ? "Menyimpan..." : "Simpan"}</button>
          <button onClick={() => { resetForm(); setActiveForm(null); }} className="px-4 py-2 rounded-lg border border-white/10 text-sm text-[#8B8AA0]">Batal</button>
        </div>
      </div>
    );
  };

  const renderFormOperasional = () => (
    <div className="bg-[#0A0A12] border border-[#6366F1]/20 rounded-xl p-4 mb-4">
      <p className="text-xs font-medium text-[#6366F1] mb-3">{editingId ? "Edit" : "Tambah"} Biaya Operasional</p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div><label className="text-[10px] text-[#8B8AA0] mb-1 block">Tanggal</label><input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className={inputCls} style={{ colorScheme: "dark" }} /></div>
        <div>
          <label className="text-[10px] text-[#8B8AA0] mb-1 block">Jenis Biaya</label>
          <select value={namaItem} onChange={e => setNamaItem(e.target.value)} className={inputCls}>
            <option value="">Pilih...</option>
            {OPERASIONAL_ITEMS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div><label className="text-[10px] text-[#8B8AA0] mb-1 block">Total Biaya (Rp)</label><input type="number" placeholder="500000" value={harga} onChange={e => setHarga(e.target.value)} className={inputCls} /></div>
        <div className="flex items-end"><div className="w-full bg-[#0F0F1A] border border-white/10 rounded-lg px-3 py-2.5"><p className="text-[10px] text-[#8B8AA0]">Total</p><p className="text-sm font-mono text-[#6366F1]">Rp{Number(harga || 0).toLocaleString("id-ID")}</p></div></div>
      </div>
      <input placeholder="Catatan (opsional)" value={catatan} onChange={e => setCatatan(e.target.value)} className={inputCls + " mb-3"} />
      <div className="flex gap-2">
        <button onClick={() => handleSave("operasional")} disabled={loading} className="flex-1 py-2 rounded-lg font-semibold text-sm disabled:opacity-50" style={BTN_GRAD}>{loading ? "Menyimpan..." : "Simpan"}</button>
        <button onClick={() => { resetForm(); setActiveForm(null); }} className="px-4 py-2 rounded-lg border border-white/10 text-sm text-[#8B8AA0]">Batal</button>
      </div>
    </div>
  );

  const renderFormMortalitas = () => (
    <div className="bg-[#0A0A12] border border-[#EC4899]/20 rounded-xl p-4 mb-4">
      <p className="text-xs font-medium text-[#EC4899] mb-3">{editingId ? "Edit" : "Catat"} Mortalitas</p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div><label className="text-[10px] text-[#8B8AA0] mb-1 block">Tanggal</label><input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className={inputCls} style={{ colorScheme: "dark" }} /></div>
        <div><label className="text-[10px] text-[#8B8AA0] mb-1 block">Jumlah Mati (ekor)</label><input type="number" placeholder="2" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} /></div>
      </div>
      <input placeholder="Penyebab / catatan" value={catatan} onChange={e => setCatatan(e.target.value)} className={inputCls + " mb-3"} />
      <div className="flex gap-2">
        <button onClick={() => handleSave("mortalitas")} disabled={loading} className="flex-1 py-2 rounded-lg font-semibold text-sm disabled:opacity-50" style={BTN_GRAD}>{loading ? "Menyimpan..." : "Simpan"}</button>
        <button onClick={() => { resetForm(); setActiveForm(null); }} className="px-4 py-2 rounded-lg border border-white/10 text-sm text-[#8B8AA0]">Batal</button>
      </div>
    </div>
  );

  const renderFormPanen = () => (
    <div className="bg-[#0A0A12] border border-[#2DD4BF]/20 rounded-xl p-4 mb-4">
      <p className="text-xs font-medium text-[#2DD4BF] mb-3">{editingId ? "Edit" : "Catat"} Panen</p>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div><label className="text-[10px] text-[#8B8AA0] mb-1 block">Tanggal Panen</label><input type="date" value={tanggal} onChange={e => setTanggal(e.target.value)} className={inputCls} style={{ colorScheme: "dark" }} /></div>
        <div><label className="text-[10px] text-[#8B8AA0] mb-1 block">Jumlah Terjual (ekor)</label><input type="number" placeholder="90" value={qty} onChange={e => setQty(e.target.value)} className={inputCls} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div><label className="text-[10px] text-[#8B8AA0] mb-1 block">Harga Jual/ekor (Rp)</label><input type="number" placeholder="50000" value={harga} onChange={e => setHarga(e.target.value)} className={inputCls} /></div>
        <div><label className="text-[10px] text-[#8B8AA0] mb-1 block">Berat Total (kg, opsional)</label><input type="number" placeholder="180" value={satuan} onChange={e => setSatuan(e.target.value)} className={inputCls} /></div>
      </div>
      <div className="bg-[#0F0F1A] rounded-lg px-3 py-2 mb-3">
        <div className="flex justify-between items-center">
          <span className="text-[10px] text-[#8B8AA0]">Populasi hidup saat ini</span>
          <span className="text-sm font-mono">{populasiHidup} ekor</span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-[10px] text-[#8B8AA0]">Pendapatan</span>
          <span className="text-sm font-mono text-[#2DD4BF]">Rp{calcTotal("panen").toLocaleString("id-ID")}</span>
        </div>
      </div>
      <input placeholder="Catatan (opsional)" value={catatan} onChange={e => setCatatan(e.target.value)} className={inputCls + " mb-3"} />
      <div className="flex gap-2">
        <button onClick={() => handleSave("panen")} disabled={loading} className="flex-1 py-2 rounded-lg font-semibold text-sm disabled:opacity-50" style={BTN_GRAD}>{loading ? "Menyimpan..." : "Simpan"}</button>
        <button onClick={() => { resetForm(); setActiveForm(null); }} className="px-4 py-2 rounded-lg border border-white/10 text-sm text-[#8B8AA0]">Batal</button>
      </div>
    </div>
  );

  // Group transactions by date for timeline
  const grouped: Record<string, Transaction[]> = {};
  transactions.forEach(t => {
    if (!grouped[t.tanggal]) grouped[t.tanggal] = [];
    grouped[t.tanggal].push(t);
  });

  return (
    <div className="px-4 sm:px-8 py-4 sm:py-8">
      <PeternakanHubNav />
      <button onClick={() => router.push("/dashboard/peternakan")} className="text-xs text-[#8B8AA0] mb-4 flex items-center gap-1 hover:text-[#F2F1F8]">← Semua Batch</button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">{batch.nama_batch}</h1>
          <p className="text-xs text-[#8B8AA0]">{batch.jenis_ternak} · Mulai {new Date(batch.tanggal_mulai).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={"text-[10px] px-2.5 py-1 rounded-full font-medium " + (batch.status === "aktif" ? "bg-[#2DD4BF]/15 text-[#2DD4BF]" : "bg-white/10 text-[#8B8AA0]")}>{batch.status === "aktif" ? "Aktif" : "Selesai"}</span>
          {batch.status === "aktif" && (
            <button onClick={handleSelesaikan} className="text-[10px] px-2.5 py-1 rounded-full border border-white/10 text-[#8B8AA0] hover:text-[#F2F1F8]">Selesaikan Batch</button>
          )}
        </div>
      </div>

      {/* RINGKASAN */}
      <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5 mb-6">
        <h2 className="text-xs font-semibold text-[#8B8AA0] uppercase tracking-widest mb-4">Ringkasan Batch</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-[#0A0A12] rounded-xl p-3 text-center">
            <p className="text-[10px] text-[#8B8AA0] mb-1">Populasi Awal</p>
            <p className="font-mono font-bold">{totalBibit} ekor</p>
          </div>
          <div className="bg-[#0A0A12] rounded-xl p-3 text-center">
            <p className="text-[10px] text-[#8B8AA0] mb-1">Populasi Hidup</p>
            <p className="font-mono font-bold text-[#2DD4BF]">{populasiHidup} ekor</p>
          </div>
          <div className="bg-[#0A0A12] rounded-xl p-3 text-center">
            <p className="text-[10px] text-[#8B8AA0] mb-1">Terjual</p>
            <p className="font-mono font-bold">{totalTerjual} ekor</p>
          </div>
          <div className="bg-[#0A0A12] rounded-xl p-3 text-center">
            <p className="text-[10px] text-[#8B8AA0] mb-1">Mortalitas</p>
            <p className="font-mono font-bold text-[#EC4899]">{totalMati} ekor {totalBibit > 0 ? `(${((totalMati/totalBibit)*100).toFixed(1)}%)` : ""}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div><p className="text-[10px] text-[#8B8AA0] mb-1">Modal Bibit</p><p className="text-sm font-mono text-[#38BDF8]">Rp{bibit.toLocaleString("id-ID")}</p></div>
          <div><p className="text-[10px] text-[#8B8AA0] mb-1">Total Pakan</p><p className="text-sm font-mono text-[#F59E0B]">Rp{pakan.toLocaleString("id-ID")}</p></div>
          <div><p className="text-[10px] text-[#8B8AA0] mb-1">Total Obat/Vitamin</p><p className="text-sm font-mono text-[#8B5CF6]">Rp{obat.toLocaleString("id-ID")}</p></div>
          <div><p className="text-[10px] text-[#8B8AA0] mb-1">Total Operasional</p><p className="text-sm font-mono text-[#6366F1]">Rp{operasional.toLocaleString("id-ID")}</p></div>
          <div><p className="text-[10px] text-[#8B8AA0] mb-1">Total Modal</p><p className="text-sm font-mono font-bold text-[#EC4899]">Rp{totalModal.toLocaleString("id-ID")}</p></div>
          <div><p className="text-[10px] text-[#8B8AA0] mb-1">Pendapatan</p><p className="text-sm font-mono font-bold text-[#2DD4BF]">Rp{panen.toLocaleString("id-ID")}</p></div>
        </div>
        <div className={"rounded-xl p-4 " + (labaBersih >= 0 ? "bg-[#2DD4BF]/10 border border-[#2DD4BF]/20" : "bg-[#EC4899]/10 border border-[#EC4899]/20")}>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold" style={{ color: labaBersih >= 0 ? "#2DD4BF" : "#EC4899" }}>{labaBersih >= 0 ? "✅ Laba Bersih" : "❌ Rugi"}</p>
            <p className="text-xl font-mono font-bold" style={{ color: labaBersih >= 0 ? "#2DD4BF" : "#EC4899" }}>{labaBersih >= 0 ? "+" : ""}Rp{labaBersih.toLocaleString("id-ID")}</p>
          </div>
        </div>
      </div>

      {/* TOMBOL TAMBAH */}
      {batch.status === "aktif" && (
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2 mb-6">
          {[
            { key: "bibit", label: "Bibit", color: "#38BDF8" },
            { key: "pakan", label: "Pakan", color: "#F59E0B" },
            { key: "obat", label: "Obat", color: "#8B5CF6" },
            { key: "vitamin", label: "Vitamin", color: "#06B6D4" },
            { key: "operasional", label: "Operasional", color: "#6366F1" },
            { key: "mortalitas", label: "Mortalitas", color: "#EC4899" },
            { key: "panen", label: "Panen", color: "#2DD4BF" },
          ].map(btn => (
            <button key={btn.key} onClick={() => { resetForm(); setActiveForm(activeForm === btn.key ? null : btn.key); }}
              className={"flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-medium border transition-all " + (activeForm === btn.key ? "border-opacity-60" : "border-white/10 text-[#8B8AA0] hover:border-white/20")}
              style={activeForm === btn.key ? { borderColor: btn.color, background: btn.color + "15", color: btn.color } : {}}>
              <Plus size={11} /> {btn.label}
            </button>
          ))}
        </div>
      )}

      {/* FORMS */}
      {activeForm === "bibit" && renderFormBibit()}
      {activeForm === "pakan" && renderFormPakanObat("pakan")}
      {activeForm === "obat" && renderFormPakanObat("obat")}
      {activeForm === "vitamin" && renderFormPakanObat("vitamin")}
      {activeForm === "operasional" && renderFormOperasional()}
      {activeForm === "mortalitas" && renderFormMortalitas()}
      {activeForm === "panen" && renderFormPanen()}

      {/* TIMELINE */}
      <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5">
        <h2 className="text-xs font-semibold text-[#8B8AA0] uppercase tracking-widest mb-5">Timeline Transaksi</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-[#5A5B6A] text-center py-8">Belum ada transaksi. Mulai dengan tambah Bibit.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {Object.entries(grouped).map(([date, txs]) => (
              <div key={date} className="mb-4">
                <p className="text-[10px] font-semibold text-[#5A5B6A] uppercase tracking-widest mb-2">
                  {new Date(date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </p>
                {txs.map(t => {
                  const color = JENIS_COLORS[t.jenis_transaksi] || "#8B8AA0";
                  return (
                    <div key={t.id} className="flex items-center justify-between py-2.5 border-b border-white/[0.04] last:border-0 group">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold uppercase" style={{ color }}>{JENIS_LABELS[t.jenis_transaksi]}</span>
                            {t.nama_item && <span className="text-sm text-[#F2F1F8]">{t.nama_item}</span>}
                            {t.jenis_transaksi === "mortalitas" && <span className="text-sm text-[#F2F1F8]">{t.qty} ekor mati</span>}
                          </div>
                          <p className="text-[11px] text-[#5A5B6A]">
                            {t.qty && t.satuan ? `${t.qty} ${t.satuan}` : ""}
                            {t.harga ? ` × Rp${Number(t.harga).toLocaleString("id-ID")}` : ""}
                            {t.catatan ? ` · ${t.catatan}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.jenis_transaksi !== "mortalitas" && (
                          <span className="font-mono text-sm" style={{ color: t.jenis_transaksi === "panen" ? "#2DD4BF" : "#EC4899" }}>
                            {t.jenis_transaksi === "panen" ? "+" : "-"}Rp{Number(t.total).toLocaleString("id-ID")}
                          </span>
                        )}
                        <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEdit(t, t.jenis_transaksi)} className="p-1.5 text-[#8B8AA0] hover:text-[#2DD4BF]"><Edit2 size={13} /></button>
                          <button onClick={() => handleDelete(t)} className="p-1.5 text-[#8B8AA0] hover:text-[#EC4899]"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
