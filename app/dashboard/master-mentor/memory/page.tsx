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
  { href: `${MASTER_MENTOR_BASE}/memory/owner`, title: "Profil kamu", desc: "Visi, preferensi, toleransi risiko", icon: UserRound },
  { href: `${MASTER_MENTOR_BASE}/memory/business`, title: "Info bisnis", desc: "Profil & tantangan tiap bisnis", icon: Briefcase },
  { href: `${MASTER_MENTOR_BASE}/memory/financial`, title: "Catatan uang", desc: "Actual / estimate / projection", icon: LineChart },
  { href: `${MASTER_MENTOR_BASE}/memory/decisions`, title: "Keputusan", desc: "Keputusan, harapan, hasil", icon: ClipboardList },
  { href: `${MASTER_MENTOR_BASE}/memory/strategy`, title: "Rencana", desc: "Target, pertumbuhan, milestone", icon: Target },
  { href: `${MASTER_MENTOR_BASE}/memory/learning`, title: "Pelajaran", desc: "Lesson dari pengalaman nyata", icon: Lightbulb },
  { href: `${MASTER_MENTOR_BASE}/memory/candidates`, title: "Menunggu OK", desc: "Usulan memori yang perlu kamu setujui", icon: ShieldCheck },
];

export default async function MemoryHubPage() {
  await requireMentorOwnerPage();

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8 sm:py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[#111827]">Memori bisnis</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Tempat simpan profil, uang, keputusan, rencana, dan pelajaran — biar mentor ingat.
        </p>
      </header>
      <div className="mb-5 space-y-3">
        <PhaseBanner message="Isi di sini (atau pakai tombol HENIMA). Chat mentor tidak mengarang angka." />
        <SeedHenimaButton />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {LINKS.map((item) => (
          <Link key={item.href} href={item.href} className="block">
            <SectionCard title={item.title} subtitle={item.desc}>
              <div className="flex items-center gap-2 text-sm text-[#4B5563]">
                <item.icon size={16} />
                Buka
              </div>
            </SectionCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
