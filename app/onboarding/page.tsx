"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveOnboardingBusiness, setActiveBusinessCookie } from "@/lib/onboarding/save-business";
import { Store, Bird, UtensilsCrossed, Factory, Briefcase, ShoppingBag, Truck, Heart, Leaf, Wrench, PenLine } from "lucide-react";

const businessTypes = [
  { type: "retail", label: "Toko Retail", desc: "Jualan produk fisik, fashion, elektronik, dll", icon: Store, color: "#38BDF8" },
  { type: "ternak", label: "Peternakan", desc: "Ayam, sapi, kambing, ikan, dll", icon: Bird, color: "#2DD4BF" },
  { type: "kuliner", label: "Kuliner / F&B", desc: "Restoran, warung, katering, minuman", icon: UtensilsCrossed, color: "#F59E0B" },
  { type: "homeindustry", label: "Home Industry", desc: "Produksi rumahan, kerajinan, olahan", icon: Factory, color: "#8B5CF6" },
  { type: "jasa", label: "Jasa / Freelance", desc: "Servis, konsultan, kreator konten", icon: Briefcase, color: "#EC4899" },
  { type: "wholesale", label: "Grosir / Distributor", desc: "Jual partai besar, supplier", icon: Truck, color: "#6366F1" },
  { type: "olshop", label: "Online Shop", desc: "Shopee, TikTok, Tokopedia, Instagram", icon: ShoppingBag, color: "#F43F5E" },
  { type: "kesehatan", label: "Kesehatan / Klinik", desc: "Apotek, klinik, produk kesehatan", icon: Heart, color: "#10B981" },
  { type: "pertanian", label: "Pertanian", desc: "Sawah, kebun, hasil bumi", icon: Leaf, color: "#84CC16" },
  { type: "bengkel", label: "Bengkel / Otomotif", desc: "Servis kendaraan, spare part", icon: Wrench, color: "#EF4444" },
  { type: "custom", label: "Bisnis Lainnya", desc: "Ketik sendiri jenis bisnismu", icon: PenLine, color: "#A78BFA" },
];

export default function OnboardingPage() {
  const supabase = createClient();
  const [selectedType, setSelectedType] = useState("");
  const [customType, setCustomType] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const finalType = selectedType === "custom" ? (customType.trim().toLowerCase().replace(/\s+/g, "_") || "custom") : selectedType;
    if (!finalType || !businessName.trim()) return;
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.assign("/login");
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const isNew = params.get("mode") === "new";

    try {
      const bizId = await saveOnboardingBusiness(supabase, user.id, {
        name: businessName.trim(),
        type: finalType,
        isNew,
      });
      if (bizId) setActiveBusinessCookie(bizId);
      await supabase.from("profiles").upsert({ id: user.id, full_name: user.user_metadata?.full_name || user.email?.split("@")[0] }, { onConflict: "id" });
    } catch {
      alert("Gagal simpan bisnis. Coba lagi.");
      setLoading(false);
      return;
    }

    setLoading(false);
    window.location.assign("/dashboard/owner");
  };

  const selected = businessTypes.find((b) => b.type === selectedType);
  const isReady = selectedType && businessName.trim() && (selectedType !== "custom" || customType.trim());

  return (
    <div className="min-h-screen bg-[#0A0A12] text-[#F2F1F8] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold mb-2">Selamat datang di <span className="holo-text">Gercep AI</span></h1>
          <p className="text-[#8B8AA0]">Pilih jenis bisnis kamu biar sistem bisa menyesuaikan fitur & kategori yang paling relevan.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {businessTypes.map((b) => (
            <button
              key={b.type}
              onClick={() => setSelectedType(b.type)}
              className={"relative rounded-2xl p-4 text-left border transition-all overflow-hidden " + (selectedType === b.type ? "border-white/30 bg-white/5" : "border-white/10 bg-[#0F0F1A] hover:bg-white/5")}
            >
              {selectedType === b.type && (
                <div className="absolute inset-0 pointer-events-none" style={{ background: `${b.color}15` }} />
              )}
              <div className="relative">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: `${b.color}20` }}>
                  <b.icon size={18} style={{ color: b.color }} />
                </div>
                <p className="text-sm font-medium">{b.label}</p>
                <p className="text-[11px] text-[#8B8AA0] mt-0.5">{b.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {selectedType === "custom" && (
          <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5 mb-4">
            <label className="text-xs text-[#8B8AA0] mb-2 block">Jenis bisnis kamu</label>
            <input
              type="text"
              placeholder="Contoh: Afiliator, Laundry, Konveksi, dll"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50"
            />
          </div>
        )}

        {selectedType && (
          <div className="bg-[#0F0F1A] border border-white/10 rounded-2xl p-5 mb-4">
            <label className="text-xs text-[#8B8AA0] mb-2 block">Nama bisnis kamu</label>
            <input
              type="text"
              placeholder={selectedType === "custom" ? "Contoh: Toko Laundry Bu Ani" : `Contoh: ${selected?.label} Pak Budi`}
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-[#2DD4BF]/50"
            />
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!isReady || loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] text-[#0A0A12] font-semibold disabled:opacity-30 transition-opacity"
        >
          {loading ? "Menyimpan..." : "Mulai Pakai Gercep AI →"}
        </button>
      </div>
    </div>
  );
}
