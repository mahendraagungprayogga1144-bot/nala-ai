import { Settings } from "lucide-react";
import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import EmptyState from "../components/empty-state";
import PhaseBanner from "../components/phase-banner";
import SectionCard from "../components/section-card";

export default async function AiSettingsPage() {
  const owner = await requireMentorOwnerPage();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">AI Settings</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Preferences for the Business Master Mentor module.
        </p>
      </header>

      <div className="mb-5">
        <PhaseBanner message="Phase 1 exposes read-only module status only. Provider keys stay on the server and are not configurable from this UI." />
      </div>

      <div className="space-y-4">
        <SectionCard title="Access" subtitle="Owner-only gate">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-[#F3F4F6] pb-3">
              <dt className="text-[#6B7280]">Signed-in owner</dt>
              <dd className="font-medium text-[#111827]">{owner.ownerName}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[#F3F4F6] pb-3">
              <dt className="text-[#6B7280]">Email</dt>
              <dd className="font-medium text-[#111827]">{owner.email || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#6B7280]">Gercep businesses owned</dt>
              <dd className="font-medium text-[#111827]">{owner.gercepBusinesses.length}</dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard title="Engine status" subtitle="Integration roadmap">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-[#F3F4F6] pb-3">
              <dt className="text-[#6B7280]">Master Orchestrator</dt>
              <dd className="font-medium text-[#6B7280]">Not connected (Phase 3)</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[#F3F4F6] pb-3">
              <dt className="text-[#6B7280]">Specialists</dt>
              <dd className="text-right font-medium text-[#6B7280]">
                Strategy · CFO · Growth · Operations · Risk
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#6B7280]">API secrets</dt>
              <dd className="font-medium text-[#6B7280]">Never exposed in client</dd>
            </div>
          </dl>
        </SectionCard>

        <EmptyState
          icon={Settings}
          title="No editable AI preferences yet"
          description="Tone, specialist routing, and model preferences will be configurable after the engine lands in Phase 3."
        />
      </div>
    </div>
  );
}
