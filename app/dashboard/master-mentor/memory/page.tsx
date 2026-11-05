import Link from "next/link";
import {
  Briefcase,
  ClipboardList,
  Lightbulb,
  LineChart,
  ShieldCheck,
  Target,
  UserRound,
} from "lucide-react";
import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import { MASTER_MENTOR_BASE } from "@/lib/master-mentor/types";
import PhaseBanner from "../components/phase-banner";
import SectionCard from "../components/section-card";
import SeedHenimaButton from "./seed-henima-button";

const LINKS = [
  { href: `${MASTER_MENTOR_BASE}/memory/owner`, title: "Owner Profile", desc: "Vision, preferences, risk tolerance", icon: UserRound },
  { href: `${MASTER_MENTOR_BASE}/memory/business`, title: "Business Knowledge", desc: "Per-business profiles and challenges", icon: Briefcase },
  { href: `${MASTER_MENTOR_BASE}/memory/financial`, title: "Financial Records", desc: "Actual / estimate / projection only", icon: LineChart },
  { href: `${MASTER_MENTOR_BASE}/memory/decisions`, title: "Decision History", desc: "Decisions, expectations, outcomes", icon: ClipboardList },
  { href: `${MASTER_MENTOR_BASE}/memory/strategy`, title: "Strategic Plans", desc: "Targets, growth, milestones", icon: Target },
  { href: `${MASTER_MENTOR_BASE}/memory/learning`, title: "Learning History", desc: "Lessons backed by evidence", icon: Lightbulb },
  { href: `${MASTER_MENTOR_BASE}/memory/candidates`, title: "Pending Approvals", desc: "Candidate memories need your OK", icon: ShieldCheck },
];

export default async function MemoryHubPage() {
  await requireMentorOwnerPage();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">Business Memory Engine</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Long-term memory for owner, businesses, finance, decisions, strategy, and learning.
        </p>
      </header>
      <div className="mb-5 space-y-3">
        <PhaseBanner message="Memori hanya menyimpan fakta yang Anda (atau tombol isi HENIMA) masukkan. Mentor Chat tidak mengarang angka." />
        <SeedHenimaButton />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {LINKS.map((item) => (
          <Link key={item.href} href={item.href} className="block">
            <SectionCard title={item.title} subtitle={item.desc}>
              <div className="flex items-center gap-2 text-sm text-[#4B5563]">
                <item.icon size={16} />
                Open
              </div>
            </SectionCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
