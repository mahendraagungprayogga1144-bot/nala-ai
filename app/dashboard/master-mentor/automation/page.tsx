import Link from "next/link";
import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import { MASTER_MENTOR_BASE } from "@/lib/master-mentor/types";
import PhaseBanner from "../components/phase-banner";
import SectionCard from "../components/section-card";

const LINKS = [
  { href: `${MASTER_MENTOR_BASE}/automation/workflows`, title: "Workflow Manager", desc: "Definisi trigger & actions" },
  { href: `${MASTER_MENTOR_BASE}/automation/schedules`, title: "Scheduled Tasks", desc: "Cron Asia/Jakarta" },
  { href: `${MASTER_MENTOR_BASE}/automation/whatsapp`, title: "WhatsApp Integration", desc: "Infobip / draft + approval" },
  { href: `${MASTER_MENTOR_BASE}/automation/shopee`, title: "Shopee Integration", desc: "Adapter + credential needs" },
  { href: `${MASTER_MENTOR_BASE}/automation/alerts`, title: "Smart Alerts", desc: "Dedupe + severity" },
  { href: `${MASTER_MENTOR_BASE}/approvals`, title: "Approval Center", desc: "Phase 5 gate untuk aksi sensitif" },
  { href: `${MASTER_MENTOR_BASE}/automation/history`, title: "Execution History", desc: "Workflow runs" },
  { href: `${MASTER_MENTOR_BASE}/automation/sales`, title: "Sales Automation", desc: "Monitor only — no payroll edits" },
];

export default async function AutomationHubPage() {
  await requireMentorOwnerPage();
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-6">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-[#9CA3AF] uppercase">Phase 6</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#111827]">
          Automation & Integration
        </h1>
        <p className="mt-2 text-sm text-[#6B7280]">
          Briefing terjadwal, smart alerts, adapter WhatsApp/Shopee, sales monitor — owner-only.
        </p>
      </header>
      <div className="mb-5">
        <PhaseBanner message="Cron: daily 08:00 WIB, weekly Senin 09:00 WIB, alerts hourly. Set CRON_SECRET + SUPABASE_SERVICE_ROLE_KEY di Vercel." />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="block">
            <SectionCard title={l.title} subtitle={l.desc}>
              <p className="text-xs font-medium text-[#111827]">Buka →</p>
            </SectionCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
