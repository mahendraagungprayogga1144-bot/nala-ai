"use client";

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import EmptyState from "../components/empty-state";
import PhaseBanner from "../components/phase-banner";
import SectionCard from "../components/section-card";
import { useMentorLocale } from "../components/mentor-locale-provider";
import LanguageSettings from "./language-settings";

type SessionOwner = {
  ownerName: string;
  email: string | null;
  gercepCount: number;
};

export default function AiSettingsPage() {
  const { t } = useMentorLocale();
  const [owner, setOwner] = useState<SessionOwner | null>(null);

  useEffect(() => {
    fetch("/api/master-mentor/session")
      .then((r) => r.json())
      .then((data) => {
        if (data?.owner) {
          setOwner({
            ownerName: data.owner.name || data.owner.ownerName || "Owner",
            email: data.owner.email || null,
            gercepCount: Array.isArray(data.owner.gercepBusinesses)
              ? data.owner.gercepBusinesses.length
              : 0,
          });
        }
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">{t.settings.title}</h1>
        <p className="mt-1 text-sm text-[#6B7280]">{t.settings.subtitle}</p>
      </header>

      <div className="mb-5">
        <PhaseBanner message={t.settings.banner} />
      </div>

      <div className="space-y-4">
        <LanguageSettings />

        <SectionCard title={t.settings.accessTitle} subtitle={t.settings.accessSubtitle}>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-[#F3F4F6] pb-3">
              <dt className="text-[#6B7280]">{t.settings.signedInOwner}</dt>
              <dd className="font-medium text-[#111827]">{owner?.ownerName || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[#F3F4F6] pb-3">
              <dt className="text-[#6B7280]">{t.settings.email}</dt>
              <dd className="font-medium text-[#111827]">{owner?.email || "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#6B7280]">{t.settings.gercepOwned}</dt>
              <dd className="font-medium text-[#111827]">{owner?.gercepCount ?? "—"}</dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard title={t.settings.engineTitle} subtitle={t.settings.engineSubtitle}>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-[#F3F4F6] pb-3">
              <dt className="text-[#6B7280]">{t.settings.orchestrator}</dt>
              <dd className="font-medium text-[#111827]">{t.settings.orchestratorValue}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[#F3F4F6] pb-3">
              <dt className="text-[#6B7280]">{t.settings.specialists}</dt>
              <dd className="text-right font-medium text-[#6B7280]">{t.settings.specialistsValue}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[#F3F4F6] pb-3">
              <dt className="text-[#6B7280]">{t.settings.permissions}</dt>
              <dd className="font-medium text-[#6B7280]">{t.settings.permissionsValue}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#6B7280]">{t.settings.apiSecrets}</dt>
              <dd className="font-medium text-[#6B7280]">{t.settings.apiSecretsValue}</dd>
            </div>
          </dl>
        </SectionCard>

        <EmptyState
          icon={Settings}
          title={t.settings.emptyTitle}
          description={t.settings.emptyDesc}
        />
      </div>
    </div>
  );
}
