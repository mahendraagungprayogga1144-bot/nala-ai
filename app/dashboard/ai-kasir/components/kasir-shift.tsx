"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Clock, Play, Square, DollarSign, ShoppingCart, CheckCircle } from "lucide-react";
import type { KasirShift } from "../page";

function fmtRp(n: number) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); }

export default function KasirShiftPanel({
  userId, businessId, activeShift, todayShifts, omzetHariIni, totalOrder,
}: {
  userId: string; businessId: string;
  activeShift: KasirShift | null; todayShifts: KasirShift[];
  omzetHariIni: number; totalOrder: number;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [modalAwal, setModalAwal] = useState("");
  const [kasAkhir, setKasAkhir] = useState("");
  const [loading, setLoading] = useState(false);

  const inputCls = "w-full rounded-xl border border-white/[0.08] bg-[#0A0A12] px-3 py-2.5 text-sm text-[#F0EFF8] outline-none focus:border-[#2DD4BF]/40 transition-colors font-mono";

  const handleOpenShift = async () => {
    const modal = Number(modalAwal) || 0;
    setLoading(true);
    await supabase.from("kasir_shifts").insert({
      business_id: businessId,
      user_id: userId,
      modal_awal: modal,
      status: "open",
    });
    setModalAwal("");
    setLoading(false);
    router.refresh();
  };

  const handleCloseShift = async () => {
    if (!activeShift) return;
    const kasAkhirNum = Number(kasAkhir) || 0;
    setLoading(true);
    await supabase.from("kasir_shifts").update({
      kas_akhir: kasAkhirNum,
      closed_at: new Date().toISOString(),
      status: "closed",
    }).eq("id", activeShift.id);
    setKasAkhir("");
    setLoading(false);
    router.refresh();
  };

  const closedShifts = todayShifts.filter(s => s.status === "closed");

  return (
    <div>
      {/* Active shift / Open shift */}
      <div className="mb-5 rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
        {activeShift ? (
          <>
            <div className="mb-4 flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-[#4ADE80] animate-pulse" />
              <p className="text-sm font-semibold text-[#4ADE80]">Shift Aktif</p>
              <span className="ml-auto text-[10px] text-[#5A5B7A] font-mono">Mulai {fmtTime(activeShift.opened_at)}</span>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Modal Awal", value: fmtRp(Number(activeShift.modal_awal)), color: "#8B5CF6", icon: DollarSign },
                { label: "Total Transaksi", value: fmtRp(Number(activeShift.total_transaksi)), color: "#2DD4BF", icon: DollarSign },
                { label: "Total Order", value: String(Number(activeShift.total_order)), color: "#F59E0B", icon: ShoppingCart },
                { label: "Estimasi Kas", value: fmtRp(Number(activeShift.modal_awal) + Number(activeShift.total_transaksi)), color: "#38BDF8", icon: DollarSign },
              ].map(k => (
                <div key={k.label} className="rounded-xl border p-3" style={{ borderColor: k.color + "22", background: k.color + "08" }}>
                  <div className="mb-1 flex items-center gap-1">
                    <k.icon size={10} style={{ color: k.color }} />
                    <p className="text-[9px] uppercase tracking-wide" style={{ color: k.color + "99" }}>{k.label}</p>
                  </div>
                  <p className="text-sm font-bold" style={{ color: k.color, fontFamily: "'JetBrains Mono', monospace" }}>{k.value}</p>
                </div>
              ))}
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-[#8B8AA0]">Kas Akhir (Rp) — hitung uang di laci</label>
              <input type="number" className={inputCls} placeholder="Hitung uang tunai di laci kas"
                value={kasAkhir} onChange={e => setKasAkhir(e.target.value)} />
            </div>

            {kasAkhir && (
              <div className="mb-3 rounded-xl border border-white/[0.06] bg-[#0A0A12]/60 p-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#8B8AA0]">Estimasi Kas</span>
                  <span className="font-mono text-[#2DD4BF]">{fmtRp(Number(activeShift.modal_awal) + Number(activeShift.total_transaksi))}</span>
                </div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-[#8B8AA0]">Kas Akhir (dihitung)</span>
                  <span className="font-mono text-[#F0EFF8]">{fmtRp(Number(kasAkhir))}</span>
                </div>
                <div className="h-px bg-white/[0.06] my-1.5" />
                {(() => {
                  const estimasi = Number(activeShift.modal_awal) + Number(activeShift.total_transaksi);
                  const selisih = Number(kasAkhir) - estimasi;
                  const color = selisih === 0 ? "#4ADE80" : selisih > 0 ? "#F59E0B" : "#EC4899";
                  return (
                    <div className="flex justify-between text-xs">
                      <span className="text-[#8B8AA0]">Selisih</span>
                      <span className="font-mono font-semibold" style={{ color }}>
                        {selisih >= 0 ? "+" : ""}{fmtRp(selisih)}
                        {selisih === 0 && " (pas)"}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            <button type="button" onClick={handleCloseShift} disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#EC4899]/30 bg-[#EC4899]/10 py-3 text-sm font-semibold text-[#EC4899] disabled:opacity-40">
              <Square size={14} /> {loading ? "Menutup..." : "Tutup Shift"}
            </button>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2">
              <Clock size={18} className="text-[#8B8AA0]" />
              <p className="text-sm font-semibold">Buka Shift Baru</p>
            </div>
            <p className="mb-3 text-xs text-[#5A5B7A]">
              Masukkan modal awal kas (uang tunai di laci) untuk memulai shift.
            </p>
            <div className="mb-4">
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-[#8B8AA0]">Modal Awal (Rp)</label>
              <input type="number" className={inputCls} placeholder="Contoh: 200000"
                value={modalAwal} onChange={e => setModalAwal(e.target.value)} />
            </div>
            <button type="button" onClick={handleOpenShift} disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" }}>
              <Play size={14} /> {loading ? "Membuka..." : "Buka Shift"}
            </button>
          </>
        )}
      </div>

      {/* Riwayat shift hari ini */}
      {closedShifts.length > 0 && (
        <div className="rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">
            <CheckCircle size={12} className="inline mr-1" /> Riwayat Shift Hari Ini
          </p>
          <div className="space-y-2">
            {closedShifts.map(s => {
              const estimasi = Number(s.modal_awal) + Number(s.total_transaksi);
              const selisih = Number(s.kas_akhir) - estimasi;
              return (
                <div key={s.id} className="rounded-xl border border-white/[0.06] bg-[#0A0A12]/60 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-[#F0EFF8]">
                      {fmtTime(s.opened_at)} — {s.closed_at ? fmtTime(s.closed_at) : "—"}
                    </p>
                    <span className="rounded-full bg-[#4ADE80]/10 px-2 py-0.5 text-[9px] font-semibold text-[#4ADE80]">Selesai</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                    <div><span className="text-[#5A5B7A]">Modal</span><p className="font-mono text-[#8B8AA0]">{fmtRp(Number(s.modal_awal))}</p></div>
                    <div><span className="text-[#5A5B7A]">Omzet</span><p className="font-mono text-[#2DD4BF]">{fmtRp(Number(s.total_transaksi))}</p></div>
                    <div><span className="text-[#5A5B7A]">Order</span><p className="font-mono text-[#8B8AA0]">{Number(s.total_order)}</p></div>
                    <div>
                      <span className="text-[#5A5B7A]">Selisih</span>
                      <p className="font-mono" style={{ color: selisih === 0 ? "#4ADE80" : selisih > 0 ? "#F59E0B" : "#EC4899" }}>
                        {selisih >= 0 ? "+" : ""}{fmtRp(selisih)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
