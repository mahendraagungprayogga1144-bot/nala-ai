"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Zap } from "lucide-react";

type Feed = { id: string; name: string; stock: number; min_stock: number; cost: number | null; category: string | null };
type Animal = { id: string; name: string; stock: number; daily_feed_kg: number | null };

export default function FeedTracker({ feeds, animals, userId, businessId }: { feeds: Feed[]; animals: Animal[]; userId: string; businessId?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const totalHewan = animals.reduce((sum, a) => sum + a.stock, 0);
  const totalPakanPerHari = animals.reduce((sum, a) => sum + (a.stock * (a.daily_feed_kg || 0)), 0);

  const feedDaysLeft = feeds.map((f) => ({
    ...f,
    daysLeft: totalPakanPerHari > 0 ? Math.floor(f.stock / totalPakanPerHari) : 999,
  }));

  const handleCatatHarian = async () => {
    if (loading) return;
    if (totalPakanPerHari <= 0) {
      alert("Isi dulu kebutuhan pakan per ekor per hari di form Batch Panen.");
      return;
    }
    setLoading(true);
    const date = new Date().toISOString().split("T")[0];
    const errors: string[] = [];

    for (const feed of feeds) {
      if (feed.stock > 0) {
        const pakai = Math.min(feed.stock, totalPakanPerHari);
        const newStock = Math.max(0, feed.stock - pakai);

        const { error: stockErr } = await supabase
          .from("products")
          .update({ stock: newStock })
          .eq("id", feed.id)
          .eq("stock", feed.stock);
        if (stockErr) {
          errors.push(feed.name + ": " + stockErr.message);
          continue;
        }

        const { error: movErr } = await supabase.from("stock_movements").insert({
          user_id: userId,
          product_id: feed.id,
          type: "keluar",
          reason: "terpakai",
          quantity: pakai,
          note: `Pakan harian ${totalHewan} ekor`,
          profit_loss: -(feed.cost || 0) * pakai,
          movement_date: date,
        });
        if (movErr) errors.push(feed.name + " mutasi: " + movErr.message);

        if (feed.cost) {
          const { error: txErr } = await supabase.from("transactions").insert({
            user_id: userId,
            business_id: businessId,
            type: "pengeluaran",
            scope: "bisnis",
            category: "Biaya Pakan",
            description: `Pakan harian ${feed.name} untuk ${totalHewan} ekor`,
            amount: (feed.cost || 0) * pakai,
            transaction_date: date,
          });
          if (txErr) errors.push(feed.name + " biaya: " + txErr.message);
        }
      }
    }

    setLoading(false);
    if (errors.length) {
      alert("Sebagian gagal dicatat:\n" + errors.join("\n"));
    }
    router.refresh();
  };

  return (
    <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-medium">Tracker Pakan Harian</h2>
        <button onClick={handleCatatHarian} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2DD4BF]/15 border border-[#2DD4BF]/30 text-[#2DD4BF] text-xs font-medium disabled:opacity-50">
          <Zap size={12} />
          {loading ? "Memproses..." : "Catat Hari Ini"}
        </button>
      </div>
      <p className="text-xs text-[#8B8AA0] mb-4">1 tap — pakan otomatis terpotong & biaya tercatat.</p>

      <div className="bg-[#0A0A12] border border-white/5 rounded-xl p-3 mb-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-[#8B8AA0]">Total hewan aktif</span>
          <span className="font-mono text-[#F2F1F8]">{totalHewan} ekor</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-[#8B8AA0]">Kebutuhan pakan/hari</span>
          <span className="font-mono text-[#2DD4BF]">{totalPakanPerHari.toFixed(1)} kg</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {feedDaysLeft.length === 0 ? (
          <p className="text-xs text-[#8B8AA0] text-center py-4">Belum ada pakan/obat di Inventory. Tambah dulu di halaman Inventory.</p>
        ) : (
          feedDaysLeft.map((f) => {
            const isKritis = f.daysLeft <= 3;
            const pct = Math.min(100, (f.stock / (f.min_stock * 3)) * 100);
            return (
              <div key={f.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[#F2F1F8]">{f.name}</span>
                  <span className="text-[10px] font-mono" style={{ color: isKritis ? "#EC4899" : "#2DD4BF" }}>
                    {f.stock} kg · {isKritis ? `⚠️ ${f.daysLeft} hari lagi` : `${f.daysLeft} hari`}
                  </span>
                </div>
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: isKritis ? "#EC4899" : "#2DD4BF" }} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
