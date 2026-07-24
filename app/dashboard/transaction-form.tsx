"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { todayWib } from "@/lib/date";
import { bizTypeLabel } from "@/lib/finance/biz-type-label";

const categoriesByScope = {
  pribadi: ["Gaji", "Belanja", "Tagihan", "Transportasi", "Kesehatan", "Hiburan", "Lainnya"],
  bisnis: ["Penjualan", "Modal", "Operasional", "Gaji Karyawan", "Marketing", "Sewa", "Lainnya"],
};

type BizOption = { id: string; name: string; type?: string | null };

export default function TransactionForm({
  userId,
  scope,
  businessId,
  businesses,
  requireBusinessPick,
}: {
  userId: string;
  scope: "pribadi" | "bisnis";
  businessId?: string;
  businesses?: BizOption[];
  /** When true (mode Semua bisnis), user must pick a target business. */
  requireBusinessPick?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [type, setType] = useState("pengeluaran");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categoriesByScope[scope][0]);
  const [pickedBizId, setPickedBizId] = useState(businessId || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveBizId = requireBusinessPick ? pickedBizId : businessId || pickedBizId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setError("Jumlah tidak valid");
      return;
    }
    if (scope === "bisnis" && !effectiveBizId) {
      setError(
        requireBusinessPick
          ? "Pilih bisnis tujuan dulu."
          : "Pilih bisnis aktif dulu di sidebar, lalu coba lagi.",
      );
      return;
    }
    setLoading(true);
    const { error: insertErr } = await supabase.from("transactions").insert({
      user_id: userId,
      business_id: effectiveBizId || null,
      type,
      scope,
      amount: amt,
      description,
      category,
      transaction_date: todayWib(),
    });
    setLoading(false);
    if (insertErr) {
      setError(insertErr.message || "Gagal menyimpan transaksi");
      return;
    }
    setAmount("");
    setDescription("");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5 flex flex-col gap-3 h-fit">
      <h2 className="font-medium mb-1">Catat transaksi</h2>

      <div className="flex gap-2">
        <button type="button" onClick={() => setType("pengeluaran")} className={"flex-1 py-2 rounded-lg text-sm font-medium " + (type === "pengeluaran" ? "bg-[#EC4899] text-[#0A0A12]" : "bg-[#0A0A12] border border-white/10 text-[#8B8AA0]")}>Pengeluaran</button>
        <button type="button" onClick={() => setType("pemasukan")} className={"flex-1 py-2 rounded-lg text-sm font-medium " + (type === "pemasukan" ? "bg-[#2DD4BF] text-[#0A0A12]" : "bg-[#0A0A12] border border-white/10 text-[#8B8AA0]")}>Pemasukan</button>
      </div>

      {scope === "bisnis" && requireBusinessPick && businesses && businesses.length > 0 && (
        <select
          value={pickedBizId}
          onChange={(e) => setPickedBizId(e.target.value)}
          required
          className="px-4 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] focus:outline-none focus:border-[#2DD4BF]/50"
        >
          <option value="">Pilih bisnis…</option>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} · {bizTypeLabel(b.type)}
            </option>
          ))}
        </select>
      )}

      <input type="number" required placeholder="Jumlah (Rp)" value={amount} onChange={(e) => setAmount(e.target.value)} className="px-4 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50" />
      <input type="text" placeholder="Deskripsi" value={description} onChange={(e) => setDescription(e.target.value)} className="px-4 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50" />

      <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-4 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] focus:outline-none focus:border-[#2DD4BF]/50">
        {categoriesByScope[scope].map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {error && <p className="text-xs text-[#EC4899]">{error}</p>}

      <button type="submit" disabled={loading} className="py-2.5 rounded-lg bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] text-[#0A0A12] font-semibold disabled:opacity-50 mt-1">
        {loading ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}
