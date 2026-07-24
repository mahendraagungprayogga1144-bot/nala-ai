"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Users, Plus, UserX, Store } from "lucide-react";
import type { RetailStaff } from "../page";

export default function KasirTim({
  userId, businessId, staff, storeName, onRenameStore,
}: {
  userId: string; businessId: string; staff: RetailStaff[];
  storeName: string; onRenameStore: (name: string) => Promise<void>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [nama, setNama] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [rename, setRename] = useState(storeName);

  const inputCls =
    "w-full rounded-xl border border-[#C5D4CB] bg-white px-3 py-2.5 text-sm text-[#0F1F17] outline-none focus:ring-2 focus:ring-[#007A4D]/25";

  const addStaff = async () => {
    if (!nama.trim() || pin.length < 4) {
      alert("Nama + PIN minimal 4 digit.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("retail_kasir_staff").insert({
      business_id: businessId,
      user_id: userId,
      nama: nama.trim(),
      pin: pin.trim(),
      aktif: true,
    });
    setLoading(false);
    if (error) {
      alert("Gagal tambah: " + error.message);
      return;
    }
    setNama("");
    setPin("");
    router.refresh();
  };

  const toggleAktif = async (s: RetailStaff) => {
    await supabase.from("retail_kasir_staff").update({ aktif: !s.aktif }).eq("id", s.id);
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="rounded-2xl border border-[#C5D4CB] bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Store size={16} className="text-[#007A4D]" />
          <p className="text-sm font-semibold text-[#0F1F17]">Nama usaha (struk)</p>
        </div>
        <div className="flex gap-2">
          <input className={inputCls} value={rename} onChange={(e) => setRename(e.target.value)} />
          <button
            type="button"
            onClick={() => onRenameStore(rename.trim())}
            className="shrink-0 rounded-xl bg-[#007A4D] px-4 text-sm font-semibold text-white"
          >
            Simpan
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-[#C5D4CB] bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Users size={16} className="text-[#007A4D]" />
          <p className="text-sm font-semibold text-[#0F1F17]">Tim kasir live</p>
          <span className="ml-auto text-xs text-[#5C6B63]">{staff.filter((s) => s.aktif).length} aktif</span>
        </div>

        <div className="mb-4 space-y-2">
          {staff.length === 0 ? (
            <p className="py-4 text-center text-xs text-[#5C6B63]">Belum ada karyawan. Tambah di bawah.</p>
          ) : (
            staff.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-[#E3EBE6] bg-[#F7FAF8] px-3 py-2.5"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#007A4D]/12 text-sm font-bold text-[#007A4D]">
                  {s.nama.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[#0F1F17]">{s.nama}</p>
                  <p className="text-[10px] text-[#5C6B63]">PIN ····{s.pin.slice(-2)}</p>
                </div>
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold " +
                    (s.aktif ? "bg-[#007A4D]/12 text-[#007A4D]" : "bg-[#E8E8E8] text-[#888]")
                  }
                >
                  {s.aktif ? "Aktif" : "Nonaktif"}
                </span>
                <button
                  type="button"
                  onClick={() => toggleAktif(s)}
                  className="rounded-lg p-2 text-[#5C6B63] hover:bg-white"
                  title={s.aktif ? "Nonaktifkan" : "Aktifkan"}
                >
                  <UserX size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="rounded-xl border border-dashed border-[#007A4D]/30 bg-[#F2FBF6] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#007A4D]">Tambah karyawan</p>
          <div className="grid gap-2 sm:grid-cols-[1fr_100px_auto]">
            <input className={inputCls} placeholder="Nama" value={nama} onChange={(e) => setNama(e.target.value)} />
            <input
              className={inputCls + " text-center tracking-widest"}
              placeholder="PIN"
              inputMode="numeric"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            />
            <button
              type="button"
              disabled={loading}
              onClick={addStaff}
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#0F1F17] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              <Plus size={14} /> Tambah
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
