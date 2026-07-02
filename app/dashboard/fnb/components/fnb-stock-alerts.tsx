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
    <div className="mb-5 space-y-2">
      {habis.length > 0 && (
        <div className="rounded-2xl border border-red-500/25 bg-gradient-to-r from-red-500/10 to-transparent p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" />
            <p className="text-sm font-semibold text-red-300">{habis.length} bahan habis</p>
          </div>
          <p className="text-xs text-red-200/80 leading-relaxed">{habis.map(p => p.name).join(" · ")}</p>
        </div>
      )}
      {kritis.length > 0 && (
        <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 to-transparent p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-amber-400" />
              <p className="text-sm font-semibold text-amber-300">{kritis.length} bahan hampir habis</p>
            </div>
            <Link href="/dashboard/inventory" className="text-[10px] text-amber-400 underline">Restock</Link>
          </div>
          <p className="text-xs text-amber-200/80 leading-relaxed">{kritis.map(p => `${p.name} (${p.stock})`).join(" · ")}</p>
        </div>
      )}
    </div>
  );
}
