"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Copy, User, ExternalLink } from "lucide-react";

type Employee = {
  id: string; nama: string; jabatan: string | null;
  kasir_token: string; aktif: boolean; created_at: string;
};

const inputCls = "w-full px-3 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50 text-sm";
const BTN_GRAD = { background: "linear-gradient(135deg, #2DD4BF, #8B5CF6)", color: "#070711" } as const;

import FnbHubNav from "../components/fnb-hub-nav";
import FnbMobileActionBar from "../components/fnb-mobile-action-bar";
import FnbKpiRow from "../components/fnb-kpi-row";

export default function KaryawanClient({ employees, userId, businessId }: { employees: Employee[]; userId: string; businessId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [showForm, setShowForm] = useState(false);
  const [nama, setNama] = useState("");
  const [jabatan, setJabatan] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const handleTambah = async () => {
    if (!nama) return;
    setLoading(true);
    const { error } = await supabase.from("employees").insert({
      business_id: businessId,
      user_id: userId,
      nama, jabatan: jabatan || null,
      aktif: true,
    });
    if (error) { alert("Gagal: " + error.message); setLoading(false); return; }
    setLoading(false);
    setNama(""); setJabatan("");
    setShowForm(false);
    router.refresh();
  };

  const handleDelete = async (id: string, nama: string) => {
    if (!confirm("Hapus karyawan " + nama + "? Link kasir mereka akan nonaktif.")) return;
    await supabase.from("employees").update({ aktif: false }).eq("id", id);
    router.refresh();
  };

  const copyLink = (token: string) => {
    const url = window.location.origin + "/kasir/" + token;
    navigator.clipboard.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 2000);
  };

  const getLink = (token: string) => window.location.origin + "/kasir/" + token;

  const aktif = employees.filter(e => e.aktif);

  return (
    <div className="max-md:pb-[calc(56px+3.25rem+env(safe-area-inset-bottom))] md:pb-0">
      <FnbHubNav />
      <FnbKpiRow items={[
        { label: "Total karyawan", value: String(employees.length), color: "#38BDF8" },
        { label: "Aktif", value: String(aktif.length), color: "#2DD4BF" },
        { label: "Link kasir", value: String(aktif.length), color: "#8B5CF6" },
      ]} />

      <div className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-[#0F0F1A]">
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5 md:px-4 md:py-3">
          <span className="text-sm font-medium">Daftar Karyawan</span>
          <button onClick={() => setShowForm(!showForm)}
            className="hidden items-center gap-1 rounded-lg px-3 py-1.5 text-xs md:flex"
            style={{ background: "linear-gradient(to right, #38BDF8, #8B5CF6)", color: "#0A0A12" }}>
            <Plus size={13} /> Tambah
          </button>
        </div>

        {showForm && (
          <div className="px-4 py-4 border-b border-white/10 bg-[#0A0A12]/40">
            <p className="text-xs font-medium text-[#2DD4BF] mb-3">Karyawan Baru</p>
            <div className="flex flex-col gap-2">
              <input className={inputCls} placeholder="Nama karyawan" value={nama} onChange={e => setNama(e.target.value)} />
              <input className={inputCls} placeholder="Jabatan (Kasir, Barista, Pelayan...)" value={jabatan} onChange={e => setJabatan(e.target.value)} />
              <div className="bg-[#2DD4BF]/5 border border-[#2DD4BF]/15 rounded-lg px-3 py-2">
                <p className="text-[11px] text-[#8B8AA0]">Setelah ditambah, sistem akan generate link kasir unik untuk karyawan ini. Bagikan link ke HP karyawan untuk akses kasir.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={handleTambah} disabled={loading}
                  className="flex-1 py-2 rounded-lg text-[#0A0A12] font-semibold text-sm disabled:opacity-50"
                  style={{ background: "linear-gradient(to right, #38BDF8, #8B5CF6)" }}>
                  {loading ? "Menyimpan..." : "Tambah Karyawan"}
                </button>
                <button onClick={() => { setShowForm(false); setNama(""); setJabatan(""); }} className="px-4 py-2 rounded-lg border border-white/10 text-sm text-[#8B8AA0]">Batal</button>
              </div>
            </div>
          </div>
        )}

        {employees.length === 0 ? (
          <div className="text-center py-12">
            <User size={32} className="text-[#3A3B52] mx-auto mb-3" />
            <p className="text-sm text-[#5A5B6A] mb-1">Belum ada karyawan</p>
            <p className="text-xs text-[#3A3B52]">Tambah karyawan untuk generate link kasir</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {employees.map(emp => (
              <div key={emp.id} className="px-3 py-3 md:px-4 md:py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl text-sm font-semibold md:h-9 md:w-9 md:rounded-xl"
                    style={{ background: emp.aktif ? "rgba(45,212,191,.12)" : "rgba(255,255,255,.04)", color: emp.aktif ? "#2DD4BF" : "#5A5B7A" }}>
                    {emp.nama.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#F0EFF8]">{emp.nama}</p>
                    <p className="text-[11px] text-[#5A5B7A]">{emp.jabatan || "Karyawan"}</p>
                  </div>
                  <span className={"flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] " + (emp.aktif ? "bg-[#2DD4BF]/10 text-[#2DD4BF]" : "bg-white/5 text-[#8B8AA0]")}>
                    {emp.aktif ? "Aktif" : "Nonaktif"}
                  </span>
                  <button onClick={() => handleDelete(emp.id, emp.nama)} className="hidden p-1 text-[#8B8AA0] hover:text-[#EC4899] md:block">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mt-3 rounded-xl border border-white/[0.06] bg-[#0A0A12] px-3 py-2.5">
                  <p className="mb-1.5 text-[10px] uppercase tracking-wide text-[#5A5B7A]">Link kasir</p>
                  <p className="mb-2 truncate font-mono text-[11px] text-[#2DD4BF]">{getLink(emp.kasir_token)}</p>
                  <div className="flex gap-2">
                    <button onClick={() => copyLink(emp.kasir_token)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium md:py-1.5"
                      style={{ borderColor: copied === emp.kasir_token ? "rgba(45,212,191,.4)" : "rgba(255,255,255,.1)", color: copied === emp.kasir_token ? "#2DD4BF" : "#8B8AA0", background: copied === emp.kasir_token ? "rgba(45,212,191,.08)" : "rgba(255,255,255,.03)" }}>
                      <Copy size={11} />
                      {copied === emp.kasir_token ? "Tersalin!" : "Salin link"}
                    </button>
                    <a href={getLink(emp.kasir_token)} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2.5 text-xs text-[#8B8AA0] md:py-1.5">
                      <ExternalLink size={11} /> Buka
                    </a>
                    <button type="button" onClick={() => handleDelete(emp.id, emp.nama)} className="rounded-xl border border-white/10 px-3 py-2.5 text-[#8B8AA0] md:hidden"><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="hidden rounded-2xl border border-white/10 bg-[#0F0F1A] p-4 md:block">
        <p className="text-xs font-medium text-[#8B8AA0] mb-2">Cara kerja:</p>
        <div className="flex flex-col gap-2">
          {[
            "Tambah karyawan → sistem generate link kasir unik",
            "Bagikan link ke HP karyawan via WhatsApp/chat",
            "Karyawan buka link → daftarkan sidik jari di HP mereka",
            "Berikutnya cukup scan sidik jari → langsung masuk kasir",
            "Karyawan hanya bisa akses kasir, tidak bisa lihat data lain",
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 mt-0.5"
                style={{ background: "rgba(45,212,191,.15)", color: "#2DD4BF" }}>{i + 1}</span>
              <p className="text-xs text-[#8B8AA0]">{step}</p>
            </div>
          ))}
        </div>
      </div>

      {!showForm && (
        <FnbMobileActionBar label="Tambah Karyawan" onClick={() => setShowForm(true)} />
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 md:items-center md:justify-center md:hidden" onClick={() => { setShowForm(false); setNama(""); setJabatan(""); }}>
          <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0F0F1A] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={e => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-white/15" />
            <p className="mb-3 text-sm font-semibold text-[#2DD4BF]">Karyawan Baru</p>
            <div className="flex flex-col gap-2">
              <input className={inputCls} placeholder="Nama karyawan" value={nama} onChange={e => setNama(e.target.value)} />
              <input className={inputCls} placeholder="Jabatan (Kasir, Barista...)" value={jabatan} onChange={e => setJabatan(e.target.value)} />
              <button onClick={handleTambah} disabled={loading}
                className="mt-2 w-full rounded-xl py-3.5 text-sm font-bold disabled:opacity-50"
                style={BTN_GRAD}>
                {loading ? "Menyimpan..." : "Tambah Karyawan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
