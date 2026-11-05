import type { LucideIcon } from "lucide-react";
import PhaseBanner from "./phase-banner";
import EmptyState from "./empty-state";

export default function ComingSoonPage({
  title,
  subtitle,
  icon: Icon,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">{title}</h1>
        <p className="mt-1 text-sm text-[#6B7280]">{subtitle}</p>
      </header>
      <div className="mb-5">
        <PhaseBanner message="Structural desk for Phase 1. Data workflows and AI analysis arrive in later phases — no mock content is shown." />
      </div>
      <EmptyState icon={Icon} title={emptyTitle} description={emptyDescription} />
    </div>
  );
}
