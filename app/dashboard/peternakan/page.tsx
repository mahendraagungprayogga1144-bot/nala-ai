import Link from "next/link";
import { Plus, Bird } from "lucide-react";
import PeternakanHubNav from "./peternakan-hub-nav";
import FnbEmptyState from "../fnb/components/fnb-empty-state";
import { getActiveBusiness, WrongBizType } from "../lib/get-active-business";
import { normalizeBizType } from "@/lib/auth/post-login";

type FarmTx = { jenis_transaksi: string; total: number; qty: number | null; batch_id: string };

export default async function PeternakanPage() {
  let supabase;
  let user;
  let business;
  try {
    ({ supabase, user, business } = await getActiveBusiness("ternak"));
  } catch (err) {
    console.error("[peternakan]", err);
    return (
      <div className="px-8 py-12 text-center">
        <p className="mb-2 text-[#EC4899]">Gagal memuat Peternakan.</p>
        <p className="text-xs text-[#8B8AA0]">Coba muat ulang halaman.</p>
      </div>
    );
  }
  if (!user) return null;

  if (!business || normalizeBizType(business.type) !== "ternak") {
    return <WrongBizType label="Peternakan" />;
  }

  let batches: {
    id: string;
    nama_batch: string;
    jenis_ternak: string;
    tanggal_mulai: string;
    tanggal_selesai: string | null;
    status: string;
  }[] | null = null;
  let batchErr: { message: string } | null = null;
  let txByBatch: Record<string, FarmTx[]> = {};

  try {
    const res = await supabase
      .from("farm_batches")
      .select("id, nama_batch, jenis_ternak, tanggal_mulai, tanggal_selesai, status")
      .eq("user_id", user.id)
      .eq("business_id", business.id)
      .order("tanggal_mulai", { ascending: false });
    batches = res.data;
    batchErr = res.error;

    if (batches?.length) {
      const ids = batches.map((b) => b.id);
      const { data: txs } = await supabase
        .from("farm_transactions")
        .select("batch_id, jenis_transaksi, total, qty")
        .in("batch_id", ids);
      for (const t of txs || []) {
        if (!txByBatch[t.batch_id]) txByBatch[t.batch_id] = [];
        txByBatch[t.batch_id].push(t as FarmTx);
      }
    }
  } catch (err) {
    console.error("[peternakan/query]", err);
    batchErr = { message: err instanceof Error ? err.message : "Query gagal" };
  }

  const dbError = batchErr?.message;

  const getRingkasan = (transactions: { jenis_transaksi: string; total: number; qty: number | null }[]) => {
    const bibit = transactions.filter(t => t.jenis_transaksi === "bibit").reduce((s, t) => s + Number(t.total), 0);
    const pakan = transactions.filter(t => t.jenis_transaksi === "pakan").reduce((s, t) => s + Number(t.total), 0);
    const obat = transactions.filter(t => ["obat", "vitamin"].includes(t.jenis_transaksi)).reduce((s, t) => s + Number(t.total), 0);
    const operasional = transactions.filter(t => t.jenis_transaksi === "operasional").reduce((s, t) => s + Number(t.total), 0);
    const panen = transactions.filter(t => t.jenis_transaksi === "panen").reduce((s, t) => s + Number(t.total), 0);
    const totalBibitEkor = transactions.filter(t => t.jenis_transaksi === "bibit").reduce((s, t) => s + Number(t.qty || 0), 0);
    const totalMati = transactions.filter(t => t.jenis_transaksi === "mortalitas").reduce((s, t) => s + Number(t.qty || 0), 0);
    const totalTerjual = transactions.filter(t => t.jenis_transaksi === "panen").reduce((s, t) => s + Number(t.qty || 0), 0);
    const totalModal = bibit + pakan + obat + operasional;
    const labaBersih = panen - totalModal;
    return { bibit, pakan, obat, operasional, panen, totalModal, labaBersih, totalBibitEkor, totalMati, totalTerjual, populasiHidup: totalBibitEkor - totalMati - totalTerjual };
  };

  const aktivBatches = (batches || []).filter(b => b.status === "aktif");
  const selesaiBatches = (batches || []).filter(b => b.status === "selesai");

  return (
    <div className="px-4 sm:px-8 py-4 sm:py-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold">Manajemen Ternak</h1>
        {business?.name && <span className="text-xs text-[#8B8AA0] bg-white/5 px-3 py-1 rounded-full">{business.name}</span>}
      </div>
      <p className="text-[#8B8AA0] mb-4 text-sm">Buat batch → catat bibit, pakan, panen → laba/rugi otomatis + sync Keuangan Bisnis.</p>

      {dbError && (
        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          Gagal memuat batch: {dbError}. Pastikan migration peternakan sudah dijalankan di Supabase.
        </div>
      )}

      <PeternakanHubNav />

      <Link href="/dashboard/peternakan/batch/baru" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm mb-8" style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}>
        <Plus size={16} /> Buat Batch Baru
      </Link>

      {aktivBatches.length > 0 && (
        <>
          <h2 className="text-[11px] font-semibold text-[#2DD4BF] tracking-widest uppercase mb-3">Batch Aktif</h2>
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            {aktivBatches.map((b) => {
              const r = getRingkasan(txByBatch[b.id] || []);
              return (
                <Link key={b.id} href={`/dashboard/peternakan/batch/${b.id}`} className="block bg-[#0F0F1A] border border-white/10 rounded-2xl p-5 hover:border-[#2DD4BF]/40 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold">{b.nama_batch}</p>
                      <p className="text-xs text-[#8B8AA0]">{b.jenis_ternak} · Mulai {new Date(b.tanggal_mulai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                    <span className="text-[10px] px-2.5 py-1 rounded-full bg-[#2DD4BF]/15 text-[#2DD4BF] font-medium">Aktif</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-[#0A0A12] rounded-xl p-3 text-center">
                      <p className="text-[10px] text-[#8B8AA0] mb-1">Populasi</p>
                      <p className="font-mono font-bold text-sm">{r.populasiHidup}</p>
                      <p className="text-[9px] text-[#5A5B6A]">ekor</p>
                    </div>
                    <div className="bg-[#0A0A12] rounded-xl p-3 text-center">
                      <p className="text-[10px] text-[#8B8AA0] mb-1">Total Modal</p>
                      <p className="font-mono font-bold text-sm text-[#EC4899]">Rp{(r.totalModal/1000).toFixed(0)}rb</p>
                    </div>
                    <div className="bg-[#0A0A12] rounded-xl p-3 text-center">
                      <p className="text-[10px] text-[#8B8AA0] mb-1">Laba/Rugi</p>
                      <p className={"font-mono font-bold text-sm " + (r.labaBersih >= 0 ? "text-[#2DD4BF]" : "text-[#EC4899]")}>
                        {r.labaBersih >= 0 ? "+" : ""}Rp{(r.labaBersih/1000).toFixed(0)}rb
                      </p>
                    </div>
                  </div>
                  <p className="text-[11px] text-[#8B8AA0]">Mati: {r.totalMati} ekor · Terjual: {r.totalTerjual} ekor</p>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {selesaiBatches.length > 0 && (
        <>
          <h2 className="text-[11px] font-semibold text-[#8B8AA0] tracking-widest uppercase mb-3">Riwayat Batch</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {selesaiBatches.map((b) => {
              const r = getRingkasan(txByBatch[b.id] || []);
              return (
                <Link key={b.id} href={`/dashboard/peternakan/batch/${b.id}`} className="block bg-[#0F0F1A] border border-white/10 rounded-2xl p-5 hover:border-white/20 transition-colors opacity-75">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold">{b.nama_batch}</p>
                      <p className="text-xs text-[#8B8AA0]">{b.jenis_ternak} · {new Date(b.tanggal_mulai).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} - {b.tanggal_selesai ? new Date(b.tanggal_selesai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "-"}</p>
                    </div>
                    <span className={"text-[10px] px-2.5 py-1 rounded-full font-medium " + (r.labaBersih >= 0 ? "bg-[#2DD4BF]/10 text-[#2DD4BF]" : "bg-[#EC4899]/10 text-[#EC4899]")}>
                      {r.labaBersih >= 0 ? `+Rp${(r.labaBersih/1000000).toFixed(1)}jt` : `-Rp${(Math.abs(r.labaBersih)/1000000).toFixed(1)}jt`}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div><p className="text-[10px] text-[#8B8AA0]">Modal</p><p className="text-xs font-mono">Rp{(r.totalModal/1000000).toFixed(1)}jt</p></div>
                    <div><p className="text-[10px] text-[#8B8AA0]">Pendapatan</p><p className="text-xs font-mono">Rp{(r.panen/1000000).toFixed(1)}jt</p></div>
                    <div><p className="text-[10px] text-[#8B8AA0]">Mortalitas</p><p className="text-xs font-mono">{r.totalMati} ekor</p></div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {(!batches || batches.length === 0) && (
        <FnbEmptyState
          icon={Bird}
          title="Belum ada batch ternak"
          subtitle="Satu batch = satu siklus pemeliharaan. Catat bibit, pakan, mortalitas, dan panen di satu tempat."
          actionLabel="Buat Batch Baru"
          actionHref="/dashboard/peternakan/batch/baru"
        />
      )}
    </div>
  );
}
