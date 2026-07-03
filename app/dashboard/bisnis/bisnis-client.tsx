"use client";
import { Layers, Check } from "lucide-react";
import { switchBusiness } from "@/app/actions/business";
import ModuleHeader from "../components/module-header";

const TYPE_LABEL: Record<string, string> = {
  kuliner: "Kuliner / F&B", ternak: "Peternakan", homeindustry: "Home Industri",
  retail: "Retail", pertanian: "Pertanian", jasa: "Jasa", olshop: "Online Shop",
};

export default function BisnisClient({
  businesses, activeId,
}: {
  businesses: { id: string; name: string; type: string | null }[];
  activeId: string | null;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-4 sm:px-8 sm:py-8 pb-12">
      <ModuleHeader
        icon={Layers}
        title="Multi Bisnis"
        subtitle={`${businesses.length} bisnis dalam satu akun`}
        status="live"
      />

      <div className="flex flex-col gap-3">
        {businesses.map(b => {
          const active = b.id === activeId;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => !active && switchBusiness(b.id)}
              className={
                "flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-colors " +
                (active ? "border-[#2DD4BF]/40 bg-[#2DD4BF]/10" : "border-white/[0.08] bg-[#0D0D1A] hover:border-[#2DD4BF]/25")
              }
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-lg font-bold text-[#8B5CF6]">
                {b.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{b.name}</p>
                <p className="text-xs text-[#8B8AA0]">{TYPE_LABEL[b.type || ""] || b.type || "Umum"}</p>
              </div>
              {active && <Check size={18} className="text-[#2DD4BF]" />}
            </button>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-[#5A5B7A]">
        Tambah bisnis baru lewat switcher di sidebar bawah.
      </p>
    </div>
  );
}
