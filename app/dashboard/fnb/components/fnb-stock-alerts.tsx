"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle, Package, Bell, MessageCircle } from "lucide-react";
import {
  isStockNotifyEnabled,
  notifyLowStockIfNeeded,
  openStockWhatsApp,
  requestStockNotifyPermission,
  setStockNotifyEnabled,
} from "../lib/stock-notify";

type Product = { id: string; name: string; stock: number; min_stock: number; category?: string | null };

export default function FnbStockAlerts({
  products,
  businessName = "Warung",
}: {
  products: Product[];
  businessName?: string;
}) {
  const habis = products.filter(p => p.stock <= 0);
  const kritis = products.filter(p => p.stock > 0 && p.stock <= p.min_stock);
  const [notifyOn, setNotifyOn] = useState(false);

  useEffect(() => {
    setNotifyOn(isStockNotifyEnabled());
  }, []);

  useEffect(() => {
    notifyLowStockIfNeeded(products, businessName);
  }, [products, businessName]);

  const toggleNotify = async () => {
    if (notifyOn) {
      setStockNotifyEnabled(false);
      setNotifyOn(false);
      return;
    }
    const ok = await requestStockNotifyPermission();
    setNotifyOn(ok);
    if (!ok) alert("Izinkan notifikasi di pengaturan browser/HP untuk dapat peringatan stok.");
  };

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
        <div className="rounded-xl border border-red-500/30 bg-gradient-to-r from-red-500/12 to-transparent px-3 py-2.5 md:rounded-2xl md:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle size={16} className="text-red-400 flex-shrink-0" />
              <p className="text-xs font-semibold text-red-300 md:text-sm">{habis.length} bahan habis</p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button type="button" onClick={() => openStockWhatsApp(products, businessName)} title="Kirim ke WhatsApp" className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 text-[#4ADE80]">
                <MessageCircle size={13} />
              </button>
              <button type="button" onClick={toggleNotify} title={notifyOn ? "Notifikasi aktif" : "Aktifkan notifikasi"} className={"flex h-7 w-7 items-center justify-center rounded-lg border " + (notifyOn ? "border-[#2DD4BF]/40 bg-[#2DD4BF]/15 text-[#2DD4BF]" : "border-white/10 text-[#8B8AA0]")}>
                <Bell size={13} />
              </button>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-red-200/80 leading-relaxed line-clamp-2 md:line-clamp-none md:text-xs">{habis.map(p => p.name).join(" · ")}</p>
        </div>
      )}
      {kritis.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/12 to-transparent px-3 py-2.5 md:rounded-2xl md:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Package size={16} className="text-amber-400 flex-shrink-0" />
              <p className="text-xs font-semibold text-amber-300 truncate md:text-sm">{kritis.length} bahan hampir habis</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <Link href="/dashboard/inventory" className="text-[10px] text-amber-400 underline">Restock</Link>
              <button type="button" onClick={() => openStockWhatsApp(products, businessName)} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 text-[#4ADE80]">
                <MessageCircle size={13} />
              </button>
              <button type="button" onClick={toggleNotify} className={"flex h-7 w-7 items-center justify-center rounded-lg border " + (notifyOn ? "border-[#2DD4BF]/40 bg-[#2DD4BF]/15 text-[#2DD4BF]" : "border-white/10 text-[#8B8AA0]")}>
                <Bell size={13} />
              </button>
            </div>
          </div>
          <p className="mt-1 text-[11px] text-amber-200/80 leading-relaxed line-clamp-2 md:line-clamp-none md:text-xs">{kritis.map(p => `${p.name} (${p.stock})`).join(" · ")}</p>
        </div>
      )}
    </div>
  );
}
