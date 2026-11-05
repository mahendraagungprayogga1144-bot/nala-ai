"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { MentorLocale } from "@/lib/master-mentor/i18n";
import { useMentorLocale } from "../components/mentor-locale-provider";
import SectionCard from "../components/section-card";

export default function LanguageSettings() {
  const router = useRouter();
  const { locale, setLocale, t } = useMentorLocale();
  const [flash, setFlash] = useState(false);

  const pick = (next: MentorLocale) => {
    setLocale(next);
    setFlash(true);
    router.refresh();
    window.setTimeout(() => setFlash(false), 1200);
  };

  const options: { id: MentorLocale; label: string }[] = [
    { id: "id", label: t.settings.languageId },
    { id: "en", label: t.settings.languageEn },
  ];

  return (
    <SectionCard title={t.settings.languageTitle} subtitle={t.settings.languageSubtitle}>
      <p className="mb-3 text-sm text-[#6B7280]">{t.settings.languageHint}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = locale === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => pick(opt.id)}
              className={[
                "inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-[#111827] bg-[#111827] text-white"
                  : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]",
              ].join(" ")}
            >
              {active ? <Check size={14} /> : null}
              {opt.label}
            </button>
          );
        })}
      </div>
      {flash ? (
        <p className="mt-3 text-xs font-medium text-[#059669]">{t.settings.saved}</p>
      ) : null}
    </SectionCard>
  );
}
