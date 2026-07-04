"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Shield, Save } from "lucide-react";
import type { NpwpProfile, PajakRecord } from "../page";

const BULAN = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const inputCls = "w-full rounded-xl border border-white/[0.08] bg-[#0A0A12] px-3 py-2.5 text-sm text-[#F0EFF8] outline-none focus:border-[#2DD4BF]/40 transition-colors";
const btnCls = "rounded-xl bg-gradient-to-r from-[#2DD4BF] to-[#8B5CF6] px-4 py-2.5 text-xs font-bold text-white transition-opacity hover:opacity-90";

function fmtRp(n: number) { return "Rp" + Math.round(n).toLocaleString("id-ID"); }

export default function PajakRiwayat({
  userId, npwp, pajakRecords, tahun,
}: { userId: string; npwp: NpwpProfile | null; pajakRecords: PajakRecord[]; tahun: number }) {
  const router = useRouter();
  const supabase = createClient();

  // NPWP form
  const [npwpForm, setNpwpForm] = useState({
    npwp: npwp?.npwp || "", nama_wp: npwp?.nama_wp || "",
    alamat: npwp?.alamat || "", jenis_usaha: npwp?.jenis_usaha || "", klu: npwp?.klu || "",
  });
  const [npwpSaving, setNpwpSaving] = useState(false);

  const saveNpwp = async (e: React.FormEvent) => {
    e.preventDefault();
    setNpwpSaving(true);
    if (npwp) {
      await supabase.from("npwp_profiles").update({ ...npwpForm }).eq("id", npwp.id);
    } else {
      await supabase.from("npwp_profiles").insert({ user_id: userId, ...npwpForm });
    }
    setNpwpSaving(false);
    router.refresh();
  };

  // Pajak record form
  const [openRecord, setOpenRecord] = useState(false);
  const [recLoading, setRecLoading] = useState(false);
  const now = new Date();
  const [recForm, setRecForm] = useState({
    bulan: String(now.getMonth() + 1), tahun: String(tahun),
    omzet_bulan: "", pph_terutang: "", pph_dibayar: "",
    tanggal_bayar: "", no_ntpn: "", catatan: "",
  });

  const omzetVal = Number(recForm.omzet_bulan) || 0;
  const autoPph = omzetVal * 0.005;

  const saveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecLoading(true);
    const { error } = await supabase.from("pajak_records").insert({
      user_id: userId,
      tahun: Number(recForm.tahun), bulan: Number(recForm.bulan),
      omzet_bulan: omzetVal,
      pph_terutang: Number(recForm.pph_terutang) || autoPph,
      pph_dibayar: Number(recForm.pph_dibayar) || 0,
      tanggal_bayar: recForm.tanggal_bayar || null,
      no_ntpn: recForm.no_ntpn || null,
      catatan: recForm.catatan || null,
    });
    setRecLoading(false);
    if (error) return alert(error.message);
    setOpenRecord(false);
    setRecForm({ bulan: String(now.getMonth() + 1), tahun: String(tahun), omzet_bulan: "", pph_terutang: "", pph_dibayar: "", tanggal_bayar: "", no_ntpn: "", catatan: "" });
    router.refresh();
  };

  const deleteRecord = async (id: string) => {
    if (!confirm("Hapus data ini?")) return;
    await supabase.from("pajak_records").delete().eq("id", id);
    router.refresh();
  };

  return (
    <div>
      {/* NPWP Profile form */}
      <div className="mb-6 rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
        <div className="mb-3 flex items-center gap-2">
          <Shield size={16} className="text-[#2DD4BF]" />
          <p className="text-xs font-semibold uppercase tracking-wide text-[#8B8AA0]">Data NPWP</p>
        </div>
        <form onSubmit={saveNpwp} className="grid gap-3 sm:grid-cols-2">
          <input className={inputCls} placeholder="NPWP (XX.XXX.XXX.X-XXX.XXX)" value={npwpForm.npwp} onChange={e => setNpwpForm({ ...npwpForm, npwp: e.target.value })} />
          <input className={inputCls} placeholder="Nama wajib pajak" value={npwpForm.nama_wp} onChange={e => setNpwpForm({ ...npwpForm, nama_wp: e.target.value })} />
          <input className={inputCls + " sm:col-span-2"} placeholder="Alamat" value={npwpForm.alamat} onChange={e => setNpwpForm({ ...npwpForm, alamat: e.target.value })} />
          <input className={inputCls} placeholder="Jenis usaha" value={npwpForm.jenis_usaha} onChange={e => setNpwpForm({ ...npwpForm, jenis_usaha: e.target.value })} />
          <input className={inputCls} placeholder="KLU (Klasifikasi Lapangan Usaha)" value={npwpForm.klu} onChange={e => setNpwpForm({ ...npwpForm, klu: e.target.value })} />
          <button type="submit" disabled={npwpSaving} className={btnCls + " sm:col-span-2 flex items-center justify-center gap-1.5"}>
            <Save size={14} /> {npwpSaving ? "Menyimpan..." : npwp ? "Update NPWP" : "Simpan NPWP"}
          </button>
        </form>
      </div>

      {/* Pajak records */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-[#8B8AA0]">Riwayat Setoran Pajak</p>
        <button type="button" onClick={() => setOpenRecord(!openRecord)} className={"flex items-center gap-1.5 " + btnCls}>
          <Plus size={14} /> Catat Setoran
        </button>
      </div>

      {openRecord && (
        <form onSubmit={saveRecord} className="mb-6 grid gap-3 sm:grid-cols-2 rounded-2xl border border-white/[0.08] p-5" style={{ background: "#0D0D1A" }}>
          <select className={inputCls} value={recForm.bulan} onChange={e => setRecForm({ ...recForm, bulan: e.target.value })}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>{BULAN[m]}</option>)}
          </select>
          <input className={inputCls} type="number" placeholder="Tahun" value={recForm.tahun} onChange={e => setRecForm({ ...recForm, tahun: e.target.value })} />
          <div>
            <input className={inputCls} type="number" placeholder="Omzet bulan (Rp)" value={recForm.omzet_bulan} onChange={e => setRecForm({ ...recForm, omzet_bulan: e.target.value })} />
            {omzetVal > 0 && <p className="mt-1 text-[10px] text-[#5A5B7A]">PPh auto: {fmtRp(autoPph)}</p>}
          </div>
          <input className={inputCls} type="number" placeholder={`PPh terutang (default: ${fmtRp(autoPph)})`} value={recForm.pph_terutang} onChange={e => setRecForm({ ...recForm, pph_terutang: e.target.value })} />
          <input className={inputCls} type="number" placeholder="PPh dibayar (Rp)" value={recForm.pph_dibayar} onChange={e => setRecForm({ ...recForm, pph_dibayar: e.target.value })} />
          <input className={inputCls} type="date" placeholder="Tanggal bayar" value={recForm.tanggal_bayar} onChange={e => setRecForm({ ...recForm, tanggal_bayar: e.target.value })} />
          <input className={inputCls} placeholder="No NTPN (bukti bayar)" value={recForm.no_ntpn} onChange={e => setRecForm({ ...recForm, no_ntpn: e.target.value })} />
          <input className={inputCls} placeholder="Catatan" value={recForm.catatan} onChange={e => setRecForm({ ...recForm, catatan: e.target.value })} />
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={recLoading} className={btnCls + " flex-1"}>{recLoading ? "Menyimpan..." : "Simpan Setoran"}</button>
            <button type="button" onClick={() => setOpenRecord(false)} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm text-[#8B8AA0]">Batal</button>
          </div>
        </form>
      )}

      {pajakRecords.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
          <p className="text-sm text-[#5A5B7A]">Belum ada riwayat setoran. Klik Catat Setoran untuk mulai.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.08]" style={{ background: "#0D0D1A" }}>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/[0.06] text-[9px] uppercase tracking-wider text-[#5A5B7A]">
                <th className="p-3">Periode</th>
                <th className="p-3 text-right">Omzet</th>
                <th className="p-3 text-right">Terutang</th>
                <th className="p-3 text-right">Dibayar</th>
                <th className="p-3 hidden sm:table-cell">NTPN</th>
                <th className="p-3 hidden sm:table-cell">Tgl Bayar</th>
                <th className="p-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {pajakRecords.map(r => {
                const kurang = Number(r.pph_terutang) - Number(r.pph_dibayar);
                return (
                  <tr key={r.id} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <td className="p-3 font-medium">{BULAN[r.bulan]} {r.tahun}</td>
                    <td className="p-3 text-right font-mono text-[#2DD4BF]">{fmtRp(Number(r.omzet_bulan))}</td>
                    <td className="p-3 text-right font-mono text-[#A78BFA]">{fmtRp(Number(r.pph_terutang))}</td>
                    <td className="p-3 text-right font-mono" style={{ color: kurang > 0 ? "#F43F5E" : "#4ADE80" }}>{fmtRp(Number(r.pph_dibayar))}</td>
                    <td className="p-3 hidden sm:table-cell text-[#5A5B7A]">{r.no_ntpn || "—"}</td>
                    <td className="p-3 hidden sm:table-cell text-[#5A5B7A]">{r.tanggal_bayar || "—"}</td>
                    <td className="p-3">
                      <button type="button" onClick={() => deleteRecord(r.id)} className="text-[#5A5B7A] hover:text-[#F43F5E]"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
