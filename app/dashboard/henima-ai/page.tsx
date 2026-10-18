import { createClient } from "@/lib/supabase/server";
import HenimaAiClient from "./henima-ai-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Henima AI",
};

export default async function HenimaAiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let name = "kamu";
  if (user) {
    const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    const raw = data?.full_name || user.email?.split("@")[0] || "kamu";
    name = raw.trim().split(/\s+/)[0] || "kamu";
  }

  return <HenimaAiClient userName={name} />;
}
