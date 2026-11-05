import { Plus_Jakarta_Sans } from "next/font/google";
import { requireMentorOwnerPage } from "@/lib/master-mentor/authz";
import MentorShell from "./components/mentor-shell";

export const dynamic = "force-dynamic";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata = {
  title: "HENIMA AI — Business Master Mentor",
};

export default async function MasterMentorLayout({ children }: { children: React.ReactNode }) {
  const owner = await requireMentorOwnerPage();

  return (
    <div className={`${jakarta.className} h-full min-h-0 bg-white text-[#111827]`}>
      <MentorShell ownerName={owner.ownerName}>{children}</MentorShell>
    </div>
  );
}
