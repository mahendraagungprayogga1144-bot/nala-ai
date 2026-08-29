import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { salesDb } from "./db";
import { resolveActorByUserId } from "./authz";
import type { Actor } from "./types";
import type { SalesDb } from "./db";

export async function loadSalesContext(): Promise<{ actor: Actor; db: SalesDb }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const cookieStore = await cookies();
  const preferred = cookieStore.get("active_business_id")?.value;
  const db = salesDb();
  const { data: profile } = await db.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
  const actor = await resolveActorByUserId(db, user.id, preferred, profile?.full_name || user.email || "Owner");
  return { actor, db };
}
