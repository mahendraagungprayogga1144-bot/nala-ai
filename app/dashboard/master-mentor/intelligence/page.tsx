import Link from "next/link";
import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import { MASTER_MENTOR_BASE } from "@/lib/master-mentor/types";
import PhaseBanner from "../components/phase-banner";
import SectionCard from "../components/section-card";

const LINKS = [
  { href: `${MASTER_MENTOR_BASE}/intelligence/performance`, title: "Business Performance", desc: "Revenue, orders, growth, AOV" },
  { href: `${MASTER_MENTOR_BASE}/intelligence/financial`, title: "Financial Intelligence", desc: "P&L, cash flow, margins, forecast" },
  { href: `${MASTER_MENTOR_BASE}/intelligence/growth`, title: "Growth Analytics", desc: "Produk, channel, peluang" },
  { href: `${MASTER_MENTOR_BASE}/intelligence/people`, title: "People Analytics", desc: "Sales performance & attendance" },
  { href: `${MASTER_MENTOR_BASE}/intelligence/inventory`, title: "Inventory Intelligence", desc: "Stok, movement, turnover proxy" },
  { href: `${MASTER_MENTOR_BASE}/intelligence/risk`, title: "Risk Monitoring", desc: "Alert terdeteksi vs hipotesis" },
  { href: `${MASTER_MENTOR_BASE}/intelligence/comparison`, title: "Business Comparison", desc: "Bandingkan beberapa bisnis" },
  { href: `${MASTER_MENTOR_BASE}/intelligence/reports`, title: "Reports", desc: "Daily / weekly / monthly export" },
];

export default async function IntelligenceHubPage() {
  await requireMentorOwnerPage();

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-6">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-[#9CA3AF] uppercase">
          Phase 4
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#111827]">
          Advanced Business Intelligence
        </h1>
        <p className="mt-2 text-sm text-[#6B7280]">
          Analitik operasional dari data Gercep yang tertaut ke portfolio. Hanya read/analyze.
        </p>
      </header>

      <div className="mb-5">
        <PhaseBanner message="Tautkan setiap bisnis portfolio ke bisnis Gercep di Business Portfolio sebelum membuka desk. Tanpa tautan, metrik operasional ditandai missing — tidak diisi angka fiktif." />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="block">
            <SectionCard title={l.title} subtitle={l.desc}>
              <p className="text-xs font-medium text-[#111827]">Buka desk →</p>
            </SectionCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
