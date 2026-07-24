import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import BisnisClient from "../bisnis/bisnis-client";
import { guardPage } from "../lib/page-guard";

export default async function MultiBisnisPage() {
  return guardPage("Multi Bisnis", async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { business, businesses } = await getActiveBusiness(supabase, user.id);
  return <BisnisClient businesses={businesses} activeId={business?.id || null} />;
  });
}
