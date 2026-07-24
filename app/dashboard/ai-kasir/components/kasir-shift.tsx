"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Clock, Play, Square, CheckCircle } from "lucide-react";
import type { KasirShift } from "../page";

function fmtRp(n: number) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }); }

export default function KasirShiftPanel({
  userId, businessId, activeShift, todayShifts, omzetHariIni, totalOrder, staffId, staffName,
}: {
  userId: string; businessId: string;
  activeShift: KasirShift | null; todayShifts: KasirShift[];
  omzetHariIni: number; totalOrder: number;
  staffId?: string | null; staffName?: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [modalAwal, setModalAwal] = useState("");
  const [kasAkhir, setKasAkhir] = useState("");
  const [loading, setLoading] = useState(false);

  const inputCls =
    "w-full rounded-xl border border-[#C5D4CB] bg-white px-3 py-2.5 text-sm text-[#0F1F17] outline-none focus:ring-2 focus:ring-[#007A4D]/25 font-mono";
  const card = "rounded-2xl border border-[#C5D4CB] bg-white p-5 shadow-sm";

  const handleOpenShift = async () => {
    const modal = Number(modalAwal) || 0;
    setLoading(true);
    await supabase.from("kasir_shifts").insert({
      business_id: businessId,
      user_id: userId,
      modal_awal: modal,
      status: "open",
      staff_id: staffId || null,
      staff_name: staffName || null,
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

  const closedShifts = todayShifts.filter((s) => s.status === "closed");

  return (
    <div>
      <div className={"mb-5 " + card}>
        {activeShift ? (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#007A4D]" />
              <p className="text-sm font-semibold text-[#007A4D]">Shift aktif</p>
              {activeShift.staff_name && (
                <span className="rounded-full bg-[#007A4D]/10 px-2 py-0.5 text-[10px] font-semibold text-[#007A4D]">
                  {activeShift.staff_name}
                </span>
              )}
              <span className="ml-auto font-mono text-[10px] text-[#5C6B63]">Mulai {fmtTime(activeShift.opened_at)}</span>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Modal awal", value: fmtRp(Number(activeShift.modal_awal)), color: "#0F1F17" },
                { label: "Omzet shift", value: fmtRp(Number(activeShift.total_transaksi)), color: "#007A4D" },
                { label: "Order", value: String(Number(activeShift.total_order)), color: "#B45309" },
                { label: "Estimasi kas", value: fmtRp(Number(activeShift.modal_awal) + Number(activeShift.total_transaksi)), color: "#1D4ED8" },
              ].map((k) => (
                <div key={k.label} className="rounded-xl bg-[#F2F6F4] p-3">
                  <p className="mb-1 text-[9px] uppercase tracking-wide text-[#5C6B63]">{k.label}</p>
                  <p className="font-mono text-sm font-bold" style={{ color: k.color }}>{k.value}</p>
                </div>
              ))}
            </div>

            <div className="mb-3">
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-[#5C6B63]">Kas akhir (Rp)</label>
              <input type="number" className={inputCls} placeholder="Hitung uang di laci"
                value={kasAkhir} onChange={(e) => setKasAkhir(e.target.value)} />
            </div>

            {kasAkhir && (
              <div className="mb-3 rounded-xl bg-[#F7FAF8] p-3 text-xs">
                <div className="mb-1 flex justify-between">
                  <span className="text-[#5C6B63]">Estimasi</span>
                  <span className="font-mono text-[#007A4D]">
                    {fmtRp(Number(activeShift.modal_awal) + Number(activeShift.total_transaksi))}
                  </span>
                </div>
                {(() => {
                  const estimasi = Number(activeShift.modal_awal) + Number(activeShift.total_transaksi);
                  const selisih = Number(kasAkhir) - estimasi;
                  const color = selisih === 0 ? "#007A4D" : selisih > 0 ? "#B45309" : "#B42318";
                  return (
                    <div className="flex justify-between">
                      <span className="text-[#5C6B63]">Selisih</span>
                      <span className="font-mono font-semibold" style={{ color }}>
                        {selisih >= 0 ? "+" : ""}{fmtRp(selisih)}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            <button type="button" onClick={handleCloseShift} disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#B42318]/30 bg-[#B42318]/8 py-3 text-sm font-semibold text-[#B42318] disabled:opacity-40">
              <Square size={14} /> {loading ? "Menutup…" : "Tutup shift"}
            </button>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2">
              <Clock size={18} className="text-[#5C6B63]" />
              <p className="text-sm font-semibold text-[#0F1F17]">Buka shift baru</p>
            </div>
            <p className="mb-3 text-xs text-[#5C6B63]">
              Modal awal kas di laci. Kasir: <strong>{staffName || "—"}</strong>
              {" · "}Omzet hari ini (modul): {fmtRp(omzetHariIni)} / {totalOrder} order
            </p>
            <div className="mb-4">
              <label className="mb-1 block text-[10px] uppercase tracking-wide text-[#5C6B63]">Modal awal (Rp)</label>
              <input type="number" className={inputCls} placeholder="Contoh: 200000"
                value={modalAwal} onChange={(e) => setModalAwal(e.target.value)} />
            </div>
            <button type="button" onClick={handleOpenShift} disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#007A4D] py-3 text-sm font-semibold text-white disabled:opacity-40">
              <Play size={14} /> {loading ? "Membuka…" : "Buka shift"}
            </button>
          </>
        )}
      </div>

      {closedShifts.length > 0 && (
        <div className={card}>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#5C6B63]">
            <CheckCircle size={12} className="mr-1 inline" /> Riwayat shift hari ini
          </p>
          <div className="space-y-2">
            {closedShifts.map((s) => {
              const estimasi = Number(s.modal_awal) + Number(s.total_transaksi);
              const selisih = Number(s.kas_akhir) - estimasi;
              return (
                <div key={s.id} className="rounded-xl bg-[#F7FAF8] p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-medium text-[#0F1F17]">
                      {fmtTime(s.opened_at)} — {s.closed_at ? fmtTime(s.closed_at) : "—"}
                      {s.staff_name ? ` · ${s.staff_name}` : ""}
                    </p>
                    <span className="rounded-full bg-[#007A4D]/10 px-2 py-0.5 text-[9px] font-semibold text-[#007A4D]">Selesai</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                    <div><span className="text-[#5C6B63]">Modal</span><p className="font-mono">{fmtRp(Number(s.modal_awal))}</p></div>
                    <div><span className="text-[#5C6B63]">Omzet</span><p className="font-mono text-[#007A4D]">{fmtRp(Number(s.total_transaksi))}</p></div>
                    <div><span className="text-[#5C6B63]">Order</span><p className="font-mono">{Number(s.total_order)}</p></div>
                    <div>
                      <span className="text-[#5C6B63]">Selisih</span>
                      <p className="font-mono" style={{ color: selisih === 0 ? "#007A4D" : selisih > 0 ? "#B45309" : "#B42318" }}>
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
