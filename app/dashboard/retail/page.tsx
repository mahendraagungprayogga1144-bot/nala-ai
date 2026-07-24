import { Store } from "lucide-react";
import { getActiveBusiness, WrongBizType } from "../lib/get-active-business";
import BizHubShell, { fmtRp } from "../components/biz-hub-shell";

export default async function RetailHubPage() {
  const { supabase, business } = await getActiveBusiness("retail");
  if (!business || business.type !== "retail") return <WrongBizType label="Toko Retail" />;

  const { data: products } = await supabase
    .from("products")
    .select("id, stock, min_stock, price, cost")
    .eq("business_id", business.id);

  const total = products?.length || 0;
  const kritis = products?.filter((p) => Number(p.stock) <= Number(p.min_stock)).length || 0;
  const nilai = products?.reduce((s, p) => s + Number(p.stock) * Number(p.cost || p.price || 0), 0) || 0;

  return (
    <BizHubShell
      icon={Store}
      title="Pusat Retail"
      subtitle="Stok dan barcode dalam satu alur sederhana untuk toko fisik."
      businessName={business.name}
      kpis={[
        { label: "Total produk", value: String(total) },
        { label: "Stok kritis", value: String(kritis), color: kritis ? "#F59E0B" : undefined },
        { label: "Nilai stok", value: fmtRp(nilai), color: "#2DD4BF" },
      ]}
      links={[
        { href: "/dashboard/inventory", label: "Inventory", desc: "Tambah produk, cek stok, catat keluar masuk." },
        { href: "/dashboard/barcode-qr", label: "Barcode / SKU", desc: "Daftarkan kode barcode produk." },
        { href: "/dashboard/keuangan-bisnis", label: "Keuangan Bisnis", desc: "Pantau omzet & pengeluaran toko." },
      ]}
    >
      <div className="rounded-2xl border border-[#2DD4BF]/20 bg-[#2DD4BF]/[0.06] p-4 text-sm text-[#8B8AA0]">
        Tip retail: isi <span className="text-[#F0EFF8]">SKU/barcode</span> di tiap produk, set min. stok, lalu kelola keluar-masuk di Inventory.
        Stok kritis otomatis kelihatan di Inventory.
      </div>
    </BizHubShell>
  );
}
