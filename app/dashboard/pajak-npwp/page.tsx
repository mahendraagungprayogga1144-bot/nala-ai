import { createClient } from "@/lib/supabase/server";
import PajakNpwpClient from "./pajak-npwp-client";

export type NpwpProfile = {
  id: string; npwp: string | null; nama_wp: string | null;
  alamat: string | null; jenis_usaha: string | null; klu: string | null;
};

export type PajakRecord = {
  id: string; tahun: number; bulan: number;
  omzet_bulan: number; pph_terutang: number; pph_dibayar: number;
  tanggal_bayar: string | null; no_ntpn: string | null; catatan: string | null;
  created_at: string;
};

export type OmzetBulanan = { bulan: number; tahun: number; total: number };

export default async function PajakNpwpPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <div className="px-8 py-12 text-center text-[#8B8AA0]">Silakan login terlebih dahulu.</div>;
  }

  const now = new Date();
  const tahun = now.getFullYear();
  const startOfYear = `${tahun}-01-01`;
  const endOfYear = `${tahun}-12-31`;

  const [{ data: npwpRow }, { data: pajakRows }, { data: txRows }] = await Promise.all([
    supabase.from("npwp_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("pajak_records").select("*").eq("user_id", user.id).order("tahun", { ascending: false }).order("bulan", { ascending: false }).limit(100),
    supabase.from("transactions").select("amount, type, transaction_date").eq("user_id", user.id).eq("scope", "bisnis").gte("transaction_date", startOfYear).lte("transaction_date", endOfYear),
  ]);

  const omzetPerBulan: OmzetBulanan[] = [];
  let totalPemasukan = 0;
  let totalPengeluaran = 0;

  if (txRows) {
    const monthMap: Record<number, number> = {};
    txRows.forEach(t => {
      const d = new Date(t.transaction_date);
      const m = d.getMonth() + 1;
      const amt = Number(t.amount) || 0;
      if (t.type === "pemasukan") {
        monthMap[m] = (monthMap[m] || 0) + amt;
        totalPemasukan += amt;
      } else {
        totalPengeluaran += amt;
      }
    });
    for (let m = 1; m <= 12; m++) {
      omzetPerBulan.push({ bulan: m, tahun, total: monthMap[m] || 0 });
    }
  }

  return (
    <PajakNpwpClient
      userId={user.id}
      tahun={tahun}
      npwp={(npwpRow || null) as NpwpProfile | null}
      pajakRecords={(pajakRows || []) as PajakRecord[]}
      omzetPerBulan={omzetPerBulan}
      totalPemasukan={totalPemasukan}
      totalPengeluaran={totalPengeluaran}
    />
  );
}
