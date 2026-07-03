"use client";
import { ShoppingCart, Link2 } from "lucide-react";
import ModuleHeader from "../components/module-header";

const CHANNELS = [
  { name: "Shopee", color: "#EE4D2D", status: "Segera" },
  { name: "Tokopedia", color: "#42B549", status: "Segera" },
  { name: "TikTok Shop", color: "#F0EFF8", status: "Segera" },
  { name: "Lazada", color: "#0F146D", status: "Roadmap" },
];

export default function MarketplaceClient({ businessName }: { businessName: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
      <ModuleHeader icon={ShoppingCart} title="Marketplace Center" subtitle={businessName} status="beta" />

      <p className="mb-6 text-sm text-[#8B8AA0]">
        Satukan order dari marketplace ke satu dashboard. Stok inventory akan sinkron otomatis (fase berikutnya).
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {CHANNELS.map(c => (
          <div key={c.name} className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#0D0D1A] p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold" style={{ background: `${c.color}22`, color: c.color }}>
                {c.name[0]}
              </div>
              <div>
                <p className="font-medium">{c.name}</p>
                <p className="text-[10px] text-[#5A5B7A]">{c.status}</p>
              </div>
            </div>
            <button type="button" disabled className="flex items-center gap-1 rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-[#5A5B7A] opacity-60">
              <Link2 size={12} /> Hubungkan
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
