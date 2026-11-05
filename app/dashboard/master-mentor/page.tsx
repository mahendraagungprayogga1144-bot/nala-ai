import Link from "next/link";
import { cookies } from "next/headers";
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
import {
  MENTOR_LOCALE_COOKIE,
  getMentorDictionary,
  resolveMentorLocale,
} from "@/lib/master-mentor/i18n";
import EmptyState from "./components/empty-state";
import PhaseBanner from "./components/phase-banner";
import SectionCard from "./components/section-card";

export default async function MasterMentorOverviewPage() {
  const owner = await requireMentorOwnerPage();
  const jar = await cookies();
  const t = getMentorDictionary(resolveMentorLocale(jar.get(MENTOR_LOCALE_COOKIE)?.value));
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
          {t.overview.title}
        </h1>
        <p className="mt-2 text-sm text-[#6B7280]">{t.overview.tagline}</p>
      </header>

      <div className="mb-6">
        <PhaseBanner message={t.overview.banner} />
      </div>

      <div className="mb-6 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-5 py-4">
        <p className="text-sm font-semibold text-[#111827]">{t.overview.welcome(owner.ownerName)}</p>
        <p className="mt-1 text-sm text-[#6B7280]">
          {portfolio.length > 0
            ? t.overview.welcomeBodyFilled(portfolio.length, activeCount)
            : t.overview.welcomeBodyEmpty}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title={t.overview.briefingTitle}
          subtitle={t.overview.briefingSubtitle}
          action={
            <Link
              href={`${MASTER_MENTOR_BASE}/portfolio`}
              className="text-xs font-medium text-[#111827] underline-offset-2 hover:underline"
            >
              {t.overview.openPortfolio}
            </Link>
          }
        >
          {notice.kind === "missing_table" ? (
            <EmptyState
              icon={Briefcase}
              title={t.overview.portfolioNotReady}
              description={notice.message}
            />
          ) : portfolio.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title={t.overview.noBriefing}
              description={t.overview.noBriefingDesc}
              action={
                <Link
                  href={`${MASTER_MENTOR_BASE}/portfolio`}
                  className="inline-flex rounded-lg bg-[#111827] px-3.5 py-2 text-xs font-medium text-white"
                >
                  {t.overview.goPortfolio}
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
          title={t.overview.prioritiesTitle}
          subtitle={t.overview.prioritiesSubtitle}
          action={
            <Link
              href={`${MASTER_MENTOR_BASE}/memory/strategy`}
              className="text-xs font-medium text-[#111827] underline-offset-2 hover:underline"
            >
              {t.overview.openStrategy}
            </Link>
          }
        >
          <EmptyState
            icon={ListChecks}
            title={t.overview.noPriorities}
            description={t.overview.noPrioritiesDesc}
          />
        </SectionCard>

        <SectionCard title={t.overview.healthTitle} subtitle={t.overview.healthSubtitle}>
          <EmptyState
            icon={HeartPulse}
            title={t.overview.healthEmpty}
            description={t.overview.healthEmptyDesc}
          />
        </SectionCard>

        <SectionCard
          title={t.overview.decisionsTitle}
          subtitle={t.overview.decisionsSubtitle}
          action={
            <Link
              href={`${MASTER_MENTOR_BASE}/memory/decisions`}
              className="text-xs font-medium text-[#111827] underline-offset-2 hover:underline"
            >
              {t.overview.openDecisions}
            </Link>
          }
        >
          <EmptyState
            icon={ClipboardList}
            title={t.overview.noDecisions}
            description={t.overview.noDecisionsDesc}
          />
        </SectionCard>

        <SectionCard
          title={t.overview.recsTitle}
          subtitle={t.overview.recsSubtitle}
          action={
            <Link
              href={`${MASTER_MENTOR_BASE}/chat`}
              className="text-xs font-medium text-[#111827] underline-offset-2 hover:underline"
            >
              {t.overview.openChat}
            </Link>
          }
        >
          <EmptyState
            icon={Lightbulb}
            title={t.overview.recsEmpty}
            description={t.overview.recsEmptyDesc}
          />
        </SectionCard>

        <SectionCard title={t.overview.nextTitle} subtitle={t.overview.nextSubtitle}>
          <div className="space-y-3 text-sm text-[#4B5563]">
            <div className="flex items-start gap-3">
              <Sparkles size={16} className="mt-0.5 shrink-0 text-[#6B7280]" />
              <p>{t.overview.nextBody}</p>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
