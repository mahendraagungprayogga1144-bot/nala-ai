import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import { loadOfficeSnapshot } from "@/lib/office/service";
import { guardPage } from "@/app/dashboard/lib/page-guard";
import OfficeClient from "./office-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Kantor AI",
};

export default async function OfficePage() {
  return guardPage("Kantor AI", async () => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { business } = await getActiveBusiness(supabase, user.id);
    if (!business) {
      return <div className="px-6 py-10 text-sm text-[#8B8AA0]">Belum ada bisnis aktif.</div>;
    }

    const snapshot = await loadOfficeSnapshot(business.id);
    return <OfficeClient key={business.id} businessName={business.name} initialSnapshot={snapshot} />;
  });
}
