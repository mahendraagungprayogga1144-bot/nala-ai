import ProfitEngineNav from "./components/pe-nav";
import ProfitMobileNav from "./components/mobile-nav";

export const dynamic = "force-dynamic";

export default function ProfitEngineLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0 px-3 pb-24 pt-3 sm:px-6 sm:pt-6 lg:px-8 md:pb-10">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#D4AF37]/80">
            Gercep OS · Module
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#F4F3FB] sm:text-3xl">
            Profit Engine
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[#8B8AA0]">
            Financial cockpit — apakah iklan benar-benar menghasilkan uang, bukan hanya omzet.
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-[#101018] px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[#6B6A85]">Periode</p>
          <p className="text-sm font-medium text-[#F4F3FB]">3–9 Sep 2026 · TikTok Shop</p>
        </div>
      </div>
      <ProfitEngineNav />
      {children}
      <ProfitMobileNav />
    </div>
  );
}
