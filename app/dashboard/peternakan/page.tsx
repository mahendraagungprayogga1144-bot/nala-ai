import Link from "next/link";
import { Plus, Bird } from "lucide-react";
import PeternakanHubNav from "./peternakan-hub-nav";
import FnbEmptyState from "../fnb/components/fnb-empty-state";
import { getActiveBusiness, WrongBizType } from "../lib/get-active-business";
import { normalizeBizType } from "@/lib/auth/post-login";
import { guardPage } from "../lib/page-guard";

type FarmTx = { jenis_transaksi: string; total: number; qty: number | null; batch_id: string };
type Batch = {
  id: string;
  nama_batch: string;
  jenis_ternak: string;
  tanggal_mulai: string;
  tanggal_selesai: string | null;
  status: string;
};

function getRingkasan(transactions: { jenis_transaksi: string; total: number; qty: number | null }[]) {
  const bibit = transactions.filter((t) => t.jenis_transaksi === "bibit").reduce((s, t) => s + Number(t.total), 0);
  const pakan = transactions.filter((t) => t.jenis_transaksi === "pakan").reduce((s, t) => s + Number(t.total), 0);
  const obat = transactions.filter((t) => ["obat", "vitamin"].includes(t.jenis_transaksi)).reduce((s, t) => s + Number(t.total), 0);
  const operasional = transactions.filter((t) => t.jenis_transaksi === "operasional").reduce((s, t) => s + Number(t.total), 0);
  const panen = transactions.filter((t) => t.jenis_transaksi === "panen").reduce((s, t) => s + Number(t.total), 0);
  const totalBibitEkor = transactions.filter((t) => t.jenis_transaksi === "bibit").reduce((s, t) => s + Number(t.qty || 0), 0);
  const totalMati = transactions.filter((t) => t.jenis_transaksi === "mortalitas").reduce((s, t) => s + Number(t.qty || 0), 0);
  const totalTerjual = transactions.filter((t) => t.jenis_transaksi === "panen").reduce((s, t) => s + Number(t.qty || 0), 0);
  const totalModal = bibit + pakan + obat + operasional;
  const labaBersih = panen - totalModal;
  return {
    bibit,
    pakan,
    obat,
    operasional,
    panen,
    totalModal,
    labaBersih,
    totalBibitEkor,
    totalMati,
    totalTerjual,
    populasiHidup: totalBibitEkor - totalMati - totalTerjual,
  };
}

