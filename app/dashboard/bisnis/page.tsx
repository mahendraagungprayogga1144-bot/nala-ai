import { createClient } from "@/lib/supabase/server";
import { getActiveBusiness } from "@/lib/dashboard/get-active-business";
import BisnisClient from "./bisnis-client";

export default async function BisnisPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { business, businesses } = await getActiveBusiness(supabase, user!.id);
  return <BisnisClient businesses={businesses} activeId={business?.id || null} />;
}
