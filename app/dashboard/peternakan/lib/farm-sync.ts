import type { SupabaseClient } from "@supabase/supabase-js";

export type FarmJenis = "bibit" | "pakan" | "obat" | "vitamin" | "operasional" | "mortalitas" | "panen";

const JENIS_LABEL: Record<FarmJenis, string> = {
  bibit: "Bibit", pakan: "Pakan", obat: "Obat", vitamin: "Vitamin",
  operasional: "Operasional", mortalitas: "Mortalitas", panen: "Panen",
};

const PENGELUARAN_CAT: Record<string, string> = {
  bibit: "Pembelian Hewan",
  pakan: "Pembelian Pakan",
  obat: "Pembelian Obat",
  vitamin: "Pembelian Obat",
  operasional: "Operasional Ternak",
};

type BuildParams = {
  jenis: FarmJenis;
  total: number;
  qty: number | null;
  namaItem: string | null;
  batchName: string;
  jenisTernak: string;
  tanggal: string;
  totalModal: number;
  totalBibit: number;
};

function desc(prefix: string, batchName: string, jenisTernak: string, namaItem?: string | null) {
  return `${prefix} — ${batchName} (${jenisTernak})${namaItem ? ` · ${namaItem}` : ""}`;
}

export function buildKeuanganRows(p: BuildParams) {
  const rows: { type: string; scope: string; category: string; description: string; amount: number; transaction_date: string }[] = [];
  if (p.jenis === "mortalitas" || (p.total <= 0 && p.jenis !== "panen")) return rows;

  if (p.jenis === "panen") {
    // Biaya bibit/pakan/obat sudah masuk pengeluaran saat dicatat —
    // panen hanya catat pemasukan (hindari double HPP).
    if (p.total > 0) {
      rows.push({
        type: "pemasukan", scope: "bisnis", category: "Penjualan Hewan",
        description: desc(`Jual ${p.qty || 0} ekor`, p.batchName, p.jenisTernak),
        amount: p.total, transaction_date: p.tanggal,
      });
    }
    return rows;
  }

  rows.push({
    type: "pengeluaran", scope: "bisnis",
    category: PENGELUARAN_CAT[p.jenis] || "Operasional Ternak",
    description: desc(JENIS_LABEL[p.jenis], p.batchName, p.jenisTernak, p.namaItem),
    amount: p.total, transaction_date: p.tanggal,
  });
  return rows;
}

export type FarmSyncResult = { ok: boolean; error?: string; txIds: string[] };

export async function syncFarmToKeuangan(
  supabase: SupabaseClient,
  opts: {
    userId: string;
    businessId: string;
    farmTxId: string;
    existingTxIds?: string[] | null;
  } & BuildParams,
): Promise<FarmSyncResult> {
  if (!opts.businessId) {
    return { ok: false, error: "Bisnis ternak tidak terpilih — ganti bisnis aktif ke Peternakan.", txIds: [] };
  }

  if (opts.existingTxIds?.length) {
    await supabase.from("transactions").delete().in("id", opts.existingTxIds);
  }

  const rows = buildKeuanganRows(opts);
  if (!rows.length) {
    await supabase.from("farm_transactions").update({ keuangan_tx_ids: [] }).eq("id", opts.farmTxId);
    return { ok: true, txIds: [] };
  }

  const ids: string[] = [];
  for (const row of rows) {
    const { data, error } = await supabase.from("transactions").insert({
      user_id: opts.userId,
      business_id: opts.businessId,
      ...row,
    }).select("id").single();
    if (error) {
      if (ids.length) {
        await supabase.from("transactions").delete().in("id", ids);
      }
      await supabase.from("farm_transactions").update({ keuangan_tx_ids: [] }).eq("id", opts.farmTxId);
      return {
        ok: false,
        error: error.message || "Gagal sync ke Keuangan Bisnis",
        txIds: [],
      };
    }
    if (data?.id) ids.push(data.id);
  }

  await supabase.from("farm_transactions").update({ keuangan_tx_ids: ids }).eq("id", opts.farmTxId);
  return { ok: true, txIds: ids };
}

export async function deleteFarmKeuangan(
  supabase: SupabaseClient,
  txIds: string[] | null | undefined,
) {
  if (txIds?.length) {
    await supabase.from("transactions").delete().in("id", txIds);
  }
}
