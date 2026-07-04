import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UpgradeClient from "./upgrade-client";

export type CurrentSub = {
  plan: string;
  status: string;
  expired_at: string | null;
} | null;

export type PendingPayment = {
  id: string;
  plan: string;
  amount: number;
  invoice_id: string | null;
  created_at: string;
} | null;

export default async function UpgradePage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("plan, status, expired_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: pending } = await supabase
    .from("payments")
    .select("id, plan, amount, invoice_id, created_at")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <UpgradeClient
      userId={user.id}
      userEmail={user.email || ""}
      userName={profile?.full_name || user.email?.split("@")[0] || "User"}
      currentSub={sub}
      pendingPayment={pending}
      initialPlan={params.plan}
    />
  );
}
