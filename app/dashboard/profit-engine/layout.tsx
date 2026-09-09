import ProfitEngineNav from "./components/pe-nav";
import ProfitMobileNav from "./components/mobile-nav";

export const dynamic = "force-dynamic";

export default function ProfitEngineLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 pt-4 sm:px-8 sm:pt-8 md:pb-12">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#D4AF37]/80">
            Gercep OS · Module
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#F4F3FB] sm:text-2xl">
            Profit Engine
          </h1>
          <p className="mt-1 max-w-xl text-sm text-[#8B8AA0]">
            Financial cockpit — apakah iklan benar-benar menghasilkan uang, bukan hanya omzet.
          </p>
        </div>
      </div>
      <ProfitEngineNav />
      {children}
      <ProfitMobileNav />
    </div>
  );
}
