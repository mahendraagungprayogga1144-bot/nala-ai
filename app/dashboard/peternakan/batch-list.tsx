"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown, ChevronUp, CheckCircle } from "lucide-react";

type Batch = {
  id: string;
  batch_name: string;
  entry_date: string;
  entry_count: number;
  entry_weight_kg: number | null;
  target_harvest_date: string | null;
  harvest_date: string | null;
  harvest_count: number | null;
  harvest_weight_kg: number | null;
  total_feed_cost: number;
  total_medicine_cost: number;
  sell_price_per_unit: number | null;
  status: string;
  note: string | null;
  products: { name: string; daily_feed_kg: number | null } | null;
};

export default function BatchList({ batches, userId, businessId }: { batches: Batch[]; userId: string; businessId?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [harvestData, setHarvestData] = useState<Record<string, { count: string; weight: string; price: string; date: string }>>({});
  const [loading, setLoading] = useState<string | null>(null);

  const activeBatches = batches.filter((b) => b.status === "active");
  const doneBatches = batches.filter((b) => b.status === "harvested");

  const getDaysActive = (entryDate: string) => {
    const diff = new Date().getTime() - new Date(entryDate).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const getEstimatedFeedCost = (batch: Batch) => {
    const days = getDaysActive(batch.entry_date);
    const dailyFeed = batch.products?.daily_feed_kg || 0;
    return days * batch.entry_count * dailyFeed;
  };

  const getMortalityRate = (batch: Batch) => {
    if (!batch.harvest_count) return null;
    return (((batch.entry_count - batch.harvest_count) / batch.entry_count) * 100).toFixed(1);
  };

  const getProfit = (batch: Batch) => {
    if (!batch.harvest_count || !batch.sell_price_per_unit) return null;
    const income = batch.harvest_count * batch.sell_price_per_unit;
    const cost = Number(batch.total_feed_cost) + Number(batch.total_medicine_cost);
    return income - cost;
  };

  const handleHarvest = async (batchId: string) => {
    const data = harvestData[batchId];
    if (!data?.count || !data?.price) { alert("Isi jumlah panen dan harga jual dulu!"); return; }
    setLoading(batchId);

    const totalFeedCost = getEstimatedFeedCost(batches.find(b => b.id === batchId)!);
    const harvestCount = Number(data.count);
    const sellPrice = Number(data.price);
    const income = harvestCount * sellPrice;

    await supabase.from("harvest_batches").update({
      status: "harvested",
      harvest_date: data.date || new Date().toISOString().split("T")[0],
      harvest_count: harvestCount,
      harvest_weight_kg: data.weight ? Number(data.weight) : null,
      sell_price_per_unit: sellPrice,
      total_feed_cost: totalFeedCost,
    }).eq("id", batchId);

    await supabase.from("transactions").insert({
      user_id: userId,
      business_id: businessId,
      type: "pemasukan",
      scope: "bisnis",
      category: "Penjualan Hewan",
      description: `Panen ${batches.find(b => b.id === batchId)?.batch_name} — ${harvestCount} ekor`,
      amount: income,
      transaction_date: data.date || new Date().toISOString().split("T")[0],
    }).then(({ error }) => {
      if (error) alert("Panen tersimpan, tapi gagal masuk Keuangan Bisnis: " + error.message);
    });

    setLoading(null);
    router.refresh();
  };

  const updateHarvestData = (id: string, field: string, value: string) => {
    setHarvestData((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const renderBatchCard = (batch: Batch) => {
    const days = getDaysActive(batch.entry_date);
    const isExpanded = expandedId === batch.id;
    const profit = getProfit(batch);
    const mortality = getMortalityRate(batch);
    const estFeedCost = getEstimatedFeedCost(batch);

    return (
      <div key={batch.id} className="bg-[#0A0A12] border border-white/10 rounded-xl overflow-hidden mb-3">
        <div className="flex items-center justify-between px-4 py-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : batch.id)}>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-sm font-semibold">{batch.batch_name}</p>
              <span className={"text-[10px] px-2 py-0.5 rounded-full font-medium " + (batch.status === "active" ? "bg-[#2DD4BF]/15 text-[#2DD4BF]" : "bg-white/10 text-[#8B8AA0]")}>
                {batch.status === "active" ? "Aktif" : "Selesai"}
              </span>
            </div>
            <p className="text-[11px] text-[#8B8AA0]">
              {batch.products?.name} · {batch.entry_count} ekor · Hari ke-{days}
              {batch.target_harvest_date && ` · Target panen: ${new Date(batch.target_harvest_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {batch.status === "active" && (
              <div className="text-right">
                <p className="text-xs text-[#8B8AA0]">Est. biaya pakan</p>
                <p className="text-sm font-mono text-[#EC4899]">Rp{Math.round(estFeedCost * (batch.products?.daily_feed_kg || 0)).toLocaleString("id-ID")}</p>
              </div>
            )}
            {profit !== null && (
              <div className="text-right">
                <p className="text-xs text-[#8B8AA0]">Untung bersih</p>
                <p className={"text-sm font-mono font-bold " + (profit >= 0 ? "text-[#2DD4BF]" : "text-[#EC4899]")}>
                  {profit >= 0 ? "+" : ""}Rp{profit.toLocaleString("id-ID")}
                </p>
              </div>
            )}
            {isExpanded ? <ChevronUp size={16} className="text-[#8B8AA0]" /> : <ChevronDown size={16} className="text-[#8B8AA0]" />}
          </div>
        </div>

        {isExpanded && (
          <div className="px-4 pb-4 border-t border-white/5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 mb-4">
              <div className="bg-[#0F0F1A] rounded-lg p-3">
                <p className="text-[10px] text-[#8B8AA0] mb-1">Masuk</p>
                <p className="text-sm font-mono font-semibold">{batch.entry_count} ekor</p>
                <p className="text-[10px] text-[#5A5B6A]">{new Date(batch.entry_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
              </div>
              <div className="bg-[#0F0F1A] rounded-lg p-3">
                <p className="text-[10px] text-[#8B8AA0] mb-1">Hari ke-</p>
                <p className="text-sm font-mono font-semibold">{days} hari</p>
                {batch.target_harvest_date && (
                  <p className="text-[10px] text-[#5A5B6A]">Target: {new Date(batch.target_harvest_date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</p>
                )}
              </div>
              <div className="bg-[#0F0F1A] rounded-lg p-3">
                <p className="text-[10px] text-[#8B8AA0] mb-1">Biaya Pakan</p>
                <p className="text-sm font-mono font-semibold text-[#EC4899]">Rp{Number(batch.total_feed_cost || 0).toLocaleString("id-ID")}</p>
              </div>
              <div className="bg-[#0F0F1A] rounded-lg p-3">
                <p className="text-[10px] text-[#8B8AA0] mb-1">Mortalitas</p>
                <p className="text-sm font-mono font-semibold">{mortality !== null ? `${mortality}%` : "-"}</p>
              </div>
            </div>

            {batch.status === "active" && (
              <div className="bg-[#0F0F1A] border border-[#2DD4BF]/20 rounded-xl p-4">
                <p className="text-xs font-medium text-[#2DD4BF] mb-3">Catat Hasil Panen</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-[10px] text-[#8B8AA0] mb-1 block">Jumlah dipanen (ekor)</label>
                    <input type="number" placeholder="90" value={harvestData[batch.id]?.count || ""} onChange={(e) => updateHarvestData(batch.id, "count", e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] text-xs focus:outline-none focus:border-[#2DD4BF]/50" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8B8AA0] mb-1 block">Berat total panen (kg)</label>
                    <input type="number" placeholder="180" value={harvestData[batch.id]?.weight || ""} onChange={(e) => updateHarvestData(batch.id, "weight", e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] text-xs focus:outline-none focus:border-[#2DD4BF]/50" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8B8AA0] mb-1 block">Harga jual/ekor (Rp)</label>
                    <input type="number" placeholder="65000" value={harvestData[batch.id]?.price || ""} onChange={(e) => updateHarvestData(batch.id, "price", e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] text-xs focus:outline-none focus:border-[#2DD4BF]/50" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8B8AA0] mb-1 block">Tanggal panen</label>
                    <input type="date" value={harvestData[batch.id]?.date || new Date().toISOString().split("T")[0]} onChange={(e) => updateHarvestData(batch.id, "date", e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] text-xs focus:outline-none focus:border-[#2DD4BF]/50" style={{ colorScheme: "dark" }} />
                  </div>
                </div>
                {harvestData[batch.id]?.count && harvestData[batch.id]?.price && (
                  <div className="bg-[#0A0A12] rounded-lg p-3 mb-3 text-xs">
                    <div className="flex justify-between mb-1">
                      <span className="text-[#8B8AA0]">Pemasukan</span>
                      <span className="text-[#2DD4BF] font-mono">+Rp{(Number(harvestData[batch.id].count) * Number(harvestData[batch.id].price)).toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span className="text-[#8B8AA0]">Total biaya</span>
                      <span className="text-[#EC4899] font-mono">-Rp{(Number(batch.total_feed_cost) + Number(batch.total_medicine_cost)).toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-1 mt-1">
                      <span className="font-medium">Untung bersih</span>
                      <span className={"font-mono font-bold " + ((Number(harvestData[batch.id].count) * Number(harvestData[batch.id].price)) - Number(batch.total_feed_cost) >= 0 ? "text-[#2DD4BF]" : "text-[#EC4899]")}>
                        Rp{((Number(harvestData[batch.id].count) * Number(harvestData[batch.id].price)) - Number(batch.total_feed_cost) - Number(batch.total_medicine_cost)).toLocaleString("id-ID")}
                      </span>
                    </div>
                  </div>
                )}
                <button onClick={() => handleHarvest(batch.id)} disabled={loading === batch.id} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] text-[#0A0A12] font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  <CheckCircle size={15} />
                  {loading === batch.id ? "Memproses..." : "Selesai Panen & Hitung Untung"}
                </button>
              </div>
            )}

            {batch.status === "harvested" && profit !== null && (
              <div className={"rounded-xl p-4 mt-2 " + (profit >= 0 ? "bg-[#2DD4BF]/10 border border-[#2DD4BF]/20" : "bg-[#EC4899]/10 border border-[#EC4899]/20")}>
                <p className="text-xs font-medium mb-2" style={{ color: profit >= 0 ? "#2DD4BF" : "#EC4899" }}>
                  {profit >= 0 ? "✅ Batch ini untung!" : "❌ Batch ini rugi"}
                </p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-[#8B8AA0]">Dipanen</p>
                    <p className="font-mono">{batch.harvest_count} ekor</p>
                  </div>
                  <div>
                    <p className="text-[#8B8AA0]">Mortalitas</p>
                    <p className="font-mono text-[#EC4899]">{mortality}%</p>
                  </div>
                  <div>
                    <p className="text-[#8B8AA0]">Untung bersih</p>
                    <p className={"font-mono font-bold " + (profit >= 0 ? "text-[#2DD4BF]" : "text-[#EC4899]")}>Rp{profit.toLocaleString("id-ID")}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mb-6">
      <h2 className="text-sm font-medium text-[#8B8AA0] uppercase tracking-wide mb-4">Batch Panen Aktif ({activeBatches.length})</h2>
      {activeBatches.length === 0 ? (
        <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-8 text-center text-sm text-[#8B8AA0]">Belum ada batch aktif. Mulai batch panen baru di form di atas.</div>
      ) : (
        activeBatches.map((b) => renderBatchCard(b))
      )}

      {doneBatches.length > 0 && (
        <>
          <h2 className="text-sm font-medium text-[#8B8AA0] uppercase tracking-wide mb-4 mt-6">Riwayat Panen ({doneBatches.length})</h2>
          {doneBatches.map((b) => renderBatchCard(b))}
        </>
      )}
    </div>
  );
}
