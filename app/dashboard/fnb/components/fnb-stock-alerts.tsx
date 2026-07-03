"use client";
import Link from "next/link";
import { AlertTriangle, CheckCircle, Package } from "lucide-react";

type Product = { id: string; name: string; stock: number; min_stock: number; category?: string | null };

export default function FnbStockAlerts({ products }: { products: Product[] }) {
  const habis = products.filter(p => p.stock <= 0);
  const kritis = products.filter(p => p.stock > 0 && p.stock <= p.min_stock);

  if (!habis.length && !kritis.length) {
    return (
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
        <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
        <p className="text-sm text-emerald-300">Semua bahan aman — siap jualan!</p>
      </div>
    );
  }

  return (
    <div className="mb-3 md:mb-5 space-y-2">
      {habis.length > 0 && (
        <div className="rounded-xl border border-red-500/25 bg-gradient-to-r from-red-500/10 to-transparent px-3 py-2.5 md:rounded-2xl md:p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400 flex-shrink-0 md:hidden" />
            <AlertTriangle size={16} className="text-red-400 flex-shrink-0 hidden md:block" />
            <p className="text-xs font-semibold text-red-300 md:text-sm">{habis.length} bahan habis</p>
          </div>
          <p className="mt-1 text-[11px] text-red-200/80 leading-relaxed line-clamp-2 md:line-clamp-none md:text-xs">{habis.map(p => p.name).join(" · ")}</p>
        </div>
      )}
      {kritis.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 to-transparent px-3 py-2.5 md:rounded-2xl md:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Package size={14} className="text-amber-400 flex-shrink-0 md:hidden" />
              <Package size={16} className="text-amber-400 flex-shrink-0 hidden md:block" />
              <p className="text-xs font-semibold text-amber-300 truncate md:text-sm">{kritis.length} bahan hampir habis</p>
            </div>
            <Link href="/dashboard/inventory" className="text-[10px] text-amber-400 underline flex-shrink-0">Restock</Link>
          </div>
          <p className="mt-1 text-[11px] text-amber-200/80 leading-relaxed line-clamp-2 md:line-clamp-none md:text-xs">{kritis.map(p => `${p.name} (${p.stock})`).join(" · ")}</p>
        </div>
      )}
    </div>
  );
}
