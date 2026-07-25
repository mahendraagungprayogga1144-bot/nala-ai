"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Users, Plus, UserX, Store, Receipt } from "lucide-react";
import type { RetailStaff } from "../page";
import {
  RECEIPT_STYLES,
  normalizeReceiptStyle,
  type ReceiptStyle,
} from "@/lib/pos/receipt-style";

export type KasirReceiptSettings = {
  storeName: string;
  receiptStyle: ReceiptStyle;
  receiptAddress: string;
  receiptNote: string;
};

export default function KasirTim({
  userId,
  businessId,
  staff,
  settings,
  onSaveSettings,
}: {
  userId: string;
  businessId: string;
  staff: RetailStaff[];
  settings: KasirReceiptSettings;
  onSaveSettings: (next: KasirReceiptSettings) => Promise<void>;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [nama, setNama] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rename, setRename] = useState(settings.storeName);
  const [style, setStyle] = useState<ReceiptStyle>(settings.receiptStyle);
  const [address, setAddress] = useState(settings.receiptAddress);
  const [note, setNote] = useState(settings.receiptNote);

  const inputCls =
    "w-full rounded-xl border border-[#C5D4CB] bg-white px-3 py-2.5 text-sm text-[#0F1F17] outline-none focus:ring-2 focus:ring-[#007A4D]/25";

  const saveReceipt = async () => {
    const name = rename.trim();
    if (!name) {
      alert("Nama usaha wajib diisi.");
      return;
    }
    setSaving(true);
    await onSaveSettings({
      storeName: name,
      receiptStyle: normalizeReceiptStyle(style),
      receiptAddress: address.trim(),
      receiptNote: note.trim(),
    });
    setSaving(false);
  };

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
          <p className="text-sm font-semibold text-[#0F1F17]">Profil usaha & struk</p>
        </div>

        <label className="mb-1 block text-[11px] font-medium text-[#5C6B63]">Nama usaha (struk)</label>
        <input className={inputCls + " mb-3"} value={rename} onChange={(e) => setRename(e.target.value)} />

        <label className="mb-1 block text-[11px] font-medium text-[#5C6B63]">Alamat / cabang (opsional)</label>
        <input
          className={inputCls + " mb-3"}
          placeholder="Jl. Contoh No. 1 · 0812-xxxx"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />

        <div className="mb-2 flex items-center gap-2">
          <Receipt size={14} className="text-[#007A4D]" />
          <p className="text-[11px] font-medium text-[#5C6B63]">Jenis struk</p>
        </div>
        <p className="mb-2 text-[10px] leading-relaxed text-[#5C6B63]">
          Pilih sesuai usaha — tagline & ucapan di struk ikut berubah (toko, cafe, jasa, atau umum).
        </p>
        <div className="mb-3 grid grid-cols-2 gap-2">
          {RECEIPT_STYLES.map((s) => {
            const active = style === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStyle(s.id)}
                className={
                  "rounded-xl border px-3 py-2.5 text-left transition-colors " +
                  (active
                    ? "border-[#007A4D] bg-[#007A4D]/08"
                    : "border-[#E3EBE6] bg-[#F7FAF8] hover:border-[#C5D4CB]")
                }
              >
                <p className={"text-xs font-semibold " + (active ? "text-[#007A4D]" : "text-[#0F1F17]")}>
                  {s.label}
                </p>
                <p className="mt-0.5 text-[10px] leading-snug text-[#5C6B63]">{s.hint}</p>
              </button>
            );
          })}
        </div>

        <label className="mb-1 block text-[11px] font-medium text-[#5C6B63]">
          Catatan footer struk (opsional)
        </label>
        <textarea
          className={inputCls + " mb-3 min-h-[72px] resize-y"}
          placeholder="Kosongkan = pakai teks default sesuai jenis struk"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <button
          type="button"
          onClick={saveReceipt}
          disabled={saving}
          className="w-full rounded-xl bg-[#007A4D] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Menyimpan…" : "Simpan profil struk"}
        </button>
      </div>

      <div className="rounded-2xl border border-[#C5D4CB] bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Users size={16} className="text-[#007A4D]" />
          <p className="text-sm font-semibold text-[#0F1F17]">Tim kasir live</p>
          <span className="ml-auto text-xs text-[#5C6B63]">
            {staff.filter((s) => s.aktif).length} aktif
          </span>
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
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#007A4D]">
            Tambah karyawan
          </p>
          <div className="grid gap-2 sm:grid-cols-[1fr_100px_auto]">
            <input
              className={inputCls}
              placeholder="Nama"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
            />
            <input
              className={inputCls + " text-center tracking-widest"}
              placeholder="PIN"
              inputMode="numeric"
              maxLength={8}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            />
            <button
              type="button"
              onClick={addStaff}
              disabled={loading}
              className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#0F1F17] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Plus size={14} /> Tambah
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
