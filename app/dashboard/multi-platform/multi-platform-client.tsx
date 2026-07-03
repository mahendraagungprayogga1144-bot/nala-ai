"use client";
import { Smartphone, Globe, MessageCircle, Send, CheckCircle2, Clock } from "lucide-react";
import ModuleHeader from "../components/module-header";

const PLATFORMS = [
  { name: "Website Dashboard", icon: Globe, status: "live" as const, desc: "nala-clode.vercel.app — aktif sekarang" },
  { name: "WhatsApp Bot", icon: MessageCircle, status: "soon" as const, desc: "Order & notifikasi stok via WA Business" },
  { name: "Telegram Bot", icon: Send, status: "soon" as const, desc: "Rekap harian & alert ke grup tim" },
  { name: "Mobile App", icon: Smartphone, status: "roadmap" as const, desc: "Kasir native + Bluetooth printer" },
];

export default function MultiPlatformClient() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
      <ModuleHeader icon={Smartphone} title="Multi Platform" subtitle="Satu bisnis, banyak channel" status="beta" />

      <div className="flex flex-col gap-3">
        {PLATFORMS.map(p => (
          <div key={p.name} className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-[#0D0D1A] p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5">
              <p.icon size={18} className="text-[#2DD4BF]" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{p.name}</p>
                {p.status === "live" ? (
                  <span className="flex items-center gap-0.5 text-[10px] text-[#2DD4BF]"><CheckCircle2 size={10} /> Live</span>
                ) : (
                  <span className="flex items-center gap-0.5 text-[10px] text-[#F59E0B]"><Clock size={10} /> {p.status === "soon" ? "Segera" : "Roadmap"}</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-[#8B8AA0]">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
