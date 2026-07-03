"use client";
import { AlertTriangle, CheckCircle } from "lucide-react";

type Product = { name: string; stock: number; min_stock: number; category: string | null };

const PAKAN_CATS = ["Pakan"];
const OBAT_CATS = ["Obat", "Vitamin", "Vaksin"];

export default function PeternakanStockAlerts({ products }: { products: Product[] }) {
  const pakan = products.filter(p => PAKAN_CATS.includes(p.category || ""));
  const obat = products.filter(p => OBAT_CATS.includes(p.category || ""));
  const kritis = [...pakan, ...obat].filter(p => p.stock <= p.min_stock);
  const habis = kritis.filter(p => p.stock <= 0);

  if (!kritis.length) {
    return (
      <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
        <CheckCircle size={18} className="text-emerald-400 flex-shrink-0" />
        <p className="text-sm text-emerald-300">Stok pakan & obat aman — siap operasional!</p>
      </div>
    );
  }

  return (
    <div className="mb-5 space-y-2">
      {habis.length > 0 && (
        <div className="rounded-2xl border border-red-500/25 bg-gradient-to-r from-red-500/10 to-transparent p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400" />
            <p className="text-sm font-semibold text-red-300">{habis.length} stok habis</p>
          </div>
          <p className="text-xs text-red-200/80">{habis.map(p => p.name).join(" · ")}</p>
        </div>
      )}
      {kritis.filter(p => p.stock > 0).length > 0 && (
        <div className="rounded-2xl border border-amber-500/25 bg-gradient-to-r from-amber-500/10 to-transparent p-4">
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400" />
            <p className="text-sm font-semibold text-amber-300">Stok hampir habis</p>
          </div>
          <p className="text-xs text-amber-200/80">
            {kritis.filter(p => p.stock > 0).map(p => `${p.name} (${p.stock})`).join(" · ")}
          </p>
        </div>
      )}
    </div>
  );
}
