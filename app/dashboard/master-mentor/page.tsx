import Link from "next/link";
import {
  Briefcase,
  ClipboardList,
  HeartPulse,
  Lightbulb,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import { listPortfolioBusinesses } from "@/lib/master-mentor/portfolio-service";
import { createClient } from "@/lib/supabase/server";
import { MASTER_MENTOR_BASE } from "@/lib/master-mentor/types";
import EmptyState from "./components/empty-state";
import PhaseBanner from "./components/phase-banner";
import SectionCard from "./components/section-card";

export default async function MasterMentorOverviewPage() {
  const owner = await requireMentorOwnerPage();
  const db = await createClient();
  const { rows: portfolio, notice } = await listPortfolioBusinesses(db, owner.userId);
  const activeCount = portfolio.filter((b) => b.status === "active").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-6">
        <p className="text-[11px] font-semibold tracking-[0.16em] text-[#9CA3AF] uppercase">
          HENIMA AI
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#111827] sm:text-3xl">
          Business Master Mentor
        </h1>
        <p className="mt-2 text-sm text-[#6B7280]">Your Personal Business Intelligence.</p>
      </header>

      <div className="mb-6">
        <PhaseBanner message="Phase 2 Business Memory Engine is available under Memory. Panels below use owner-entered data only — nothing is simulated. AI orchestration connects in Phase 3." />
      </div>

      <div className="mb-6 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-5 py-4">
        <p className="text-sm font-semibold text-[#111827]">Welcome, {owner.ownerName}</p>
        <p className="mt-1 text-sm text-[#6B7280]">
          Owner desk for strategic mentoring across your HENIMA AI portfolio.
          {portfolio.length > 0
            ? ` ${portfolio.length} portfolio business${portfolio.length === 1 ? "" : "es"} on file${activeCount ? ` (${activeCount} active)` : ""}.`
            : " Add your first business in Business Portfolio when ready — HENIMA Perfume can be registered as business #1."}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Business Briefing"
          subtitle="Summary of portfolio context"
          action={
            <Link
              href={`${MASTER_MENTOR_BASE}/portfolio`}
              className="text-xs font-medium text-[#111827] underline-offset-2 hover:underline"
            >
              Open portfolio
            </Link>
          }
        >
          {notice.kind === "missing_table" ? (
            <EmptyState
              icon={Briefcase}
              title="Portfolio storage not ready"
              description={notice.message}
            />
          ) : portfolio.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No briefing yet"
              description="There is no portfolio business to brief. Add a business first — for example HENIMA Perfume — then this panel will use that context."
              action={
                <Link
                  href={`${MASTER_MENTOR_BASE}/portfolio`}
                  className="inline-flex rounded-lg bg-[#111827] px-3.5 py-2 text-xs font-medium text-white"
                >
                  Go to Business Portfolio
                </Link>
              }
            />
          ) : (
            <ul className="space-y-2">
              {portfolio.slice(0, 5).map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#F3F4F6] px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#111827]">{b.name}</p>
                    <p className="truncate text-xs text-[#6B7280]">{b.category}</p>
                  </div>
                  <span className="shrink-0 rounded-md border border-[#E5E7EB] bg-white px-2 py-0.5 text-[11px] font-medium text-[#4B5563]">
                    {b.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Strategic Priorities"
          subtitle="Owner-defined focus areas"
          action={
            <Link
              href={`${MASTER_MENTOR_BASE}/memory/strategy`}
              className="text-xs font-medium text-[#111827] underline-offset-2 hover:underline"
            >
              Open strategic memory
            </Link>
          }
        >
          <EmptyState
            icon={ListChecks}
            title="No priorities recorded"
            description="Add strategic plans in Memory → Strategic Plans. No placeholder priorities are shown."
          />
        </SectionCard>

        <SectionCard title="Business Health" subtitle="Signals from connected data">
          <EmptyState
            icon={HeartPulse}
            title="Health signals unavailable"
            description="Business health requires connected financial and operational data plus the Phase 3 intelligence engine. No scores are fabricated."
          />
        </SectionCard>

        <SectionCard
          title="Recent Decisions"
          subtitle="From Decision History"
          action={
            <Link
              href={`${MASTER_MENTOR_BASE}/memory/decisions`}
              className="text-xs font-medium text-[#111827] underline-offset-2 hover:underline"
            >
              Open decisions
            </Link>
          }
        >
          <EmptyState
            icon={ClipboardList}
            title="No decisions logged"
            description="When you record decisions in Memory → Decision History, the latest entries will show here."
          />
        </SectionCard>

        <SectionCard
          title="Mentor Recommendations"
          subtitle="Orchestrator output"
          action={
            <Link
              href={`${MASTER_MENTOR_BASE}/chat`}
              className="text-xs font-medium text-[#111827] underline-offset-2 hover:underline"
            >
              Open Mentor Chat
            </Link>
          }
        >
          <EmptyState
            icon={Lightbulb}
            title="Recommendations not generated"
            description="The Master Orchestrator and specialist agents are not connected in Phase 1. Recommendations will appear only after real analysis runs."
          />
        </SectionCard>

        <SectionCard title="Next step" subtitle="Phase roadmap">
          <div className="space-y-3 text-sm text-[#4B5563]">
            <div className="flex items-start gap-3">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-[#6B7280]" />
              <p>
                Complete Business Portfolio setup, then use Mentor Chat once the AI engine is wired
                in Phase 3. Strategy Room, Financial Intelligence, and Decision Journal remain
                structural desks until their Phase 2 data flows land.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
