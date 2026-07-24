"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { saveOnboardingBusiness, setActiveBusinessCookie } from "@/lib/onboarding/save-business";
import { homeForBizType } from "@/lib/auth/post-login";
import { trackClientEvent } from "@/lib/admin/track-event";
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
    if (loading) return;
    const finalType =
      selectedType === "custom"
        ? customType.trim().toLowerCase().replace(/\s+/g, "_") || "custom"
        : selectedType;
    if (!finalType || !businessName.trim()) return;
    setLoading(true);
    trackClientEvent({ event: "onboarding_start", module: "onboarding", meta: { type: finalType } });

    // getSession = local (cepat). getUser = network ke Supabase Auth (lambat).
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
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

      // Jangan tunggu profile — fire-and-forget
      void supabase.from("profiles").upsert(
        {
          id: user.id,
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0],
        },
        { onConflict: "id" },
      );

      // Langsung ke hub tipe (lebih ringan dari Dashboard Owner)
      window.location.assign(homeForBizType(finalType));
    } catch {
      alert("Gagal simpan bisnis. Coba lagi.");
      setLoading(false);
    }
  };

  const selected = businessTypes.find((b) => b.type === selectedType);
  const isReady = selectedType && businessName.trim() && (selectedType !== "custom" || customType.trim());

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#0A0A12] px-4 py-12 text-[#F2F1F8]">
      <div className="w-full max-w-2xl">
        <div className="mb-10 text-center">
          <h1 className="mb-2 text-3xl font-semibold">
            Selamat datang di <span className="holo-text">Gercep AI</span>
          </h1>
          <p className="text-[#8B8AA0]">
            Pilih jenis bisnis kamu biar sistem bisa menyesuaikan fitur & kategori yang paling relevan.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {businessTypes.map((b) => (
            <button
              key={b.type}
              type="button"
              onClick={() => setSelectedType(b.type)}
              className={
                "relative overflow-hidden rounded-2xl border p-4 text-left transition-all " +
                (selectedType === b.type
                  ? "border-white/30 bg-white/5"
                  : "border-white/10 bg-[#0F0F1A] hover:bg-white/5")
              }
            >
              {selectedType === b.type && (
                <div className="pointer-events-none absolute inset-0" style={{ background: `${b.color}15` }} />
              )}
              <div className="relative">
                <div
                  className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl"
                  style={{ background: `${b.color}20` }}
                >
                  <b.icon size={18} style={{ color: b.color }} />
                </div>
                <p className="text-sm font-medium">{b.label}</p>
                <p className="mt-0.5 text-[11px] text-[#8B8AA0]">{b.desc}</p>
              </div>
            </button>
          ))}
        </div>

        {selectedType === "custom" && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-[#0F0F1A] p-5">
            <label className="mb-2 block text-xs text-[#8B8AA0]">Jenis bisnis kamu</label>
            <input
              type="text"
              placeholder="Contoh: Afiliator, Laundry, Konveksi, dll"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-[#0A0A12] px-4 py-2.5 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:border-[#2DD4BF]/50 focus:outline-none"
            />
          </div>
        )}

        {selectedType && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-[#0F0F1A] p-5">
            <label className="mb-2 block text-xs text-[#8B8AA0]">Nama bisnis kamu</label>
            <input
              type="text"
              placeholder={
                selectedType === "custom"
                  ? "Contoh: Toko Laundry Bu Ani"
                  : `Contoh: ${selected?.label} Bu Sari`
              }
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isReady && !loading) void handleSubmit();
              }}
              className="w-full rounded-lg border border-white/10 bg-[#0A0A12] px-4 py-2.5 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:border-[#2DD4BF]/50 focus:outline-none"
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!isReady || loading}
          className="w-full rounded-xl bg-gradient-to-r from-[#38BDF8] to-[#8B5CF6] py-3 font-semibold text-[#0A0A12] transition-opacity disabled:opacity-30"
        >
          {loading ? "Menyimpan..." : "Mulai Pakai Gercep AI →"}
        </button>
      </div>
    </div>
  );
}