export default async function PeternakanPage() {
  return guardPage("Manajemen Ternak", async () => {
    const { supabase, user, business } = await getActiveBusiness("ternak");
    if (!user) {
      return (
        <div className="px-8 py-12 text-center">
          <p className="text-sm text-[#8B8AA0]">Sesi tidak terbaca. Muat ulang atau login ulang.</p>
        </div>
      );
    }
    if (!supabase) {
      return (
        <div className="px-8 py-12 text-center">
          <p className="mb-2 text-[#EC4899]">Koneksi server gagal.</p>
          <p className="text-xs text-[#8B8AA0]">Coba hard-refresh (Ctrl+Shift+R).</p>
        </div>
      );
    }

    if (!business || normalizeBizType(business.type) !== "ternak") {
      return <WrongBizType label="Peternakan" />;
    }

    let batches: Batch[] = [];
    let batchErr: string | null = null;
    const txByBatch: Record<string, FarmTx[]> = {};

    const batchRes = await supabase
      .from("farm_batches")
      .select("id, nama_batch, jenis_ternak, tanggal_mulai, tanggal_selesai, status")
      .eq("user_id", user.id)
      .eq("business_id", business.id)
      .order("tanggal_mulai", { ascending: false });

    if (batchRes.error) {
      batchErr = batchRes.error.message;
    } else {
      batches = (batchRes.data || []) as Batch[];
    }

    if (batches.length) {
      const ids = batches.map((b) => b.id);
      const { data: txs, error: txErr } = await supabase
        .from("farm_transactions")
        .select("batch_id, jenis_transaksi, total, qty")
        .in("batch_id", ids);
      if (txErr) {
        batchErr = (batchErr ? batchErr + " · " : "") + txErr.message;
      } else {
        for (const t of txs || []) {
          if (!txByBatch[t.batch_id]) txByBatch[t.batch_id] = [];
          txByBatch[t.batch_id].push(t as FarmTx);
        }
      }
    }

    const aktivBatches = batches.filter((b) => b.status === "aktif");
    const selesaiBatches = batches.filter((b) => b.status === "selesai");

    return (
      <div className="px-4 py-4 sm:px-8 sm:py-8">
        <div className="mb-1 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Manajemen Ternak</h1>
          {business?.name && (
            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-[#8B8AA0]">{business.name}</span>
          )}
        </div>
        <p className="mb-4 text-sm text-[#8B8AA0]">
          Buat batch → catat bibit, pakan, panen → laba/rugi otomatis + sync Keuangan Bisnis.
        </p>

        {batchErr && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            Gagal memuat data: {batchErr}. Pastikan migrasi peternakan sudah dijalankan di Supabase.
          </div>
        )}

        <PeternakanHubNav />

        <Link
          href="/dashboard/peternakan/batch/baru"
          className="mb-8 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
          style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}
        >
          <Plus size={16} /> Buat Batch Baru
        </Link>

        {aktivBatches.length > 0 && (
          <>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#2DD4BF]">Batch Aktif</h2>
            <div className="mb-8 grid gap-4 sm:grid-cols-2">
              {aktivBatches.map((b) => {
                const r = getRingkasan(txByBatch[b.id] || []);
                return (
                  <Link
                    key={b.id}
                    href={`/dashboard/peternakan/batch/${b.id}`}
                    className="block rounded-2xl border border-white/10 bg-[#0F0F1A] p-5 transition-colors hover:border-[#2DD4BF]/40"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{b.nama_batch}</p>
                        <p className="text-xs text-[#8B8AA0]">
                          {b.jenis_ternak} · Mulai{" "}
                          {new Date(b.tanggal_mulai).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#2DD4BF]/15 px-2.5 py-1 text-[10px] font-medium text-[#2DD4BF]">
                        Aktif
                      </span>
                    </div>
                    <div className="mb-3 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-[#0A0A12] p-3 text-center">
                        <p className="mb-1 text-[10px] text-[#8B8AA0]">Populasi</p>
                        <p className="font-mono text-sm font-bold">{r.populasiHidup}</p>
                        <p className="text-[9px] text-[#5A5B6A]">ekor</p>
                      </div>
                      <div className="rounded-xl bg-[#0A0A12] p-3 text-center">
                        <p className="mb-1 text-[10px] text-[#8B8AA0]">Total Modal</p>
                        <p className="font-mono text-sm font-bold text-[#EC4899]">
                          Rp{(r.totalModal / 1000).toFixed(0)}rb
                        </p>
                      </div>
                      <div className="rounded-xl bg-[#0A0A12] p-3 text-center">
                        <p className="mb-1 text-[10px] text-[#8B8AA0]">Laba/Rugi</p>
                        <p
                          className={
                            "font-mono text-sm font-bold " +
                            (r.labaBersih >= 0 ? "text-[#2DD4BF]" : "text-[#EC4899]")
                          }
                        >
                          {r.labaBersih >= 0 ? "+" : ""}
                          Rp{(r.labaBersih / 1000).toFixed(0)}rb
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] text-[#8B8AA0]">
                      Mati: {r.totalMati} ekor · Terjual: {r.totalTerjual} ekor
                    </p>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {selesaiBatches.length > 0 && (
          <>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#8B8AA0]">
              Riwayat Batch
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {selesaiBatches.map((b) => {
                const r = getRingkasan(txByBatch[b.id] || []);
                return (
                  <Link
                    key={b.id}
                    href={`/dashboard/peternakan/batch/${b.id}`}
                    className="block rounded-2xl border border-white/10 bg-[#0F0F1A] p-5 opacity-75 transition-colors hover:border-white/20"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{b.nama_batch}</p>
                        <p className="text-xs text-[#8B8AA0]">
                          {b.jenis_ternak} ·{" "}
                          {new Date(b.tanggal_mulai).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          -{" "}
                          {b.tanggal_selesai
                            ? new Date(b.tanggal_selesai).toLocaleDateString("id-ID", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "-"}
                        </p>
                      </div>
                      <span
                        className={
                          "rounded-full px-2.5 py-1 text-[10px] font-medium " +
                          (r.labaBersih >= 0
                            ? "bg-[#2DD4BF]/10 text-[#2DD4BF]"
                            : "bg-[#EC4899]/10 text-[#EC4899]")
                        }
                      >
                        {r.labaBersih >= 0
                          ? `+Rp${(r.labaBersih / 1000000).toFixed(1)}jt`
                          : `-Rp${(Math.abs(r.labaBersih) / 1000000).toFixed(1)}jt`}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-[10px] text-[#8B8AA0]">Modal</p>
                        <p className="font-mono text-xs">Rp{(r.totalModal / 1000000).toFixed(1)}jt</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#8B8AA0]">Pendapatan</p>
                        <p className="font-mono text-xs">Rp{(r.panen / 1000000).toFixed(1)}jt</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#8B8AA0]">Mortalitas</p>
                        <p className="font-mono text-xs">{r.totalMati} ekor</p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {batches.length === 0 && !batchErr && (
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
  });
}
