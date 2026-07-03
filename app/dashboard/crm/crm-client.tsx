"use client";
import { Users, MessageCircle } from "lucide-react";
import { formatTxTimeWib } from "@/lib/finance/sort-transactions";
import ModuleHeader from "../components/module-header";

type Customer = { id: string; label: string; total: number; count: number; lastAt: string };

export default function CrmClient({ businessName, customers }: { businessName: string; customers: Customer[] }) {
  const waFollowUp = (c: Customer) => {
    const text = `Halo! Terima kasih sudah order di ${businessName}. Ada yang bisa kami bantu lagi?`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
      <ModuleHeader icon={Users} title="CRM Pelanggan" subtitle={`${businessName} · bulan ini`} status="beta" />

      {customers.length === 0 ? (
        <p className="py-8 text-center text-sm text-[#8B8AA0]">Belum ada data pelanggan/order bulan ini.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {customers.map(c => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0D0D1A] px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2DD4BF]/15 text-xs font-bold text-[#2DD4BF]">
                {c.label.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.label}</p>
                <p className="text-[10px] text-[#8B8AA0]">{c.count} transaksi · terakhir {formatTxTimeWib(c.lastAt)} WIB</p>
              </div>
              <p className="shrink-0 font-mono text-sm font-semibold text-[#2DD4BF]">Rp{c.total.toLocaleString("id-ID")}</p>
              <button type="button" onClick={() => waFollowUp(c)} className="shrink-0 rounded-lg border border-[#4ADE80]/30 p-2 text-[#4ADE80] hover:bg-[#4ADE80]/10" title="Follow-up WA">
                <MessageCircle size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
